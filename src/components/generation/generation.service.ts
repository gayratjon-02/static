import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';
import { ClaudeService } from '../../libs/services/claude.service';
import { CreateGenerationDto } from '../../libs/dto/generation/create-generation.dto';
import { GetGenerationsDto } from '../../libs/dto/generation/get-generations.dto';
import { FixErrorsDto } from '../../libs/dto/generation/fix-errors.dto';
import { Message } from '../../libs/enums/common.enum';
import { GenerationStatus } from '../../libs/enums/generation/generation.enum';
import { Member } from '../../libs/types/member/member.type';
import { Generation, GenerationJobData, GenerationStatusResponse, GenerationResultsResponse, FixErrorsJobData, ExportRatiosResponse } from '../../libs/types/generation/generation.type';

const GENERATION_CREDIT_COST = 5;
const FIX_ERRORS_CREDIT_COST = 2;
const REGENERATE_CREDIT_COST = 2;

@Injectable()
export class GenerationService {
	private readonly logger = new Logger('GenerationService');

	constructor(
		private databaseService: DatabaseService,
		private claudeService: ClaudeService,
		@InjectQueue('generation') private generationQueue: Queue,
	) { }

	public async createGeneration(input: CreateGenerationDto, authMember: Member): Promise<Generation> {
		const { brand_id, product_id, concept_id, important_notes } = input;

		try {
			// 1. Check brand existence and ownership
			const { data: brand, error: brandError } = await this.databaseService.client
				.from('brands')
				.select('_id')
				.eq('_id', brand_id)
				.eq('user_id', authMember._id)
				.single();

			if (brandError || !brand) {
				throw new BadRequestException(Message.BRAND_NOT_FOUND);
			}

			// 2. Check product existence and belonging to brand
			const { data: product, error: productError } = await this.databaseService.client
				.from('products')
				.select('_id')
				.eq('_id', product_id)
				.eq('brand_id', brand_id)
				.single();

			if (productError || !product) {
				throw new BadRequestException(Message.PRODUCT_NOT_FOUND);
			}

			// 3. Check concept existence
			const { data: concept, error: conceptError } = await this.databaseService.client
				.from('ad_concepts')
				.select('_id')
				.eq('_id', concept_id)
				.eq('is_active', true)
				.single();

			if (conceptError || !concept) {
				throw new BadRequestException(Message.CONCEPT_NOT_FOUND);
			}

			// 4. Batch creation (6 variations)
			const batchId = uuidv4();
			const variations = Array.from({ length: 6 }).map((_, i) => ({
				user_id: authMember._id,
				brand_id: brand_id,
				product_id: product_id,
				concept_id: concept_id,
				important_notes: important_notes || '',
				claude_response_json: {},
				gemini_prompt: '',
				ad_copy_json: {},
				generation_status: GenerationStatus.PENDING,
				batch_id: batchId,
				variation_index: i,
			}));

			const { data: generatedAds, error: insertError } = await this.databaseService.client
				.from('generated_ads')
				.insert(variations)
				.select('_id');

			if (insertError || !generatedAds || generatedAds.length === 0) {
				this.logger.error(`Failed to create generated ads batch: ${JSON.stringify(insertError)}`);
				throw new InternalServerErrorException(Message.CREATE_FAILED);
			}

			// 5. Credit yechish (direct query)
			const { data: userData, error: userError } = await this.databaseService.client
				.from('users')
				.select('credits_used, credits_limit, addon_credits_remaining')
				.eq('_id', authMember._id)
				.single();

			if (userError || !userData) {
				await this.databaseService.client.from('generated_ads').delete().in('_id', generatedAds.map(a => a._id));
				throw new BadRequestException(Message.SOMETHING_WENT_WRONG);
			}

			const creditsRemaining =
				(userData.credits_limit - userData.credits_used) + (userData.addon_credits_remaining || 0);

			if (creditsRemaining < GENERATION_CREDIT_COST) {
				await this.databaseService.client.from('generated_ads').delete().in('_id', generatedAds.map(a => a._id));
				throw new BadRequestException(Message.INSUFFICIENT_CREDITS);
			}

			const newCreditsUsed = userData.credits_used + GENERATION_CREDIT_COST;

			const { error: updateCreditError } = await this.databaseService.client
				.from('users')
				.update({ credits_used: newCreditsUsed })
				.eq('_id', authMember._id);

			if (updateCreditError) {
				await this.databaseService.client.from('generated_ads').delete().in('_id', generatedAds.map(a => a._id));
				throw new BadRequestException(Message.SOMETHING_WENT_WRONG);
			}

			// 6. Write to credit_transactions table (if table exists)
			await this.databaseService.client.from('credit_transactions').insert({
				user_id: authMember._id,
				credits_amount: -GENERATION_CREDIT_COST,
				transaction_type: 'generation',
				reference_id: batchId, // Use batch_id as reference
				reference_type: 'generated_ad_batch',
				balance_before: creditsRemaining,
				balance_after: creditsRemaining - GENERATION_CREDIT_COST,
			}).then(({ error }) => {
				if (error) this.logger.warn(`credit_transactions insert failed (non-blocking): ${error.message}`);
			});

			// 7. Claude API — get 6 variations in one call (optimization)
			this.logger.log(`Fetching brand/product/concept for Claude pre-generation...`);
			const [brandData, productData, conceptData] = await Promise.all([
				this.databaseService.client.from('brands').select('*').eq('_id', brand_id).single(),
				this.databaseService.client.from('products').select('*').eq('_id', product_id).single(),
				this.databaseService.client.from('ad_concepts').select('*').eq('_id', concept_id).single(),
			]);

			let claudeVariations: any[] = [];
			try {
				this.logger.log(`Calling Claude for 6 variations (single request)...`);
				const claudeResult = await this.claudeService.generate6Variations(
					brandData.data,
					productData.data,
					conceptData.data,
					important_notes || '',
				);
				claudeVariations = claudeResult.variations;
				this.logger.log(`Claude returned ${claudeVariations.length} variations`);

				if (claudeResult.claude_usage) {
					const { input_tokens, output_tokens } = claudeResult.claude_usage;
					// Claude Sonnet 4.5: $3/M input + $15/M output tokens
					const claudeCost = (input_tokens * 3 + output_tokens * 15) / 1_000_000;
					// Imagen 4.0: ~$0.04 per image — 6 variations × 3 ratios = 18 images max
					const imagenEstimate = 6 * 3 * 0.04;
					this.logger.log(
						`💰 Batch ${batchId} cost estimate — Claude: $${claudeCost.toFixed(4)} (${input_tokens}in + ${output_tokens}out tokens) | Imagen: ~$${imagenEstimate.toFixed(2)} | Total: ~$${(claudeCost + imagenEstimate).toFixed(2)}`,
					);
				}
			} catch (claudeErr) {
				this.logger.warn(`Claude pre-generation failed, jobs will call Claude individually: ${claudeErr.message}`);
			}

			// 8. Add jobs to BullMQ queue (6 jobs, each with Claude variation)
			const jobs = generatedAds.map((ad, i) => ({
				name: 'create-ad',
				data: {
					user_id: authMember._id,
					brand_id,
					product_id,
					concept_id,
					important_notes: important_notes || '',
					generated_ad_id: ad._id,
					batch_id: batchId,
					variation_index: i,
					claude_variation: claudeVariations[i] || undefined,
				},
				opts: {
					removeOnComplete: true,
					removeOnFail: false,
				},
			}));

			await this.generationQueue.addBulk(jobs);

			this.logger.log(`Generation batch queued: ${batchId} (${generatedAds.length} variations, claude pre-generated: ${claudeVariations.length > 0})`);

			// 8. Response qaytarish
			return {
				job_id: batchId, // Returning batch_id as job_id for frontend compatibility
				batch_id: batchId,
				status: GenerationStatus.PENDING,
				message: Message.GENERATION_STARTED,
			};
		} catch (err) {
			throw err;
		}
	}

