import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DatabaseService } from '../../database/database.service';
import { CreateGenerationDto } from '../../libs/dto/generation/create-generation.dto';
import { Message } from '../../libs/enums/common.enum';
import { GenerationStatus } from '../../libs/enums/generation/generation.enum';
import { Member } from '../../libs/types/member/member.type';
import { Generation, GenerationJobData, GenerationStatusResponse, GenerationResultsResponse } from '../../libs/types/generation/generation.type';

const GENERATION_CREDIT_COST = 5;

@Injectable()
export class GenerationService {
	private readonly logger = new Logger('GenerationService');

	constructor(
		private databaseService: DatabaseService,
		@InjectQueue('generation') private generationQueue: Queue,
	) { }

	public async createGeneration(input: CreateGenerationDto, authMember: Member): Promise<Generation> {
		const { brand_id, product_id, concept_id, important_notes } = input;

		try {
			// 1. Brand mavjudligini va ownership tekshirish
			const { data: brand, error: brandError } = await this.databaseService.client
				.from('brands')
				.select('_id')
				.eq('_id', brand_id)
				.eq('user_id', authMember._id)
				.single();

			if (brandError || !brand) {
				throw new BadRequestException(Message.BRAND_NOT_FOUND);
			}

			// 2. Product mavjudligini va brand'ga tegishliligini tekshirish
			const { data: product, error: productError } = await this.databaseService.client
				.from('products')
				.select('_id')
				.eq('_id', product_id)
				.eq('brand_id', brand_id)
				.single();

			if (productError || !product) {
				throw new BadRequestException(Message.PRODUCT_NOT_FOUND);
			}

			// 3. Concept mavjudligini tekshirish
			const { data: concept, error: conceptError } = await this.databaseService.client
				.from('ad_concepts')
				.select('_id')
				.eq('_id', concept_id)
				.eq('is_active', true)
				.single();

			if (conceptError || !concept) {
				throw new BadRequestException(Message.CONCEPT_NOT_FOUND);
			}

			// 4. generated_ads jadvaliga yangi row yaratish (status: pending)
			const { data: generatedAd, error: insertError } = await this.databaseService.client
				.from('generated_ads')
				.insert({
					user_id: authMember._id,
					brand_id: brand_id,
					product_id: product_id,
					concept_id: concept_id,
					important_notes: important_notes || '',
					claude_response_json: {},
					gemini_prompt: '',
					ad_copy_json: {},
					generation_status: GenerationStatus.PENDING,
				})
				.select('_id')
				.single();

			if (insertError || !generatedAd) {
				this.logger.error(`Failed to create generated ad: ${insertError?.message}`);
				throw new InternalServerErrorException(Message.CREATE_FAILED);
			}

			// 5. Credit yechish (direct query)
			const { data: userData, error: userError } = await this.databaseService.client
				.from('users')
				.select('credits_used, credits_limit, addon_credits_remaining')
				.eq('_id', authMember._id)
				.single();

			if (userError || !userData) {
				await this.databaseService.client.from('generated_ads').delete().eq('_id', generatedAd._id);
				throw new BadRequestException(Message.SOMETHING_WENT_WRONG);
			}

			const creditsRemaining =
				(userData.credits_limit - userData.credits_used) + (userData.addon_credits_remaining || 0);

			if (creditsRemaining < GENERATION_CREDIT_COST) {
				await this.databaseService.client.from('generated_ads').delete().eq('_id', generatedAd._id);
				throw new BadRequestException(Message.INSUFFICIENT_CREDITS);
			}

			const newCreditsUsed = userData.credits_used + GENERATION_CREDIT_COST;

			const { error: updateCreditError } = await this.databaseService.client
				.from('users')
				.update({ credits_used: newCreditsUsed })
				.eq('_id', authMember._id);

			if (updateCreditError) {
				await this.databaseService.client.from('generated_ads').delete().eq('_id', generatedAd._id);
				throw new BadRequestException(Message.SOMETHING_WENT_WRONG);
			}

			// 6. credit_transactions jadvaliga yozish (agar jadval mavjud bo'lsa)
			await this.databaseService.client.from('credit_transactions').insert({
				user_id: authMember._id,
				credits_amount: -GENERATION_CREDIT_COST,
				transaction_type: 'generation',
				reference_id: generatedAd._id,
				reference_type: 'generated_ad',
				balance_before: creditsRemaining,
				balance_after: creditsRemaining - GENERATION_CREDIT_COST,
			}).then(({ error }) => {
				if (error) this.logger.warn(`credit_transactions insert failed (non-blocking): ${error.message}`);
			});

			// 7. BullMQ queue'ga job qo'shish
			const jobData: GenerationJobData = {
				user_id: authMember._id,
				brand_id: brand_id,
				product_id: product_id,
				concept_id: concept_id,
				important_notes: important_notes || '',
				generated_ad_id: generatedAd._id,
			};

			await this.generationQueue.add('create-ad', jobData, {
				attempts: 2,
				backoff: {
					type: 'exponential',
					delay: 5000,
				},
				removeOnComplete: true,
				removeOnFail: false,
			});

			this.logger.log(`Generation job queued: ${generatedAd._id}`);

			// 8. Response qaytarish
			return {
				job_id: generatedAd._id,
				status: GenerationStatus.PENDING,
				message: Message.GENERATION_STARTED,
			};
		} catch (err) {
			throw err;
		}
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
}
