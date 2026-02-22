import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DatabaseService } from '../../database/database.service';
import { ClaudeService } from '../../libs/services/claude.service';
import { GeminiService, GeneratedImage } from '../../libs/services/gemini.service';
import { StorageService } from '../../libs/services/storage.service';
import { PromptValidatorService } from '../../libs/services/prompt-validator.service';
import { GenerationGateway } from '../../socket/generation.gateway';
import { GenerationJobData, FixErrorsJobData, ClaudeResponseJson } from '../../libs/types/generation/generation.type';
import { GenerationStatus } from '../../libs/enums/generation/generation.enum';
import { Brand } from '../../libs/types/brand/brand.type';
import { Product } from '../../libs/types/product/product.type';
import { AdConcept } from '../../libs/types/concept/concept.type';

@Processor('generation', { concurrency: 2 })
export class GenerationProcessor extends WorkerHost {
	private readonly logger = new Logger('GenerationProcessor');

	constructor(
		private claudeService: ClaudeService,
		private geminiService: GeminiService,
		private storageService: StorageService,
		private databaseService: DatabaseService,
		private generationGateway: GenerationGateway,
		private promptValidator: PromptValidatorService,
	) {
		super();
	}

	async process(job: Job): Promise<void> {
		if (job.name === 'fix-errors') {
			return this.processFixErrors(job as Job<FixErrorsJobData>);
		}
		return this.processCreateAd(job as Job<GenerationJobData>);
	}