	public async cancelBatch(batchId: string, authMember: Member): Promise<{ cancelled: number }> {
		const { data, error } = await this.databaseService.client
			.from('generated_ads')
			.update({ generation_status: GenerationStatus.CANCELLED })
			.eq('batch_id', batchId)
			.eq('user_id', authMember._id)
			.in('generation_status', [GenerationStatus.PENDING, GenerationStatus.PROCESSING])
			.select('_id');

		if (error) {
			this.logger.error(`cancelBatch failed: ${error.message}`);
			return { cancelled: 0 };
		}

		const count = data?.length || 0;
		this.logger.log(`Batch ${batchId} cancelled — ${count} ad(s) marked as cancelled`);
		return { cancelled: count };
	}

	public async getBatchStatus(batchId: string, authMember: Member): Promise<import('../../libs/types/generation/generation.type').GenerationBatchResponse> {
		const { data, error } = await this.databaseService.client
			.from('generated_ads')
			.select('_id, generation_status, image_url_1x1, image_url_9x16, image_url_16x9, ad_copy_json, ad_name, created_at')
			.eq('batch_id', batchId)
			.eq('user_id', authMember._id)
			.order('variation_index', { ascending: true });

		if (error || !data || data.length === 0) {
			// Fallback: Check if validation failed or just not found
			throw new BadRequestException(Message.GENERATION_NOT_FOUND);
		}

		// Calculate overall status
		const allDone = data.every(d => d.generation_status === GenerationStatus.COMPLETED || d.generation_status === GenerationStatus.FAILED);
		const status = allDone ? GenerationStatus.COMPLETED : GenerationStatus.PROCESSING;

		return {
			batch_id: batchId,
			status,
			variations: data as any[],
		};
	}

