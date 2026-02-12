import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { BrandService } from './brand.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { CreateBrandDto } from '../../libs/dto/brand/create-brand.dto';
import { UpdateBrandDto } from '../../libs/dto/brand/update-brand.dto';
import { Brand } from '../../libs/types/brand/brand.type';
import { Member } from '../../libs/types/member/member.type';

@Controller('brand')
export class BrandController {
	constructor(private readonly brandService: BrandService) {}

	// createBrand
	@UseGuards(AuthGuard)
	@Post('createBrand')
	public async createBrand(
		@Body() input: CreateBrandDto,
		@AuthMember() authMember: Member,
	): Promise<Brand> {
		return this.brandService.createBrand(input, authMember);
	}

	// getBrands — 
	@UseGuards(AuthGuard)
	@Get('getBrands')
	public async getBrands(
		@AuthMember() authMember: Member,
		@Query('page') page: string = '1',
		@Query('limit') limit: string = '10',
	) {
		return this.brandService.getBrands(authMember, +page, +limit);
	}

	// getBrand 
	@UseGuards(AuthGuard)
	@Get('getBrandById/:id')
	public async getBrand(
		@Param('id') id: string,
		@AuthMember() authMember: Member,
	): Promise<Brand> {
		return this.brandService.getBrand(id, authMember);
	}

	// updateBrand
	@UseGuards(AuthGuard)
	@Post('updateBrandById/:id')
	public async updateBrand(
		@Param('id') id: string,
		@Body() input: UpdateBrandDto,
		@AuthMember() authMember: Member,
	): Promise<Brand> {
		return this.brandService.updateBrand(id, input, authMember);
	}

	// deleteBrand
	@UseGuards(AuthGuard)
	@Post('deleteBrandById/:id')
	public async deleteBrand(
		@Param('id') id: string,
		@AuthMember() authMember: Member,
	): Promise<{ message: string }> {
		return this.brandService.deleteBrand(id, authMember);
	}
}
