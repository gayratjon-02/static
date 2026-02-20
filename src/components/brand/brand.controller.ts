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
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { BrandService } from './brand.service';
import { S3Service } from '../s3/s3.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { CreateBrandDto } from '../../libs/dto/brand/create-brand.dto';
import { UpdateBrandDto } from '../../libs/dto/brand/update-brand.dto';
import { ImportBrandFromUrlDto } from '../../libs/dto/brand/import-brand-from-url.dto';
import { Brand } from '../../libs/types/brand/brand.type';
import { Member } from '../../libs/types/member/member.type';


@Controller('brand')
export class BrandController {
	constructor(
		private readonly brandService: BrandService,
		private readonly s3Service: S3Service,
	) { }

	// getConfig — returns industry/voice lists for dropdowns (no auth needed)
	@Get('config')
	public getConfig() {
		return this.brandService.getConfig();
	}

	// uploadLogo — file upload for brand logo
	@UseGuards(AuthGuard)
	@Post('uploadLogo')
	@UseInterceptors(
		FileInterceptor('logo', {
			storage: memoryStorage(),
			limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
			fileFilter: (_req, file, cb) => {
				console.log('[uploadLogo] fileFilter called:', {
					originalname: file.originalname,
					mimetype: file.mimetype,
					size: file.size,
				});
				const allowed = /\.(png|jpg|jpeg|webp)$/i;
				if (!allowed.test(extname(file.originalname))) {
					console.log('[uploadLogo] ❌ File rejected — invalid extension');
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
		console.log('\n━━━ UPLOAD LOGO ━━━');
		console.log('  user:', authMember?._id);
		console.log('  file exists:', !!file);
		if (file) {
			console.log('  file.originalname:', file.originalname);
			console.log('  file.mimetype:', file.mimetype);
			console.log('  file.size:', file.size, 'bytes', `(${(file.size / 1024).toFixed(1)} KB)`);
			console.log('  file.buffer length:', file.buffer?.length);
		}

		if (!file) {
			console.log('  ❌ No file uploaded');
			throw new BadRequestException('No file uploaded');
		}

		try {
			const key = `brands/${uuidv4()}${extname(file.originalname)}`;
			console.log('  S3 key:', key);
			const logoUrl = await this.s3Service.upload(file.buffer, key, file.mimetype);
			console.log('  ✅ Upload success:', logoUrl);
			return { logo_url: logoUrl };
		} catch (err) {
			const e = err as Error;
			console.error('  ❌ S3 upload error:', e.message);
			throw new BadRequestException(`Logo upload failed: ${e.message}`);
		}
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

	// importFromUrl — extract brand info from a website URL
	@UseGuards(AuthGuard)
	@Post('importFromUrl')
	public async importFromUrl(
		@Body() input: ImportBrandFromUrlDto,
	) {
		return this.brandService.importFromUrl(input.url);
	}
}