	public async getStatus(jobId: string, authMember: Member): Promise<GenerationStatusResponse> {
		const { data, error } = await this.databaseService.client
			.from('generated_ads')
			.select('_id, generation_status, image_url_1x1, image_url_9x16, image_url_16x9, ad_copy_json, ad_name, created_at')
			.eq('_id', jobId)
			.eq('user_id', authMember._id)
			.single();

		if (error || !data) {
			throw new BadRequestException(Message.GENERATION_NOT_FOUND);
		}

		return data as GenerationStatusResponse;
	}

	public async getResults(jobId: string, authMember: Member): Promise<GenerationResultsResponse> {
		const { data, error } = await this.databaseService.client
			.from('generated_ads')
			.select('_id, generation_status, important_notes, image_url_1x1, image_url_9x16, image_url_16x9, ad_copy_json, ad_name, is_saved, is_favorite, brand_snapshot, product_snapshot, created_at')
			.eq('_id', jobId)
			.eq('user_id', authMember._id)
			.single();

		if (error || !data) {
			throw new BadRequestException(Message.GENERATION_NOT_FOUND);
		}

		if (data.generation_status !== GenerationStatus.COMPLETED) {
			throw new BadRequestException(Message.GENERATION_NOT_COMPLETED);
		}

		return data as GenerationResultsResponse;
	}

