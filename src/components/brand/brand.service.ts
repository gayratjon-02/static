import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateBrandDto } from '../../libs/dto/brand/create-brand.dto';
import { UpdateBrandDto } from '../../libs/dto/brand/update-brand.dto';
import { Message } from '../../libs/enums/common.enum';
import { BrandIndustry, BrandVoice, INDUSTRY_LABELS, VOICE_LABELS } from '../../libs/enums/brand/brand.enum';
import { T } from '../../libs/types/common';
import { Brand } from '../../libs/types/brand/brand.type';
import { Member } from '../../libs/types/member/member.type';

@Injectable()
export class BrandService {
	constructor(private databaseService: DatabaseService) { }

	/** Returns config lists (industries + voices) for frontend dropdowns */
	public getConfig() {
		const industries = Object.values(BrandIndustry).map((id) => ({
			id,
			label: INDUSTRY_LABELS[id],
		}));

		// Ensure "Other" is always last
		const otherIdx = industries.findIndex((i) => i.id === BrandIndustry.OTHER);
		if (otherIdx > -1) {
			const [other] = industries.splice(otherIdx, 1);
			industries.push(other);
		}

		const voices = Object.values(BrandVoice).map((id) => ({
			id,
			label: VOICE_LABELS[id],
		}));

		return { industries, voices };
	}

	// createBrand method
	public async createBrand(input: CreateBrandDto, authMember: Member): Promise<Brand> {
		const {
			name,
			description,
			website_url,
			industry,
			logo_url,
			primary_color,
			secondary_color,
			accent_color,
			background_color,
			voice_tags,
			target_audience,
			competitors,
		} = input;
		try {
			const { data, error } = await this.databaseService.client
				.from('brands')
				.insert({
					user_id: authMember._id,
					name: name,
					description: description,
					website_url: website_url,
					industry: industry,
					logo_url: logo_url || '',
					primary_color: primary_color,
					secondary_color: secondary_color,
					accent_color: accent_color || '#0066FF',
					background_color: background_color || '#FFFFFF',
					voice_tags: voice_tags,
					target_audience: target_audience,
					competitors: competitors || '',
				})
				.select('*')
				.single();

			if (error || !data) {
				throw new InternalServerErrorException(Message.CREATE_FAILED);
			}

			return data as Brand;
		} catch (err) {
			throw err;
		}
	}

	// getBrands method 
	public async getBrands(authMember: Member, page: number, limit: number) {
		try {
			const offset = (page - 1) * limit;

			// 1. Total count
			const { count, error: countError } = await this.databaseService.client
				.from('brands')
				.select('*', { count: 'exact', head: true })
				.eq('user_id', authMember._id);

			if (countError) {
				throw new InternalServerErrorException(Message.NO_DATA_FOUND);
			}

			// 2. Paginated list
			const { data, error } = await this.databaseService.client
				.from('brands')
				.select('*')
				.eq('user_id', authMember._id)
				.order('created_at', { ascending: false })
				.range(offset, offset + limit - 1);

			if (error) {
				throw new InternalServerErrorException(Message.NO_DATA_FOUND);
			}

			return { list: data as Brand[], total: count || 0 };
		} catch (err) {
			throw err;
		}
	}

	// getBrand method
	public async getBrand(id: string, authMember: Member): Promise<Brand> {
		try {
			const { data, error } = await this.databaseService.client
				.from('brands')
				.select('*')
				.eq('_id', id)
				.eq('user_id', authMember._id)
				.single();

			if (error || !data) {
				throw new InternalServerErrorException(Message.NO_DATA_FOUND);
			}

			return data as Brand;
		} catch (err) {
			throw err;
		}
	}

	// updateBrand method
	public async updateBrand(id: string, input: UpdateBrandDto, authMember: Member): Promise<Brand> {
		try {
			const updateData: T = {};

			const fields = [
				'name', 'description', 'website_url', 'industry',
				'logo_url', 'primary_color', 'secondary_color',
				'accent_color', 'background_color',
				'voice_tags', 'target_audience', 'competitors',
			];

			for (const field of fields) {
				if (input[field] !== undefined) {
					updateData[field] = input[field];
				}
			}

			if (Object.keys(updateData).length === 0) {
				throw new BadRequestException(Message.BAD_REQUEST);
			}

			updateData.updated_at = new Date();

			const { data, error } = await this.databaseService.client
				.from('brands')
				.update(updateData)
				.eq('_id', id)
				.eq('user_id', authMember._id)
				.select('*')
				.single();

			if (error || !data) {
				throw new InternalServerErrorException(Message.UPDATE_FAILED);
			}

			return data as Brand;
		} catch (err) {
			throw err;
		}
	}

	// deleteBrand method
	public async deleteBrand(id: string, authMember: Member): Promise<{ message: string }> {
		try {
			// check existence
			const { data: existing, error: findError } = await this.databaseService.client
				.from('brands')
				.select('_id')
				.eq('_id', id)
				.eq('user_id', authMember._id)
				.single();

			if (findError || !existing) {
				throw new BadRequestException(Message.NO_DATA_FOUND);
			}

			const { error } = await this.databaseService.client
				.from('brands')
				.delete()
				.eq('_id', id)
				.eq('user_id', authMember._id);

			if (error) {
				throw new InternalServerErrorException(Message.REMOVE_FAILED);
			}

			return { message: 'Brand deleted successfully' };
		} catch (err) {
			throw err;
		}
	}
}
