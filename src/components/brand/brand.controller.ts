import {
	Body,
	Controller,
	Get,
	Param,
	Post,
	Query,
	UploadedFile,
	UseGuards,
	UseInterceptors,
	BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { BrandService } from './brand.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { CreateBrandDto } from '../../libs/dto/brand/create-brand.dto';
import { UpdateBrandDto } from '../../libs/dto/brand/update-brand.dto';
import { Brand } from '../../libs/types/brand/brand.type';
import { Member } from '../../libs/types/member/member.type';

// Ensure uploads/brands directory exists
const BRANDS_UPLOAD_DIR = join(process.cwd(), 'uploads', 'brands');
if (!existsSync(BRANDS_UPLOAD_DIR)) {
	mkdirSync(BRANDS_UPLOAD_DIR, { recursive: true });
}

@Controller('brand')
export class BrandController {
	constructor(private readonly brandService: BrandService) { }

	// uploadLogo — file upload for brand logo
	@UseGuards(AuthGuard)
	@Post('uploadLogo')
	@UseInterceptors(
		FileInterceptor('logo', {
			storage: diskStorage({
				destination: (_req, _file, cb) => cb(null, BRANDS_UPLOAD_DIR),
				filename: (_req, file, cb) => {
					const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
					cb(null, uniqueName);
				},
			}),
			limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
			fileFilter: (_req, file, cb) => {
				const allowed = /\.(png|jpg|jpeg|webp)$/i;
				if (!allowed.test(extname(file.originalname))) {
					return cb(new BadRequestException('Only PNG, JPG, JPEG, WEBP files are allowed'), false);
				}
				cb(null, true);
			},
		}),
	)
	public async uploadLogo(
		@UploadedFile() file: Express.Multer.File,
		@AuthMember() authMember: Member,
	) {
		if (!file) {
			throw new BadRequestException('No file uploaded');
		}

		const logoUrl = `/uploads/brands/${file.filename}`;
		return { logo_url: logoUrl };
	}

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