	public async fixErrors(adId: string, input: FixErrorsDto, authMember: Member): Promise<Generation> {
		// 1. Get and validate original ad
		const { data: originalAd, error: adError } = await this.databaseService.client
			.from('generated_ads')
			.select('_id, user_id, brand_id, product_id, concept_id, claude_response_json, gemini_prompt, generation_status')
			.eq('_id', adId)
			.eq('user_id', authMember._id)
			.single();

		if (adError || !originalAd) {
			throw new BadRequestException(Message.GENERATION_NOT_FOUND);
		}

		if (originalAd.generation_status !== GenerationStatus.COMPLETED) {
			throw new BadRequestException(Message.GENERATION_NOT_COMPLETED);
		}

		// 2. Check and deduct credit
		const { data: userData, error: userError } = await this.databaseService.client
			.from('users')
			.select('credits_used, credits_limit, addon_credits_remaining')
			.eq('_id', authMember._id)
			.single();

		if (userError || !userData) {
			throw new BadRequestException(Message.SOMETHING_WENT_WRONG);
		}

		const creditsRemaining =
			(userData.credits_limit - userData.credits_used) + (userData.addon_credits_remaining || 0);

		if (creditsRemaining < FIX_ERRORS_CREDIT_COST) {
			throw new BadRequestException(Message.INSUFFICIENT_CREDITS);
		}

		// 3. Create new generated_ads row (fix version)
		const { data: newAd, error: insertError } = await this.databaseService.client
			.from('generated_ads')
			.insert({
				user_id: authMember._id,
				brand_id: originalAd.brand_id,
				product_id: originalAd.product_id,
				concept_id: originalAd.concept_id,
				important_notes: `[FIX] ${input.error_description || 'General fix'}`,
				claude_response_json: {},
				gemini_prompt: '',
				ad_copy_json: {},
				generation_status: GenerationStatus.PENDING,
			})
			.select('_id')
			.single();

		if (insertError || !newAd) {
			this.logger.error(`Failed to create fix-errors ad: ${insertError?.message}`);
			throw new InternalServerErrorException(Message.CREATE_FAILED);
		}

		// 4. Credit yechish
		const { error: updateCreditError } = await this.databaseService.client
			.from('users')
			.update({ credits_used: userData.credits_used + FIX_ERRORS_CREDIT_COST })
			.eq('_id', authMember._id);

		if (updateCreditError) {
			await this.databaseService.client.from('generated_ads').delete().eq('_id', newAd._id);
			throw new BadRequestException(Message.SOMETHING_WENT_WRONG);
		}

		// 5. Write to credit_transactions
		await this.databaseService.client.from('credit_transactions').insert({
			user_id: authMember._id,
			credits_amount: -FIX_ERRORS_CREDIT_COST,
			transaction_type: 'fix_errors',
			reference_id: newAd._id,
			reference_type: 'generated_ad',
			balance_before: creditsRemaining,
			balance_after: creditsRemaining - FIX_ERRORS_CREDIT_COST,
		}).then(({ error }) => {
			if (error) this.logger.warn(`credit_transactions insert failed (non-blocking): ${error.message}`);
		});

		// 6. BullMQ queue'ga fix-errors job qo'shish
		const jobData: FixErrorsJobData = {
			user_id: authMember._id,
			original_ad_id: adId,
			new_ad_id: newAd._id,
			error_description: input.error_description || '',
		};

		await this.generationQueue.add('fix-errors', jobData, {
			removeOnComplete: true,
			removeOnFail: false,
		});

		this.logger.log(`Fix-errors job queued: ${newAd._id} (original: ${adId})`);

		return {
			job_id: newAd._id,
			batch_id: newAd._id, // Single item acts as its own batch
			status: GenerationStatus.PENDING,
			message: Message.GENERATION_STARTED,
		};
	}

	public async regenerateSingle(adId: string, authMember: Member): Promise<Generation> {
		// 1. Get and validate original ad
		const { data: originalAd, error: adError } = await this.databaseService.client
			.from('generated_ads')
			.select('_id, user_id, brand_id, product_id, concept_id, important_notes, generation_status')
			.eq('_id', adId)
			.eq('user_id', authMember._id)
			.single();

		if (adError || !originalAd) {
			throw new BadRequestException(Message.GENERATION_NOT_FOUND);
		}

		if (originalAd.generation_status !== GenerationStatus.COMPLETED) {
			throw new BadRequestException(Message.GENERATION_NOT_COMPLETED);
		}

		// 2. Check credit
		const { data: userData, error: userError } = await this.databaseService.client
			.from('users')
			.select('credits_used, credits_limit, addon_credits_remaining')
			.eq('_id', authMember._id)
			.single();

		if (userError || !userData) {
			throw new BadRequestException(Message.SOMETHING_WENT_WRONG);
		}

		const creditsRemaining =
			(userData.credits_limit - userData.credits_used) + (userData.addon_credits_remaining || 0);

		if (creditsRemaining < REGENERATE_CREDIT_COST) {
			throw new BadRequestException(Message.INSUFFICIENT_CREDITS);
		}

		// 3. Yangi generated_ads row
		const { data: newAd, error: insertError } = await this.databaseService.client
			.from('generated_ads')
			.insert({
				user_id: authMember._id,
				brand_id: originalAd.brand_id,
				product_id: originalAd.product_id,
				concept_id: originalAd.concept_id,
				important_notes: originalAd.important_notes || '',
				claude_response_json: {},
				gemini_prompt: '',
				ad_copy_json: {},
				generation_status: GenerationStatus.PENDING,
			})
			.select('_id')
			.single();

		if (insertError || !newAd) {
			this.logger.error(`Failed to create regenerate ad: ${insertError?.message}`);
			throw new InternalServerErrorException(Message.CREATE_FAILED);
		}

		// 4. Credit yechish
		const { error: updateCreditError } = await this.databaseService.client
			.from('users')
			.update({ credits_used: userData.credits_used + REGENERATE_CREDIT_COST })
			.eq('_id', authMember._id);

		if (updateCreditError) {
			await this.databaseService.client.from('generated_ads').delete().eq('_id', newAd._id);
			throw new BadRequestException(Message.SOMETHING_WENT_WRONG);
		}

		// 5. credit_transactions
		await this.databaseService.client.from('credit_transactions').insert({
			user_id: authMember._id,
			credits_amount: -REGENERATE_CREDIT_COST,
			transaction_type: 'regenerate_single',
			reference_id: newAd._id,
			reference_type: 'generated_ad',
			balance_before: creditsRemaining,
			balance_after: creditsRemaining - REGENERATE_CREDIT_COST,
		}).then(({ error }) => {
			if (error) this.logger.warn(`credit_transactions insert failed (non-blocking): ${error.message}`);
		});

		// 6. BullMQ — create-ad job (huddi yangi generation kabi)
		const jobData: GenerationJobData = {
			user_id: authMember._id,
			brand_id: originalAd.brand_id,
			product_id: originalAd.product_id,
			concept_id: originalAd.concept_id,
			important_notes: originalAd.important_notes || '',
			generated_ad_id: newAd._id,
		};

		await this.generationQueue.add('create-ad', jobData, {
			removeOnComplete: true,
			removeOnFail: false,
		});

		this.logger.log(`Regenerate-single job queued: ${newAd._id} (original: ${adId})`);

		return {
			job_id: newAd._id,
			batch_id: newAd._id, // Single item acts as its own batch
			status: GenerationStatus.PENDING,
			message: Message.GENERATION_STARTED,
		};
	}

