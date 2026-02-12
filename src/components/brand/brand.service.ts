import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateBrandDto } from '../../libs/dto/brand/create-brand.dto';
import { Message } from '../../libs/enums/common.enum';
import { Brand } from '../../libs/types/brand/brand.type';
import { Member } from '../../libs/types/member/member.type';

@Injectable()
export class BrandService {
	constructor(private databaseService: DatabaseService) {}

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

	// getBrands method — foydalanuvchining barcha brandlari
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
}
