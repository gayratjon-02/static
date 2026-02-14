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
import { ProductService } from './product.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { CreateProductDto } from '../../libs/dto/product/create-product.dto';
import { UpdateProductDto } from '../../libs/dto/product/update-product.dto';
import { Product } from '../../libs/types/product/product.type';
import { Member } from '../../libs/types/member/member.type';

// Ensure uploads/products directory exists
const PRODUCTS_UPLOAD_DIR = join(process.cwd(), 'uploads', 'products');
if (!existsSync(PRODUCTS_UPLOAD_DIR)) {
	mkdirSync(PRODUCTS_UPLOAD_DIR, { recursive: true });
}

@Controller('product')
export class ProductController {
	constructor(private readonly productService: ProductService) { }

	// uploadPhoto — file upload for product photo
	@UseGuards(AuthGuard)
	@Post('uploadPhoto')
	@UseInterceptors(
		FileInterceptor('photo', {
			storage: diskStorage({
				destination: (_req, _file, cb) => cb(null, PRODUCTS_UPLOAD_DIR),
				filename: (_req, file, cb) => {
					const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
					cb(null, uniqueName);
				},
			}),
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

		const photoUrl = `/uploads/products/${file.filename}`;
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
}