	public async exportRatios(adId: string, authMember: Member): Promise<ExportRatiosResponse> {
		const { data, error } = await this.databaseService.client
			.from('generated_ads')
			.select('_id, ad_name, generation_status, image_url_1x1, image_url_9x16, image_url_16x9')
			.eq('_id', adId)
			.eq('user_id', authMember._id)
			.single();

		if (error || !data) {
			throw new BadRequestException(Message.GENERATION_NOT_FOUND);
		}

		if (data.generation_status !== GenerationStatus.COMPLETED) {
			throw new BadRequestException(Message.GENERATION_NOT_COMPLETED);
		}

		return {
			_id: data._id,
			ad_name: data.ad_name,
			ratios: [
				{ ratio: '1:1', label: 'Feed (1080×1080)', image_url: data.image_url_1x1 },
				{ ratio: '9:16', label: 'Story / Reel (1080×1920)', image_url: data.image_url_9x16 },
				{ ratio: '16:9', label: 'Landscape (1920×1080)', image_url: data.image_url_16x9 },
			],
		};
	}

	/** Get image URL for download (ownership verified) */
	public async getImageUrl(adId: string, authMember: Member): Promise<string | null> {
		const { data, error } = await this.databaseService.client
			.from('generated_ads')
			.select('image_url_1x1')
			.eq('_id', adId)
			.eq('user_id', authMember._id)
			.single();

		if (error || !data) return null;
		return data.image_url_1x1 || null;
	}

	/** Get image URL for a specific ratio (ownership verified) */
	public async getImageUrlByRatio(adId: string, ratio: string, authMember: Member): Promise<{ url: string | null; adName: string | null }> {
		const { data, error } = await this.databaseService.client
			.from('generated_ads')
			.select('ad_name, image_url_1x1, image_url_9x16, image_url_16x9')
			.eq('_id', adId)
			.eq('user_id', authMember._id)
			.single();

		if (error || !data) return { url: null, adName: null };

		const urlMap: Record<string, string | null> = {
			'1x1': data.image_url_1x1 || null,
			'9x16': data.image_url_9x16 || null,
			'16x9': data.image_url_16x9 || null,
		};

		return { url: urlMap[ratio] ?? null, adName: data.ad_name || null };
	}

