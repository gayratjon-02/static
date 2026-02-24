import {
	Body,
	Controller,
	DefaultValuePipe,
	Get,
	Param,
	ParseIntPipe,
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
import { Message } from '../../libs/enums/common.enum';

@Controller('brand')
export class BrandController {
	constructor(
		private readonly brandService: BrandService,
		private readonly s3Service: S3Service,
	) {}

	// ── PUBLIC ───────────────────────────────────────────────────

	@Get('config')
	getConfig() {
		return this.brandService.getConfig();
	}

	// ── AUTHENTICATED ────────────────────────────────────────────

	@UseGuards(AuthGuard)
	@Post('uploadLogo')
	@UseInterceptors(
		FileInterceptor('logo', {
			storage: memoryStorage(),
			limits: { fileSize: 10 * 1024 * 1024 },
			fileFilter: (_req, file, cb) => {
				const allowed = /\.(png|jpg|jpeg|webp)$/i;
				if (!allowed.test(extname(file.originalname))) {
					return cb(new BadRequestException(Message.PROVIDE_ALLOWED_FORMAT), false);
				}
				cb(null, true);
			},
		}),
	)
	async uploadLogo(
		@UploadedFile() file: Express.Multer.File,
		@AuthMember() authMember: Member,
	): Promise<{ logo_url: string }> {
		console.log('BrandController: uploadLogo');
		if (!file) throw new BadRequestException(Message.UPLOAD_FAILED);

		try {
			const key = `brands/${authMember._id}/${uuidv4()}${extname(file.originalname)}`;
			const logoUrl = await this.s3Service.upload(file.buffer, key, file.mimetype);
			return { logo_url: logoUrl };
		} catch {
			throw new BadRequestException(Message.UPLOAD_FAILED);
		}
	}

	@UseGuards(AuthGuard)
	@Post('createBrand')
	async createBrand(@Body() input: CreateBrandDto, @AuthMember() authMember: Member): Promise<Brand> {
		return this.brandService.createBrand(input, authMember);
	}

	@UseGuards(AuthGuard)
	@Get('getBrands')
	async getBrands(
		@AuthMember() authMember: Member,
		@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
		@Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
	) {
		return this.brandService.getBrands(authMember, page, limit);
	}

	@UseGuards(AuthGuard)
	@Get('getBrandById/:id')
	async getBrand(@Param('id') id: string, @AuthMember() authMember: Member): Promise<Brand> {
		return this.brandService.getBrand(id, authMember);
	}

	@UseGuards(AuthGuard)
	@Post('updateBrandById/:id')
	async updateBrand(
		@Param('id') id: string,
		@Body() input: UpdateBrandDto,
		@AuthMember() authMember: Member,
	): Promise<Brand> {
		return this.brandService.updateBrand(id, input, authMember);
	}

	@UseGuards(AuthGuard)
	@Post('deleteBrandById/:id')
	async deleteBrand(@Param('id') id: string, @AuthMember() authMember: Member): Promise<{ message: string }> {
		return this.brandService.deleteBrand(id, authMember);
	}

	@UseGuards(AuthGuard)
	@Post('importFromUrl')
	async importFromUrl(@Body() input: ImportBrandFromUrlDto) {
		return this.brandService.importFromUrl(input.url);
	}
}
