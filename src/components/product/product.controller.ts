import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ProductService } from './product.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { CreateProductDto } from '../../libs/dto/product/create-product.dto';
import { Product } from '../../libs/types/product/product.type';
import { Member } from '../../libs/types/member/member.type';

@Controller('product')
export class ProductController {
	constructor(private readonly productService: ProductService) {}

	// createProduct
	@UseGuards(AuthGuard)
	@Post('createProduct')
	public async createProduct(
		@Body() input: CreateProductDto,
		@AuthMember() authMember: Member,
	): Promise<Product> {
		return this.productService.createProduct(input, authMember);
	}
}