	public async getRecent(authMember: Member, limit: number = 6) {
		const { data, error } = await this.databaseService.client
			.from('generated_ads')
			.select('_id, ad_name, image_url_1x1, created_at, brand_id, concept_id')
			.eq('user_id', authMember._id)
			.eq('generation_status', GenerationStatus.COMPLETED)
			.order('created_at', { ascending: false })
			.limit(limit);

		if (error) throw new InternalServerErrorException(Message.SOMETHING_WENT_WRONG);
		if (!data || data.length === 0) return [];

		// Fetch brand names & concept names
		const brandIds = [...new Set(data.map(d => d.brand_id))];
		const conceptIds = [...new Set(data.map(d => d.concept_id))];

		const [brandsRes, conceptsRes] = await Promise.all([
			this.databaseService.client.from('brands').select('_id, name').in('_id', brandIds),
			this.databaseService.client.from('ad_concepts').select('_id, name').in('_id', conceptIds),
		]);

		const brandMap = new Map(brandsRes.data?.map(b => [b._id, b.name]));
		const conceptMap = new Map(conceptsRes.data?.map(c => [c._id, c.name]));

		return data.map(ad => ({
			_id: ad._id,
			ad_name: ad.ad_name,
			image_url: ad.image_url_1x1,
			created_at: ad.created_at,
			brand_name: brandMap.get(ad.brand_id) || 'Unknown Brand',
			concept_name: conceptMap.get(ad.concept_id) || 'Unknown Concept',
		}));
	}
	public async findAll(query: GetGenerationsDto, authMember: Member) {
		const { page = 1, limit = 50, search, brand_id, product_id, concept_id, sort_by } = query;
		const offset = (page - 1) * limit;

		let queryBuilder = this.databaseService.client
			.from('generated_ads')
			.select('_id, ad_name, image_url_1x1, created_at, brand_id, concept_id, product_id, generation_status, is_favorite, is_saved', { count: 'exact' })
			.eq('user_id', authMember._id)
			.eq('generation_status', GenerationStatus.COMPLETED);

		// Filters
		if (brand_id) queryBuilder = queryBuilder.eq('brand_id', brand_id);
		if (product_id) queryBuilder = queryBuilder.eq('product_id', product_id);
		if (concept_id) queryBuilder = queryBuilder.eq('concept_id', concept_id);
		if (search) queryBuilder = queryBuilder.ilike('ad_name', `%${search}%`);

		// Sorting
		if (sort_by === 'oldest') {
			queryBuilder = queryBuilder.order('created_at', { ascending: true });
		} else if (sort_by === 'brand') {
			// Brand sorting is complex without join, fallback to created_at or needs advanced query
			// For now, let's keep it simple or implement in-memory sort if list is small, 
			// but better to default to created_at desc if unknown
			queryBuilder = queryBuilder.order('created_at', { ascending: false });
		} else {
			// Default newest
			queryBuilder = queryBuilder.order('created_at', { ascending: false });
		}

		// Pagination
		const { data, error, count } = await queryBuilder.range(offset, offset + limit - 1);

		if (error) throw new InternalServerErrorException(Message.SOMETHING_WENT_WRONG);
		if (!data || data.length === 0) return { list: [], total: 0 };

		// Fetch related data
		const brandIds = [...new Set(data.map(d => d.brand_id))];
		const productIds = [...new Set(data.map(d => d.product_id))];
		const conceptIds = [...new Set(data.map(d => d.concept_id))];

		const [brandsRes, productsRes, conceptsRes, canvaRes] = await Promise.all([
			this.databaseService.client.from('brands').select('_id, name, primary_color').in('_id', brandIds),
			this.databaseService.client.from('products').select('_id, name').in('_id', productIds),
			this.databaseService.client.from('ad_concepts').select('_id, name').in('_id', conceptIds),
			this.databaseService.client.from('canva_orders').select('generated_ad_id, status, canva_link').in('generated_ad_id', data.map(d => d._id)),
		]);

		const brandMap = new Map(brandsRes.data?.map(b => [b._id, { name: b.name, color: b.primary_color || '#3ECFCF' }]));
		const productMap = new Map(productsRes.data?.map(p => [p._id, p.name]));
		const conceptMap = new Map(conceptsRes.data?.map(c => [c._id, c.name]));
		const canvaMap = new Map(canvaRes.data?.map(o => [o.generated_ad_id, o]));

		const list = data.map(ad => {
			const brand = brandMap.get(ad.brand_id);
			return {
				_id: ad._id,
				name: ad.ad_name,
				image: ad.image_url_1x1,
				created_at: ad.created_at,
				brand_name: brand?.name || 'Unknown',
				brand_color: brand?.color || '#3ECFCF',
				product_name: productMap.get(ad.product_id) || 'Unknown',
				concept_name: conceptMap.get(ad.concept_id) || 'Unknown',
				ratios: ['1:1', '9:16', '16:9'], // Assuming all are generated
				canva_status: canvaMap.get(ad._id)?.status || 'none',
				canva_link: canvaMap.get(ad._id)?.canva_link || null,
				is_favorite: ad.is_favorite ?? false,
				is_saved: ad.is_saved ?? false,
			};
		});

		return { list, total: count || 0 };
	}

