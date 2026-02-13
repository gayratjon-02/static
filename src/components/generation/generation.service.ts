import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DatabaseService } from '../../database/database.service';
import { CreateGenerationDto } from '../../libs/dto/generation/create-generation.dto';
import { Message } from '../../libs/enums/common.enum';
import { GenerationStatus } from '../../libs/enums/generation/generation.enum';
import { Member } from '../../libs/types/member/member.type';
import { Generation, GenerationJobData } from '../../libs/types/generation/generation.type';

const GENERATION_CREDIT_COST = 5;

@Injectable()
export class GenerationService {
	private readonly logger = new Logger('GenerationService');

	constructor(
		private databaseService: DatabaseService,
		@InjectQueue('generation') private generationQueue: Queue,
	) {}

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

			// 5. Atomik credit yechish (race condition himoyasi — FOR UPDATE lock)
			const { data: creditResult, error: creditError } = await this.databaseService.client
				.rpc('deduct_credits', {
					p_user_id: authMember._id,
					p_amount: GENERATION_CREDIT_COST,
				});

			if (creditError || !creditResult?.success) {
				// Credit yechilmadi — yaratilgan ad'ni o'chiramiz
				await this.databaseService.client
					.from('generated_ads')
					.delete()
					.eq('_id', generatedAd._id);

				throw new BadRequestException(
					creditResult?.error === 'INSUFFICIENT_CREDITS'
						? Message.INSUFFICIENT_CREDITS
						: Message.SOMETHING_WENT_WRONG,
				);
			}

			// 6. credit_transactions jadvaliga yozish
			await this.databaseService.client
				.from('credit_transactions')
				.insert({
					user_id: authMember._id,
					credits_amount: -GENERATION_CREDIT_COST,
					transaction_type: 'generation',
					reference_id: generatedAd._id,
					reference_type: 'generated_ad',
					balance_before: creditResult.balance_before,
					balance_after: creditResult.balance_after,
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
}