	private async processCreateAd(job: Job<GenerationJobData>): Promise<void> {
		const { user_id, brand_id, product_id, concept_id, important_notes, generated_ad_id, variation_index } = job.data;

		this.logger.log(`Processing generation job: ${generated_ad_id} (attempt: ${job.attemptsMade + 1})`);

		try {
			// 1. Job autentifikatsiya — generated_ad DB'da bormi va user_id to'g'rimi?
			const { data: adRecord, error: adError } = await this.databaseService.client
				.from('generated_ads')
				.select('_id, user_id, generation_status')
				.eq('_id', generated_ad_id)
				.eq('user_id', user_id)
				.single();

			if (adError || !adRecord) {
				throw new Error(`Job authentication failed: ad ${generated_ad_id} not found for user ${user_id}`);
			}

			// Allow retry: if status is 'failed' (BullMQ retry), reset to 'pending'
			if (adRecord.generation_status === GenerationStatus.CANCELLED) {
				this.logger.log(`Skipping cancelled job: ${generated_ad_id}`);
				return; // User left the page — skip silently, no retry
			} else if (adRecord.generation_status === GenerationStatus.FAILED) {
				this.logger.warn(`Skipping job — ad ${generated_ad_id} already failed. No retries allowed.`);
				return;
			} else if (adRecord.generation_status !== GenerationStatus.PENDING) {
				this.logger.warn(`Skipping job — ad ${generated_ad_id} is already ${adRecord.generation_status}`);
				return; // Don't throw — just skip completed/processing jobs
			}

			// 2. Status → processing
			await this.updateAdStatus(generated_ad_id, GenerationStatus.PROCESSING);

			// 3. Fetch brand, product, concept from DB
			this.generationGateway.emitProgress(user_id, {
				job_id: generated_ad_id,
				step: 'fetching_data',
				message: 'Loading data...',
				progress_percent: 5,
			});

			const [brand, product, concept] = await Promise.all([
				this.fetchBrand(brand_id),
				this.fetchProduct(product_id),
				this.fetchConcept(concept_id),
			]);

			// 4. Claude API — ad copy generation (if not already in job data)
			let claudeResponse: ClaudeResponseJson;

			if (job.data.claude_variation) {
				this.logger.log(`Using pre-generated Claude variation for job ${generated_ad_id}`);
				claudeResponse = job.data.claude_variation;
			} else {
				this.generationGateway.emitProgress(user_id, {
					job_id: generated_ad_id,
					step: 'generating_copy',
					message: 'AI ad copy is generating...',
					progress_percent: 15,
				});

				claudeResponse = await this.claudeService.generateAdCopy(
					brand,
					product,
					concept,
					important_notes || '',
					variation_index || 0, // Pass variation index (default 0)
				);
			}

			// 5. Gemini API — generate all 3 ratios in parallel
			this.generationGateway.emitProgress(user_id, {
				job_id: generated_ad_id,
				step: 'generating_images',
				message: 'Generating images (1:1, 9:16, 16:9)...',
				progress_percent: 35,
			});

			// ✅ Validate and clean Claude's output before sending to Gemini
			const validation = this.promptValidator.validateGeminiPrompt(
				claudeResponse,
				{
					primary: brand.primary_color,
					secondary: brand.secondary_color,
					accent: brand.accent_color,
				},
			);

			if (validation.issues.length > 0) {
				this.logger.warn(`Generation ${generated_ad_id}: Fixed ${validation.issues.length} prompt issues: ${validation.issues.join('; ')}`);
			}

			// Use cleaned prompt (hex codes stripped, typos fixed)
			const basePrompt = validation.cleanedPrompt;

			// Build brand color description for ratio-specific prompts
			const brandColorDesc = this.buildBrandColorDescription(brand);

			// Ratio-specific prompts with color preservation instructions
			const prompt1x1 = `${basePrompt}\n\nASPECT RATIO: Square (1:1, 1080x1080). This is the base design format.\nCOLOR PALETTE TO MATCH EXACTLY: ${brandColorDesc}`;
			const prompt9x16 = `${basePrompt}\n\nASPECT RATIO: Vertical/Stories (9:16, 1080x1920). Stack elements vertically — product in middle, text at top, CTA at bottom. More vertical whitespace between elements.\nCRITICAL: MAINTAIN IDENTICAL colors, mood, and style as the square version.\nCOLOR PALETTE TO MATCH EXACTLY: ${brandColorDesc}`;
			const prompt16x9 = `${basePrompt}\n\nASPECT RATIO: Horizontal/Landscape (16:9, 1920x1080). Side-by-side layout — text on one side, product on the other. Single line headlines preferred.\nCRITICAL: MAINTAIN IDENTICAL colors, mood, and style as the square version.\nCOLOR PALETTE TO MATCH EXACTLY: ${brandColorDesc}`;

			// Send product photo + brand logo + concept image as reference images
			const referenceImages = [product.photo_url, brand.logo_url, concept.image_url].filter(Boolean);
			this.logger.log(`Sending ${referenceImages.length} reference images to Gemini (product: ${!!product.photo_url}, logo: ${!!brand.logo_url}, concept: ${!!concept.image_url})`);

			// Generate all 3 ratios in parallel with retry logic (3 attempts each)
			const [result1x1, result9x16, result16x9] = await Promise.all([
				this.geminiService.generateImageWithRetry(prompt1x1, referenceImages, '1:1', `${generated_ad_id}/1:1`),
				this.geminiService.generateImageWithRetry(prompt9x16, referenceImages, '9:16', `${generated_ad_id}/9:16`),
				this.geminiService.generateImageWithRetry(prompt16x9, referenceImages, '16:9', `${generated_ad_id}/16:9`),
			]);

			// 6. Upload all successful results in parallel
			this.generationGateway.emitProgress(user_id, {
				job_id: generated_ad_id,
				step: 'uploading',
				message: 'Saving images...',
				progress_percent: 65,
			});

			const imageUrls: Record<string, string> = {};
			const uploadTasks: Promise<void>[] = [];

			if (result1x1.data) {
				uploadTasks.push(
					this.storageService.uploadImage(user_id, generated_ad_id, '1x1', Buffer.from(result1x1.data, 'base64'))
						.then((url) => { imageUrls['1x1'] = url; })
						.catch((err) => { this.logger.error(`Upload 1x1 failed: ${err.message}`); }),
				);
			} else {
				this.logger.error(`1:1 generation failed after retries: ${result1x1.error}`);
			}

			if (result9x16.data) {
				uploadTasks.push(
					this.storageService.uploadImage(user_id, generated_ad_id, '9x16', Buffer.from(result9x16.data, 'base64'))
						.then((url) => { imageUrls['9x16'] = url; })
						.catch((err) => { this.logger.warn(`Upload 9x16 failed: ${err.message}`); }),
				);
			} else {
				this.logger.warn(`9:16 generation failed after retries: ${result9x16.error}`);
			}

			if (result16x9.data) {
				uploadTasks.push(
					this.storageService.uploadImage(user_id, generated_ad_id, '16x9', Buffer.from(result16x9.data, 'base64'))
						.then((url) => { imageUrls['16x9'] = url; })
						.catch((err) => { this.logger.warn(`Upload 16x9 failed: ${err.message}`); }),
				);
			} else {
				this.logger.warn(`16:9 generation failed after retries: ${result16x9.error}`);
			}

			await Promise.all(uploadTasks);

			if (Object.keys(imageUrls).length === 0) {
				throw new Error('All image generations failed — no images to save');
			}

			// 7. Ad copy (gemini_image_prompt'siz)
			const adCopyJson = {
				headline: claudeResponse.headline,
				subheadline: claudeResponse.subheadline,
				body_text: claudeResponse.body_text,
				callout_texts: claudeResponse.callout_texts,
				cta_text: claudeResponse.cta_text,
			};

			// 8. generated_ads jadvalini yangilash
			this.generationGateway.emitProgress(user_id, {
				job_id: generated_ad_id,
				step: 'saving',
				message: 'Natijalar saqlanmoqda...',
				progress_percent: 85,
			});

			const { error: updateError } = await this.databaseService.client
				.from('generated_ads')
				.update({
					claude_response_json: claudeResponse,
					gemini_prompt: claudeResponse.gemini_image_prompt,
					image_url_1x1: imageUrls['1x1'] || null,
					image_url_9x16: imageUrls['9x16'] || null,
					image_url_16x9: imageUrls['16x9'] || null,
					ad_copy_json: adCopyJson,
					generation_status: GenerationStatus.COMPLETED,
					ad_name: `${brand.name} — ${product.name}`,
					brand_snapshot: brand,
					product_snapshot: product,
				})
				.eq('_id', generated_ad_id);

			if (updateError) {
				throw new Error(`Failed to update generated ad: ${updateError.message}`);
			}

			// 9. Concept usage_count++
			await this.databaseService.client.rpc('increment_usage_count', {
				concept_id: concept_id,
			}).then(({ error }) => {
				if (error) {
					return this.databaseService.client
						.from('ad_concepts')
						.update({ usage_count: (concept.usage_count || 0) + 1 })
						.eq('_id', concept_id);
				}
			});

			// 10. WebSocket: tayyor!
			this.generationGateway.emitCompleted(user_id, {
				job_id: generated_ad_id,
				ad_id: generated_ad_id,
				image_url: imageUrls['1x1'] || Object.values(imageUrls)[0] || '',
			});

			this.logger.log(`Generation completed: ${generated_ad_id} (${Object.keys(imageUrls).length} images)`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.error(`Generation failed: ${generated_ad_id} — ${message}`);

			await this.updateAdStatus(generated_ad_id, GenerationStatus.FAILED);

			this.generationGateway.emitFailed(user_id, {
				job_id: generated_ad_id,
				error: message,
			});

			throw error;
		}
	}

	private async updateAdStatus(adId: string, status: GenerationStatus): Promise<void> {
		await this.databaseService.client
			.from('generated_ads')
			.update({ generation_status: status })
			.eq('_id', adId);
	}

	private async fetchBrand(brandId: string): Promise<Brand> {
		const { data, error } = await this.databaseService.client
			.from('brands')
			.select('*')
			.eq('_id', brandId)
			.single();

		if (error || !data) throw new Error('Brand not found');
		return data as Brand;
	}

	private async fetchProduct(productId: string): Promise<Product> {
		const { data, error } = await this.databaseService.client
			.from('products')
			.select('*')
			.eq('_id', productId)
			.single();

		if (error || !data) throw new Error('Product not found');
		return data as Product;
	}

	/**
	 * Build descriptive brand color string for ratio-specific prompts (no hex codes).
	 */
	private buildBrandColorDescription(brand: Brand): string {
		const colors: string[] = [];
		if (brand.primary_color) colors.push(`Primary: ${brand.primary_color}`);
		if (brand.secondary_color) colors.push(`Secondary: ${brand.secondary_color}`);
		if (brand.accent_color) colors.push(`Accent: ${brand.accent_color}`);
		if (brand.background_color) colors.push(`Background: ${brand.background_color}`);
		return colors.length > 0 ? colors.join(', ') : 'Use professional neutral tones';
	}

	private async fetchConcept(conceptId: string): Promise<AdConcept> {
		const { data, error } = await this.databaseService.client
			.from('ad_concepts')
			.select('*')
			.eq('_id', conceptId)
			.single();

		if (error || !data) throw new Error('Concept not found');
		return data as AdConcept;
	}

	/**
	 * Fix-errors job handler
	 */
	private async processFixErrors(job: Job<FixErrorsJobData>): Promise<void> {
		const { user_id, original_ad_id, new_ad_id, error_description } = job.data;

		this.logger.log(`Processing fix-errors job: ${new_ad_id} (original: ${original_ad_id})`);

		try {
			// 1. Status → processing
			await this.updateAdStatus(new_ad_id, GenerationStatus.PROCESSING);

			// 2. Get data from original ad
			this.generationGateway.emitProgress(user_id, {
				job_id: new_ad_id,
				step: 'fetching_data',
				message: 'Loading original ad data...',
				progress_percent: 5,
			});

			const { data: originalAd, error: adError } = await this.databaseService.client
				.from('generated_ads')
				.select('claude_response_json, brand_id, brand_snapshot, product_snapshot, image_url_1x1')
				.eq('_id', original_ad_id)
				.single();

			if (adError || !originalAd) {
				throw new Error(`Original ad not found: ${original_ad_id}`);
			}

			// 3. Claude API — fix errors with vision analysis of current image
			this.generationGateway.emitProgress(user_id, {
				job_id: new_ad_id,
				step: 'fixing_copy',
				message: 'AI analyzing image and fixing errors...',
				progress_percent: 15,
			});

			const claudeResponse: ClaudeResponseJson = await this.claudeService.fixAdErrors(
				originalAd.claude_response_json as ClaudeResponseJson,
				error_description,
				originalAd.image_url_1x1 || undefined, // Pass image for Claude vision analysis
			);

			// ✅ Validate and clean Claude's fix-errors output
			const brandSnapshot = originalAd.brand_snapshot || {};
			const productSnapshot = originalAd.product_snapshot || {};
			const validation = this.promptValidator.validateGeminiPrompt(
				claudeResponse,
				{
					primary: brandSnapshot.primary_color || '#000000',
					secondary: brandSnapshot.secondary_color || '#333333',
					accent: brandSnapshot.accent_color || '#666666',
				},
			);

			if (validation.issues.length > 0) {
				this.logger.warn(`Fix-errors ${new_ad_id}: Fixed ${validation.issues.length} prompt issues: ${validation.issues.join('; ')}`);
			}

			// 4. Gemini — generate fixed images with reference images and retry logic
			this.generationGateway.emitProgress(user_id, {
				job_id: new_ad_id,
				step: 'generating_images',
				message: 'Generating fixed images...',
				progress_percent: 35,
			});

			// Build reference images from snapshots
			const referenceImages = [
				productSnapshot.photo_url,
				brandSnapshot.logo_url,
			].filter(Boolean);
			this.logger.log(`Fix-errors: sending ${referenceImages.length} reference images to Gemini`);

			// Build brand color description for prompts
			const brandColorDesc = this.buildBrandColorDescription(brandSnapshot as Brand);
			const basePrompt = validation.cleanedPrompt;

			// Generate all 3 ratios with retry logic
			const [result1x1, result9x16, result16x9] = await Promise.all([
				this.geminiService.generateImageWithRetry(
					`${basePrompt}\nCOLOR PALETTE TO MATCH EXACTLY: ${brandColorDesc}`,
					referenceImages, '1:1', `fix-${new_ad_id}/1:1`,
				),
				this.geminiService.generateImageWithRetry(
					`${basePrompt}\nCRITICAL: MAINTAIN IDENTICAL colors.\nCOLOR PALETTE TO MATCH EXACTLY: ${brandColorDesc}`,
					referenceImages, '9:16', `fix-${new_ad_id}/9:16`,
				),
				this.geminiService.generateImageWithRetry(
					`${basePrompt}\nCRITICAL: MAINTAIN IDENTICAL colors.\nCOLOR PALETTE TO MATCH EXACTLY: ${brandColorDesc}`,
					referenceImages, '16:9', `fix-${new_ad_id}/16:9`,
				),
			]);

			// 5. Upload
			this.generationGateway.emitProgress(user_id, {
				job_id: new_ad_id,
				step: 'uploading',
				message: 'Saving fixed images...',
				progress_percent: 65,
			});

			const imageUrls: Record<string, string> = {};
			const uploadTasks: Promise<void>[] = [];

			if (result1x1.data) {
				uploadTasks.push(
					this.storageService.uploadImage(user_id, new_ad_id, '1x1', Buffer.from(result1x1.data, 'base64'))
						.then((url) => { imageUrls['1x1'] = url; })
						.catch((err) => { this.logger.error(`Fix upload 1x1 failed: ${err.message}`); }),
				);
			}
			if (result9x16.data) {
				uploadTasks.push(
					this.storageService.uploadImage(user_id, new_ad_id, '9x16', Buffer.from(result9x16.data, 'base64'))
						.then((url) => { imageUrls['9x16'] = url; })
						.catch((err) => { this.logger.warn(`Fix upload 9x16 failed: ${err.message}`); }),
				);
			}
			if (result16x9.data) {
				uploadTasks.push(
					this.storageService.uploadImage(user_id, new_ad_id, '16x9', Buffer.from(result16x9.data, 'base64'))
						.then((url) => { imageUrls['16x9'] = url; })
						.catch((err) => { this.logger.warn(`Fix upload 16x9 failed: ${err.message}`); }),
				);
			}

			await Promise.all(uploadTasks);

			if (Object.keys(imageUrls).length === 0) {
				throw new Error('All fix-errors image generations failed — no images to save');
			}

			// 6. Ad copy
			const adCopyJson = {
				headline: claudeResponse.headline,
				subheadline: claudeResponse.subheadline,
				body_text: claudeResponse.body_text,
				callout_texts: claudeResponse.callout_texts,
				cta_text: claudeResponse.cta_text,
			};

			// 7. DB update
			this.generationGateway.emitProgress(user_id, {
				job_id: new_ad_id,
				step: 'saving',
				message: 'Natijalar saqlanmoqda...',
				progress_percent: 85,
			});

			const { error: updateError } = await this.databaseService.client
				.from('generated_ads')
				.update({
					claude_response_json: claudeResponse,
					gemini_prompt: claudeResponse.gemini_image_prompt,
					image_url_1x1: imageUrls['1x1'] || null,
					image_url_9x16: imageUrls['9x16'] || null,
					image_url_16x9: imageUrls['16x9'] || null,
					ad_copy_json: adCopyJson,
					generation_status: GenerationStatus.COMPLETED,
					ad_name: `[Fixed] Ad`,
					brand_snapshot: brandSnapshot,
				})
				.eq('_id', new_ad_id);

			if (updateError) {
				throw new Error(`Failed to update fix-errors ad: ${updateError.message}`);
			}

			// 8. WebSocket
			this.generationGateway.emitCompleted(user_id, {
				job_id: new_ad_id,
				ad_id: new_ad_id,
				image_url: imageUrls['1x1'] || Object.values(imageUrls)[0] || '',
			});

			this.logger.log(`Fix-errors completed: ${new_ad_id} (${Object.keys(imageUrls).length} images)`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.error(`Fix-errors failed: ${new_ad_id} — ${message}`);

			await this.updateAdStatus(new_ad_id, GenerationStatus.FAILED);

			this.generationGateway.emitFailed(user_id, {
				job_id: new_ad_id,
				error: message,
			});

			throw error;
		}
	}
}