	public async getLibraryCounts(authMember: Member) {
		// 1. Get all brands with counts
		const { data: brands, error: brandError } = await this.databaseService.client
			.from('brands')
			.select('_id, name, primary_color')
			.eq('user_id', authMember._id);

		// 2. Get all products with counts
		const { data: products, error: productError } = await this.databaseService.client
			.from('products')
			.select('_id, name, brand_id')
			.in('brand_id', brands?.map(b => b._id) || []); // Only products for user's brands

		if (brandError || productError) throw new InternalServerErrorException(Message.SOMETHING_WENT_WRONG);

		// 3. Count ads per brand & product
		// Note: Supabase doesn't support complex aggregation in one go easily without RPC. 
		// For now, we'll fetch ad counts with a separate query or GroupBy if possible.
		// Optimized: Get all ads (just IDs) for this user to count in memory if count is < 1000. 
		// For larger datasets, use RPC. Assuming small scale for now (< 10k ads).

		const { data: ads } = await this.databaseService.client
			.from('generated_ads')
			.select('brand_id, product_id')
			.eq('user_id', authMember._id)
			.eq('generation_status', GenerationStatus.COMPLETED);

		const brandCounts: Record<string, number> = {};
		const productCounts: Record<string, number> = {};

		ads?.forEach(ad => {
			brandCounts[ad.brand_id] = (brandCounts[ad.brand_id] || 0) + 1;
			productCounts[ad.product_id] = (productCounts[ad.product_id] || 0) + 1;
		});

		const brandsWithCount = brands?.map(b => ({
			_id: b._id,
			name: b.name,
			color: b.primary_color || '#3ECFCF',
			count: brandCounts[b._id] || 0
		})).filter(b => b.count > 0) || [];

		const productsWithCount = products?.map(p => ({
			_id: p._id,
			name: p.name,
			brand_id: p.brand_id,
			count: productCounts[p._id] || 0
		})).filter(p => p.count > 0) || [];

		return {
			brands: brandsWithCount.sort((a, b) => b.count - a.count),
			products: productsWithCount.sort((a, b) => b.count - a.count),
			total_ads: ads?.length || 0
		};
	}

	public async toggleFavorite(adId: string, authMember: Member): Promise<{ is_favorite: boolean }> {
		const { data: existing, error: fetchErr } = await this.databaseService.client
			.from('generated_ads')
			.select('_id, is_favorite')
			.eq('_id', adId)
			.eq('user_id', authMember._id)
			.single();

		if (fetchErr || !existing) throw new BadRequestException(Message.GENERATION_NOT_FOUND);

		const newVal = !existing.is_favorite;
		const { error: updateErr } = await this.databaseService.client
			.from('generated_ads')
			.update({ is_favorite: newVal })
			.eq('_id', adId)
			.eq('user_id', authMember._id);

		if (updateErr) throw new InternalServerErrorException(Message.SOMETHING_WENT_WRONG);
		return { is_favorite: newVal };
	}

	public async renameAd(adId: string, name: string, authMember: Member): Promise<{ ad_name: string }> {
		if (!name || !name.trim()) throw new BadRequestException('Name cannot be empty');

		const { error } = await this.databaseService.client
			.from('generated_ads')
			.update({ ad_name: name.trim() })
			.eq('_id', adId)
			.eq('user_id', authMember._id);

		if (error) throw new InternalServerErrorException(Message.SOMETHING_WENT_WRONG);
		return { ad_name: name.trim() };
	}

	public async deleteAds(ids: string[], authMember: Member): Promise<{ deleted: number }> {
		if (!ids || ids.length === 0) throw new BadRequestException('No IDs provided');

		const { error, count } = await this.databaseService.client
			.from('generated_ads')
			.delete({ count: 'exact' })
			.in('_id', ids)
			.eq('user_id', authMember._id);

		if (error) throw new InternalServerErrorException(Message.SOMETHING_WENT_WRONG);
		return { deleted: count || ids.length };
	}
}
