import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DatabaseService } from '../../database/database.service';
import { ClaudeService } from '../../libs/services/claude.service';
import { GeminiService, GeneratedImage, ReferenceImageMeta } from '../../libs/services/gemini.service';
import { StorageService } from '../../libs/services/storage.service';
import { PromptValidatorService } from '../../libs/services/prompt-validator.service';
import { GenerationRulesService } from '../../libs/services/generation-rules.service';
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
		private generationRules: GenerationRulesService,
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

			// Debug: log brand data to help diagnose brand name issues
			this.logger.log(`=== BRAND DEBUG === name: "${brand.name}" | logo_url: "${(brand.logo_url || '').substring(0, 80)}" | industry: "${brand.industry}" ===`);

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

			// 4.5. Dynamic rules validation — CTA, banned claims, word limits
			const rulesValidation = this.generationRules.validateAdCopy(claudeResponse, brand, product);
			if (!rulesValidation.valid) {
				this.logger.warn(`Generation ${generated_ad_id}: Rules violations: ${rulesValidation.errors.join('; ')}`);
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

			// ✅ Check for concept image content leaking into ad copy
			const relevanceCheck = this.promptValidator.validateAdCopyRelevance(
				claudeResponse,
				{ name: product.name, description: product.description, usps: product.usps, ingredients_features: product.ingredients_features },
				{ name: brand.name, industry: brand.industry },
			);
			if (!relevanceCheck.isClean) {
				this.logger.warn(`Generation ${generated_ad_id}: Concept content leak detected: ${relevanceCheck.warnings.join('; ')}`);
			}

			// ✅ Simplify difficult words (double-letter words → simpler synonyms)
			// Applied to all text fields before Gemini sees them
			if (claudeResponse.headline) {
				claudeResponse.headline = this.promptValidator.simplifyDifficultWords(claudeResponse.headline);
			}
			if (claudeResponse.subheadline) {
				claudeResponse.subheadline = this.promptValidator.simplifyDifficultWords(claudeResponse.subheadline);
			}
			if (claudeResponse.cta_text) {
				claudeResponse.cta_text = this.promptValidator.simplifyDifficultWords(claudeResponse.cta_text);
			}
			if (Array.isArray(claudeResponse.callout_texts)) {
				claudeResponse.callout_texts = claudeResponse.callout_texts.map(
					(t: string) => this.promptValidator.simplifyDifficultWords(t),
				);
				// ✅ Enforce strict 4-word limit on review cards (prevents garbled trailing words)
				claudeResponse.callout_texts = this.promptValidator.enforceWordLimit(claudeResponse.callout_texts, 4);
				// ✅ Validate badge text — shorten 3+ word badges to 2 words (prevents merged badges like "60 Time Setup")
				claudeResponse.callout_texts = this.promptValidator.validateBadgeText(claudeResponse.callout_texts);
			}

			// Use cleaned prompt (hex codes stripped, typos fixed)
			// Simplify difficult words in the Gemini prompt itself
			let cleanedPrompt = this.promptValidator.simplifyDifficultWords(validation.cleanedPrompt);

			// Prepend brand name override — ensures Gemini uses the actual brand,
			// not any brand name visible in concept reference images
			const brandOverride = `═══ HIGHEST PRIORITY — BRAND NAME ═══\nTHE BRAND NAME IS: "${brand.name}"\nSPELL IT: ${brand.name.split('').join(' - ')}\n\nRULES:\n- Display "${brand.name}" as the brand name in the ad — this is NOT negotiable\n- The brand logo text must read "${brand.name}" — NOT any text from the logo image\n- If the logo image shows "GlowVita", "PREMIUM SKINCARE", or ANY other brand name — IGNORE IT\n- The logo image may contain a placeholder brand name — always override with "${brand.name}"\n- If ANY reference image shows a different brand name, IGNORE it and use "${brand.name}"\n═══════════════════════════════════════\n\n`;
			const productContext = this.buildProductContext(brand, product);
			const textSpec = this.buildTextRenderingSpec(claudeResponse);
			const basePrompt = brandOverride + productContext + textSpec + cleanedPrompt;

			// Build brand color description for ratio-specific prompts
			const brandColorDesc = this.buildBrandColorDescription(brand);

			// Ratio-specific prompts with color preservation instructions
			// Brand name reminder appended at END of each prompt (recency bias — models pay more attention to end of prompt)
			const brandReminder = `\nREMINDER: The brand name is "${brand.name}" — display it clearly. Do NOT use any other brand name from reference images.`;
			const prompt1x1 = `${basePrompt}\n\nASPECT RATIO: Square format. This is the base design format.\nCOLOR PALETTE TO MATCH EXACTLY: ${brandColorDesc}${brandReminder}`;
			const prompt9x16 = `${basePrompt}\n\nASPECT RATIO: Vertical/Stories format. Stack elements vertically — product in middle, text at top, CTA at bottom. More vertical whitespace between elements.\nCRITICAL: MAINTAIN IDENTICAL colors, mood, and style as the square version.\nCOLOR PALETTE TO MATCH EXACTLY: ${brandColorDesc}${brandReminder}`;
			const prompt16x9 = `${basePrompt}\n\nASPECT RATIO: Horizontal/Landscape format. Side-by-side layout — text on one side, product on the other. Single line headlines preferred.\nCRITICAL: MAINTAIN IDENTICAL colors, mood, and style as the square version.\nCOLOR PALETTE TO MATCH EXACTLY: ${brandColorDesc}${brandReminder}`;

			// Build product-only images (front + back + references) for Claude analysis
			const productImageUrls = [
				product.photo_url,
				product.back_image_url,
				...(product.reference_image_urls ?? []),
			].filter(Boolean);

			// Full reference images for Gemini: product images + logo + concept
			const referenceImages = [
				...productImageUrls,
				brand.logo_url,
				concept.image_url,
			].filter(Boolean);

			const imageMeta: ReferenceImageMeta = {
				productImageCount: productImageUrls.length,
				hasLogo: !!brand.logo_url,
				hasConcept: !!concept.image_url,
			};

			this.logger.log(`Sending ${referenceImages.length} reference images to Gemini (product: ${productImageUrls.length}, logo: ${!!brand.logo_url}, concept: ${!!concept.image_url})`);

			let productDescription = job.data.product_description ?? '';
			if (!productDescription && productImageUrls.length > 0) {
				try {
					productDescription = await this.claudeService.analyzeProductImages(productImageUrls);
				} catch (err: unknown) {
					const errMsg = err instanceof Error ? err.message : String(err);
					this.logger.warn(`Product image analysis failed: ${errMsg} — proceeding without analysis`);
				}
			}

			// Generate all 3 ratios in parallel with retry logic (3 attempts each)
			const [result1x1, result9x16, result16x9] = await Promise.all([
				this.geminiService.generateImageWithRetry(prompt1x1, referenceImages, '1:1', `${generated_ad_id}/1:1`, productDescription, imageMeta),
				this.geminiService.generateImageWithRetry(prompt9x16, referenceImages, '9:16', `${generated_ad_id}/9:16`, productDescription, imageMeta),
				this.geminiService.generateImageWithRetry(prompt16x9, referenceImages, '16:9', `${generated_ad_id}/16:9`, productDescription, imageMeta),
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

	/**
	 * Build product context block — tells Gemini what this ad is for,
	 * preventing content cross-contamination from concept reference images.
	 */
	private buildProductContext(brand: Brand, product: Product): string {
		const lines: string[] = [
			'═══ PRODUCT CONTEXT ═══',
			`This ad is for: ${product.name} by ${brand.name}`,
			`Product description: ${(product.description || '').substring(0, 200)}`,
			'',
			'ALL content in this ad must be relevant to the product above.',
			'If the concept reference image shows a DIFFERENT product (different name, different category, different claims) — DO NOT copy any of that content.',
			'The concept image is for LAYOUT/STYLE reference ONLY — its text, product imagery, and claims belong to a different product.',
			'Render ONLY the text provided in the TEXT RENDERING REQUIREMENTS section below.',
			'═══════════════════════',
			'',
		];
		return lines.join('\n');
	}

	/**
	 * Build explicit text rendering specification from Claude's ad copy.
	 * Lists every text string with word counts — Gemini copies these character-by-character.
	 * Includes line-split formatting for longer text to prevent word duplication at line breaks.
	 */
	private buildTextRenderingSpec(claudeResponse: ClaudeResponseJson): string {
		const lines: string[] = [
			'═══ CONCEPT IMAGE TEXT BLOCKER ═══',
			'The concept reference image contains text for a DIFFERENT product/brand.',
			'DO NOT reproduce ANY text you see in the concept reference image.',
			'If you see review cards, brand names, product names, or slogans in the concept image — IGNORE ALL OF THEM.',
			'ONLY render the text explicitly listed below in the PERMITTED TEXTS section.',
			'Any text not listed below is FORBIDDEN and must NOT appear in the image.',
			'',
			'===== PERMITTED TEXTS (render ONLY these) =====',
			'Copy these strings EXACTLY, character by character. Do NOT paraphrase, abbreviate, or re-spell any word.',
			'NEVER render the same word twice in a row (e.g. "both both" is WRONG).',
			'',
		];

		if (claudeResponse.headline) {
			const wc = this.countWords(claudeResponse.headline);
			lines.push(`HEADLINE TEXT (${wc} words): "${claudeResponse.headline}"`);
		}
		if (claudeResponse.subheadline) {
			const wc = this.countWords(claudeResponse.subheadline);
			lines.push(`SUBHEADLINE TEXT (${wc} words): "${claudeResponse.subheadline}"`);
		}
		if (claudeResponse.cta_text) {
			const wc = this.countWords(claudeResponse.cta_text);
			lines.push(`CTA BUTTON TEXT (${wc} words): "${claudeResponse.cta_text}"`);
		}
		if (claudeResponse.callout_texts?.length > 0) {
			const count = claudeResponse.callout_texts.length;
			// Get hardcoded reviewer names for review-length callouts
			const reviewerNames = this.promptValidator.getReviewerNames(count);
			let reviewNameIdx = 0;

			lines.push(`TEXT ELEMENTS: Render EXACTLY ${count} elements — not more, not less.`);
			lines.push(`Each element is INDEPENDENT — do NOT merge or combine text from different elements.`);
			lines.push(`Each element must have DIFFERENT text. Do NOT duplicate any element.`);
			lines.push('');
			claudeResponse.callout_texts.forEach((callout, i) => {
				const wc = this.countWords(callout);
				lines.push(`--- ELEMENT ${i + 1} of ${count} START ---`);
				if (wc <= 2) {
					// Short text = badge/icon format
					lines.push(`Type: BADGE (small icon)`);
					lines.push(`Text: "${callout}"`);
					lines.push(`RULES: Render ONLY these ${wc} word(s). Do NOT add words from other badges.`);
				} else {
					// Review card or callout — attach a hardcoded reviewer name
					const name = reviewerNames[reviewNameIdx % reviewerNames.length];
					reviewNameIdx++;
					lines.push(`Type: REVIEW CARD (${wc} words)`);
					lines.push(`Text: "${callout}"`);
					lines.push(`Reviewer: "${name}" — spell this name EXACTLY as shown`);
					lines.push(`RULES: Render ONLY this text and name. Do NOT copy text from the concept image.`);
				}
				lines.push(`--- ELEMENT ${i + 1} of ${count} END ---`);
				lines.push('');
			});

			lines.push('REVIEWER NAMES — use ONLY these names (short, common, easy to spell):');
			const usedNames = reviewerNames.slice(0, reviewNameIdx);
			usedNames.forEach(n => lines.push(`  "${n}" — spell exactly as shown`));
			lines.push('Do NOT invent or modify any reviewer name. Do NOT use names from the concept image.');
			lines.push('');
		}

		// Collect spelling hints for all text fields (words 7+ characters)
		const allTextForHints = [
			claudeResponse.headline,
			claudeResponse.subheadline,
			claudeResponse.cta_text,
			...(claudeResponse.callout_texts || []),
		].filter(Boolean).join(' ');
		const spellingHints = this.promptValidator.addSpellingHints(allTextForHints);
		if (spellingHints) {
			lines.push(spellingHints);
		}

		lines.push('===== END OF PERMITTED TEXTS =====');
		lines.push('');
		lines.push('Any text not listed above is FORBIDDEN. Do not add, invent, or copy text from any reference image.');
		lines.push('CRITICAL: Every text element above MUST be spelled EXACTLY as shown in the quotes.');
		lines.push('Word counts are provided — the rendered text must have EXACTLY that many words, no more, no fewer.');
		lines.push('If you cannot render a word correctly, OMIT the word entirely rather than misspell it.');
		lines.push('NEVER duplicate any word — "both both", "my my", "the the" are WRONG.');
		lines.push('NEVER duplicate any review card — each card must have unique text.');
		lines.push('═══════════════════════════════════');
		lines.push('');

		return lines.join('\n');
	}

	/**
	 * Count words in a text string.
	 */
	private countWords(text: string): number {
		return text.split(/\s+/).filter(w => w.length > 0).length;
	}

	/**
	 * Split text into balanced lines for image rendering.
	 * Prevents word duplication at line breaks by keeping lines short and even.
	 */
	private splitIntoRenderLines(text: string, maxWordsPerLine: number = 5): string[] {
		const words = text.split(/\s+/).filter(w => w.length > 0);
		const lines: string[] = [];
		for (let i = 0; i < words.length; i += maxWordsPerLine) {
			lines.push(words.slice(i, i + maxWordsPerLine).join(' '));
		}
		return lines;
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

			const brandSnapshot = originalAd.brand_snapshot || {};
			const productSnapshot = originalAd.product_snapshot || {};

			// Dynamic rules validation on fix-errors output
			const fixRulesValidation = this.generationRules.validateAdCopy(
				claudeResponse,
				brandSnapshot as Brand,
				productSnapshot as Product,
			);
			if (!fixRulesValidation.valid) {
				this.logger.warn(`Fix-errors ${new_ad_id}: Rules violations: ${fixRulesValidation.errors.join('; ')}`);
			}

			// ✅ Validate and clean Claude's fix-errors output
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

			// ✅ Check for concept content leak in fix-errors
			const relevanceCheckFix = this.promptValidator.validateAdCopyRelevance(
				claudeResponse,
				{ name: (productSnapshot as any).name || '', description: (productSnapshot as any).description, usps: (productSnapshot as any).usps, ingredients_features: (productSnapshot as any).ingredients_features },
				{ name: (brandSnapshot as any).name || '', industry: (brandSnapshot as any).industry },
			);
			if (!relevanceCheckFix.isClean) {
				this.logger.warn(`Fix-errors ${new_ad_id}: Concept content leak detected: ${relevanceCheckFix.warnings.join('; ')}`);
			}

			// 4. Gemini — generate fixed images with reference images and retry logic
			this.generationGateway.emitProgress(user_id, {
				job_id: new_ad_id,
				step: 'generating_images',
				message: 'Generating fixed images...',
				progress_percent: 35,
			});

			// Build product-only images from snapshots (front + back + references)
			const productImageUrls = [
				productSnapshot.photo_url,
				(productSnapshot as Product).back_image_url,
				...((productSnapshot as Product).reference_image_urls ?? []),
			].filter(Boolean);

			const referenceImages = [
				...productImageUrls,
				brandSnapshot.logo_url,
			].filter(Boolean);

			const imageMeta: ReferenceImageMeta = {
				productImageCount: productImageUrls.length,
				hasLogo: !!brandSnapshot.logo_url,
				hasConcept: false,
			};

			this.logger.log(`Fix-errors: sending ${referenceImages.length} reference images to Gemini (product: ${productImageUrls.length}, logo: ${!!brandSnapshot.logo_url})`);

			let productDescription = '';
			if (productImageUrls.length > 0) {
				try {
					productDescription = await this.claudeService.analyzeProductImages(productImageUrls);
				} catch (err: unknown) {
					const errMsg = err instanceof Error ? err.message : String(err);
					this.logger.warn(`Fix-errors image analysis failed: ${errMsg} — proceeding without analysis`);
				}
			}

			// ✅ Simplify difficult words + enforce word limit (fix-errors flow)
			if (claudeResponse.headline) {
				claudeResponse.headline = this.promptValidator.simplifyDifficultWords(claudeResponse.headline);
			}
			if (claudeResponse.subheadline) {
				claudeResponse.subheadline = this.promptValidator.simplifyDifficultWords(claudeResponse.subheadline);
			}
			if (claudeResponse.cta_text) {
				claudeResponse.cta_text = this.promptValidator.simplifyDifficultWords(claudeResponse.cta_text);
			}
			if (Array.isArray(claudeResponse.callout_texts)) {
				claudeResponse.callout_texts = claudeResponse.callout_texts.map(
					(t: string) => this.promptValidator.simplifyDifficultWords(t),
				);
				claudeResponse.callout_texts = this.promptValidator.enforceWordLimit(claudeResponse.callout_texts, 4);
				claudeResponse.callout_texts = this.promptValidator.validateBadgeText(claudeResponse.callout_texts);
			}
			let cleanedPromptFix = this.promptValidator.simplifyDifficultWords(validation.cleanedPrompt);

			// Build brand color description for prompts
			const brandColorDesc = this.buildBrandColorDescription(brandSnapshot as Brand);
			const brandName = (brandSnapshot as any).name || '';
			const brandOverrideFix = brandName ? `═══ HIGHEST PRIORITY — BRAND NAME ═══\nTHE BRAND NAME IS: "${brandName}"\nSPELL IT: ${brandName.split('').join(' - ')}\n- Display "${brandName}" as the brand name — NOT any text from the logo image\n- If the logo image shows a different brand name — IGNORE IT, use "${brandName}"\n═══════════════════════════════════════\n\n` : '';
			const productContext = this.buildProductContext(brandSnapshot as Brand, productSnapshot as Product);
			const textSpec = this.buildTextRenderingSpec(claudeResponse);
			const basePrompt = brandOverrideFix + productContext + textSpec + cleanedPromptFix;

			// Generate all 3 ratios with retry logic
			const [result1x1, result9x16, result16x9] = await Promise.all([
				this.geminiService.generateImageWithRetry(
					`${basePrompt}\nCOLOR PALETTE TO MATCH EXACTLY: ${brandColorDesc}`,
					referenceImages, '1:1', `fix-${new_ad_id}/1:1`, productDescription, imageMeta,
				),
				this.geminiService.generateImageWithRetry(
					`${basePrompt}\nCRITICAL: MAINTAIN IDENTICAL colors.\nCOLOR PALETTE TO MATCH EXACTLY: ${brandColorDesc}`,
					referenceImages, '9:16', `fix-${new_ad_id}/9:16`, productDescription, imageMeta,
				),
				this.geminiService.generateImageWithRetry(
					`${basePrompt}\nCRITICAL: MAINTAIN IDENTICAL colors.\nCOLOR PALETTE TO MATCH EXACTLY: ${brandColorDesc}`,
					referenceImages, '16:9', `fix-${new_ad_id}/16:9`, productDescription, imageMeta,
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
