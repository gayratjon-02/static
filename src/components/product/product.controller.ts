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
import { ProductService } from './product.service';
import { S3Service } from '../s3/s3.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { CreateProductDto } from '../../libs/dto/product/create-product.dto';
import { UpdateProductDto } from '../../libs/dto/product/update-product.dto';
import { Product } from '../../libs/types/product/product.type';
import { Member } from '../../libs/types/member/member.type';

@Controller('product')
export class ProductController {
	constructor(
		private readonly productService: ProductService,
		private readonly s3Service: S3Service,
	) { }

	// uploadPhoto — file upload for product photo
	@UseGuards(AuthGuard)
	@Post('uploadPhoto')
	@UseInterceptors(
		FileInterceptor('photo', {
			storage: memoryStorage(),
			limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
			fileFilter: (_req, file, cb) => {
				const allowed = /\.(png|jpg|jpeg|webp)$/i;
				if (!allowed.test(extname(file.originalname))) {
					return cb(new BadRequestException('Only PNG, JPG, JPEG, WEBP files are allowed'), false);
				}
				cb(null, true);
			},
		}),
	)
	public async uploadPhoto(
		@UploadedFile() file: Express.Multer.File,
		@AuthMember() authMember: Member,
	) {
		if (!file) {
			throw new BadRequestException('No file uploaded');
		}

		const key = `products/${uuidv4()}${extname(file.originalname)}`;
		const photoUrl = await this.s3Service.upload(file.buffer, key, file.mimetype);
		return { photo_url: photoUrl };
	}

	// createProduct
	@UseGuards(AuthGuard)
	@Post('createProduct')
	public async createProduct(
		@Body() input: CreateProductDto,
		@AuthMember() authMember: Member,
	): Promise<Product> {
		return this.productService.createProduct(input, authMember);
	}

	// getProducts — byBrandId with pagination
	@UseGuards(AuthGuard)
	@Get('getProducts/:brandId')
	public async getProducts(
		@Param('brandId') brandId: string,
		@AuthMember() authMember: Member,
		@Query('page') page: string = '1',
		@Query('limit') limit: string = '10',
	) {
		return this.productService.getProducts(brandId, authMember, +page, +limit);
	}

	// getProduct — one product
	@UseGuards(AuthGuard)
	@Get('getProductById/:id')
	public async getProduct(
		@Param('id') id: string,
		@AuthMember() authMember: Member,
	): Promise<Product> {
		return this.productService.getProduct(id, authMember);
	}

	// updateProduct
	@UseGuards(AuthGuard)
	@Post('updateProductById/:id')
	public async updateProduct(
		@Param('id') id: string,
		@Body() input: UpdateProductDto,
		@AuthMember() authMember: Member,
	): Promise<Product> {
		return this.productService.updateProduct(id, input, authMember);
	}

	// deleteProduct
	@UseGuards(AuthGuard)
	@Post('deleteProductById/:id')
	public async deleteProduct(
		@Param('id') id: string,
		@AuthMember() authMember: Member,
	): Promise<{ message: string }> {
		return this.productService.deleteProduct(id, authMember);
	}

	// importFromUrl
	@UseGuards(AuthGuard)
	@Post('importFromUrl')
	public async importFromUrl(
		@Body('url') url: string,
		@AuthMember() authMember: Member,
	) {
		if (!url) throw new BadRequestException('URL is required');
		return this.productService.importFromUrl(url);
	}

	// removeBackground
	@UseGuards(AuthGuard)
	@Post('removeBackground/:id')
	public async removeBackground(
		@Param('id') id: string,
		@AuthMember() authMember: Member,
	) {
		return this.productService.removeBackground(id, authMember, this.s3Service);
	}
}
