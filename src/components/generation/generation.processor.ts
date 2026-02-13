import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DatabaseService } from '../../database/database.service';
import { ClaudeService } from '../../libs/services/claude.service';
import { GeminiService } from '../../libs/services/gemini.service';
import { StorageService } from '../../libs/services/storage.service';
import { GenerationGateway } from '../../socket/generation.gateway';
import { GenerationJobData, ClaudeResponseJson } from '../../libs/types/generation/generation.type';
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

	async process(job: Job<GenerationJobData>): Promise<void> {
		const { user_id, brand_id, product_id, concept_id, important_notes, generated_ad_id } = job.data;

		this.logger.log(`Processing generation job: ${generated_ad_id}`);

		try {
			// 1. Status → processing
			await this.updateAdStatus(generated_ad_id, GenerationStatus.PROCESSING);

			// 2. DB'dan brand, product, concept olish
			this.generationGateway.emitProgress(user_id, {
				job_id: generated_ad_id,
				step: 'fetching_data',
				message: 'Ma\'lumotlar yuklanmoqda...',
				progress_percent: 10,
			});

			const [brand, product, concept] = await Promise.all([
				this.fetchBrand(brand_id),
				this.fetchProduct(product_id),
				this.fetchConcept(concept_id),
			]);

			// 3. Claude API — ad copy generatsiya
			this.generationGateway.emitProgress(user_id, {
				job_id: generated_ad_id,
				step: 'generating_copy',
				message: 'AI reklama matni yozmoqda...',
				progress_percent: 25,
			});

			const claudeResponse: ClaudeResponseJson = await this.claudeService.generateAdCopy(
				brand,
				product,
				concept,
				important_notes || '',
			);

			// 4. Gemini API — rasm generatsiya (1x1)
			this.generationGateway.emitProgress(user_id, {
				job_id: generated_ad_id,
				step: 'generating_image',
				message: 'Rasm generatsiya qilinmoqda...',
				progress_percent: 50,
			});

			const imageBuffer = await this.geminiService.generateImage(
				claudeResponse.gemini_image_prompt,
				{
					primary: brand.primary_color,
					secondary: brand.secondary_color,
					accent: brand.accent_color,
					background: brand.background_color,
				},
			);

			// 5. Supabase Storage'ga yuklash
			this.generationGateway.emitProgress(user_id, {
				job_id: generated_ad_id,
				step: 'uploading',
				message: 'Rasm saqlanmoqda...',
				progress_percent: 75,
			});

			const imageUrl = await this.storageService.uploadImage(
				user_id,
				generated_ad_id,
				'1x1',
				imageBuffer,
			);

			// 6. Ad copy (gemini_image_prompt'siz)
			const adCopyJson = {
				headline: claudeResponse.headline,
				subheadline: claudeResponse.subheadline,
				body_text: claudeResponse.body_text,
				callout_texts: claudeResponse.callout_texts,
				cta_text: claudeResponse.cta_text,
			};

			// 7. generated_ads jadvalini yangilash
			this.generationGateway.emitProgress(user_id, {
				job_id: generated_ad_id,
				step: 'saving',
				message: 'Natijalar saqlanmoqda...',
				progress_percent: 90,
			});

			const { error: updateError } = await this.databaseService.client
				.from('generated_ads')
				.update({
					claude_response_json: claudeResponse,
					gemini_prompt: claudeResponse.gemini_image_prompt,
					image_url_1x1: imageUrl,
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

			// 8. Concept usage_count++
			await this.databaseService.client.rpc('increment_usage_count', {
				concept_id: concept_id,
			}).then(({ error }) => {
				// RPC mavjud bo'lmasa, manual increment
				if (error) {
					return this.databaseService.client
						.from('ad_concepts')
						.update({ usage_count: (concept.usage_count || 0) + 1 })
						.eq('_id', concept_id);
				}
			});

			// 9. WebSocket: tayyor!
			this.generationGateway.emitCompleted(user_id, {
				job_id: generated_ad_id,
				ad_id: generated_ad_id,
				image_url: imageUrl,
			});

			this.logger.log(`Generation completed: ${generated_ad_id}`);
		} catch (error) {
			this.logger.error(`Generation failed: ${generated_ad_id} — ${error.message}`);

			// Status → failed
			await this.updateAdStatus(generated_ad_id, GenerationStatus.FAILED);

			// WebSocket: xato
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
}
