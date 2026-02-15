import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DatabaseService } from '../../database/database.service';
import { ClaudeService } from '../../libs/services/claude.service';
import { GeminiService, GeneratedImage } from '../../libs/services/gemini.service';
import { StorageService } from '../../libs/services/storage.service';
import { GenerationGateway } from '../../socket/generation.gateway';
import { GenerationJobData, FixErrorsJobData, ClaudeResponseJson } from '../../libs/types/generation/generation.type';
import { GenerationStatus } from '../../libs/enums/generation/generation.enum';
import { Brand } from '../../libs/types/brand/brand.type';
import { Product } from '../../libs/types/product/product.type';
import { AdConcept } from '../../libs/types/concept/concept.type';

@Processor('generation')
export class GenerationProcessor extends WorkerHost {
	private readonly logger = new Logger('GenerationProcessor');

	constructor(
		private claudeService: ClaudeService,
		private geminiService: GeminiService,
		private storageService: StorageService,
		private databaseService: DatabaseService,
		private generationGateway: GenerationGateway,
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
		const { user_id, brand_id, product_id, concept_id, important_notes, generated_ad_id } = job.data;

		this.logger.log(`Processing generation job: ${generated_ad_id}`);

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

			if (adRecord.generation_status !== GenerationStatus.PENDING) {
				throw new Error(`Invalid job state: ad ${generated_ad_id} is already ${adRecord.generation_status}`);
			}

			// 2. Status → processing
			await this.updateAdStatus(generated_ad_id, GenerationStatus.PROCESSING);

			// 3. DB'dan brand, product, concept olish
			this.generationGateway.emitProgress(user_id, {
				job_id: generated_ad_id,
				step: 'fetching_data',
				message: 'Ma\'lumotlar yuklanmoqda...',
				progress_percent: 5,
			});

			const [brand, product, concept] = await Promise.all([
				this.fetchBrand(brand_id),
				this.fetchProduct(product_id),
				this.fetchConcept(concept_id),
			]);

			// 4. Claude API — ad copy generation
			this.generationGateway.emitProgress(user_id, {
				job_id: generated_ad_id,
				step: 'generating_copy',
				message: 'AI ad copy is generating...',
				progress_percent: 15,
			});

			const claudeResponse: ClaudeResponseJson = await this.claudeService.generateAdCopy(
				brand,
				product,
				concept,
				important_notes || '',
			);

			// 5. Gemini API — 3 ta ratio uchun rasm generatsiya (parallel)
			this.generationGateway.emitProgress(user_id, {
				job_id: generated_ad_id,
				step: 'generating_images',
				message: '3  image is being generated (1x1, 9x16, 16x9)...',
				progress_percent: 35,
			});

			const brandColors = {
				primary: brand.primary_color,
				secondary: brand.secondary_color,
				accent: brand.accent_color,
				background: brand.background_color,
			};

			const generatedImages: GeneratedImage[] = await this.geminiService.generateAllRatios(
				claudeResponse.gemini_image_prompt,
				brandColors,
			);

			// 6. Supabase Storage'ga yuklash (parallel)
			this.generationGateway.emitProgress(user_id, {
				job_id: generated_ad_id,
				step: 'uploading',
				message: `${generatedImages.length} ta rasm saqlanmoqda...`,
				progress_percent: 65,
			});

			const imageUrls: Record<string, string> = {};

			const uploadResults = await Promise.allSettled(
				generatedImages.map(async (img) => {
					const ratioKey = img.ratio.replace(':', 'x');
					const url = await this.storageService.uploadImage(
						user_id,
						generated_ad_id,
						ratioKey,
						img.buffer,
					);
					imageUrls[ratioKey] = url;
				}),
			);

			for (const result of uploadResults) {
				if (result.status === 'rejected') {
					this.logger.error(`Upload failed: ${result.reason?.message}`);
				}
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
			this.logger.error(`Generation failed: ${generated_ad_id} — ${error.message}`);

			await this.updateAdStatus(generated_ad_id, GenerationStatus.FAILED);

			this.generationGateway.emitFailed(user_id, {
				job_id: generated_ad_id,
				error: error.message,
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

			// 2. Original ad'dan ma'lumotlarni olish
			this.generationGateway.emitProgress(user_id, {
				job_id: new_ad_id,
				step: 'fetching_data',
				message: 'Original ad ma\'lumotlari yuklanmoqda...',
				progress_percent: 5,
			});

			const { data: originalAd, error: adError } = await this.databaseService.client
				.from('generated_ads')
				.select('claude_response_json, brand_id, brand_snapshot')
				.eq('_id', original_ad_id)
				.single();

			if (adError || !originalAd) {
				throw new Error(`Original ad not found: ${original_ad_id}`);
			}

			// 3. Claude API — fix errors
			this.generationGateway.emitProgress(user_id, {
				job_id: new_ad_id,
				step: 'fixing_copy',
				message: 'AI xatolarni tuzatmoqda...',
				progress_percent: 15,
			});

			const claudeResponse: ClaudeResponseJson = await this.claudeService.fixAdErrors(
				originalAd.claude_response_json as ClaudeResponseJson,
				error_description,
			);

			// 4. Gemini — yangi rasmlar
			this.generationGateway.emitProgress(user_id, {
				job_id: new_ad_id,
				step: 'generating_images',
				message: 'Tuzatilgan rasmlar generatsiya qilinmoqda...',
				progress_percent: 35,
			});

			const brandSnapshot = originalAd.brand_snapshot || {};
			const brandColors = {
				primary: brandSnapshot.primary_color || '#000000',
				secondary: brandSnapshot.secondary_color || '#333333',
				accent: brandSnapshot.accent_color || '#666666',
				background: brandSnapshot.background_color || '#ffffff',
			};

			const generatedImages = await this.geminiService.generateAllRatios(
				claudeResponse.gemini_image_prompt,
				brandColors,
			);

			// 5. Upload
			this.generationGateway.emitProgress(user_id, {
				job_id: new_ad_id,
				step: 'uploading',
				message: 'Rasmlar saqlanmoqda...',
				progress_percent: 65,
			});

			const imageUrls: Record<string, string> = {};

			const uploadResults = await Promise.allSettled(
				generatedImages.map(async (img) => {
					const ratioKey = img.ratio.replace(':', 'x');
					const url = await this.storageService.uploadImage(
						user_id,
						new_ad_id,
						ratioKey,
						img.buffer,
					);
					imageUrls[ratioKey] = url;
				}),
			);

			for (const result of uploadResults) {
				if (result.status === 'rejected') {
					this.logger.error(`Upload failed: ${result.reason?.message}`);
				}
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
			this.logger.error(`Fix-errors failed: ${new_ad_id} — ${error.message}`);

			await this.updateAdStatus(new_ad_id, GenerationStatus.FAILED);

			this.generationGateway.emitFailed(user_id, {
				job_id: new_ad_id,
				error: error.message,
			});

			throw error;
		}
	}
}
