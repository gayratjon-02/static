import {
	IsString,
	IsOptional,
	IsArray,
	IsBoolean,
	IsNumber,
	IsUrl,
	MaxLength,
	ArrayMinSize,
	ArrayMaxSize,
	Min,
	Max,
} from 'class-validator';

export class UpdateProductDto {
	// Product Info
	@IsString()
	@IsOptional()
	@MaxLength(100)
	name?: string;

	@IsString()
	@IsOptional()
	@MaxLength(500)
	description?: string;

	@IsArray()
	@IsOptional()
	@ArrayMinSize(1)
	@ArrayMaxSize(5)
	@IsString({ each: true })
	@MaxLength(150, { each: true })
	usps?: string[];

	@IsString()
	@IsOptional()
	photo_url?: string;

	@IsBoolean()
	@IsOptional()
	has_physical_product?: boolean;

	// Pricing & URL
	@IsString()
	@IsOptional()
	@MaxLength(50)
	price_text?: string;

	@IsUrl()
	@IsOptional()
	product_url?: string;

	// Social Proof
	@IsNumber()
	@IsOptional()
	@Min(1.0)
	@Max(5.0)
	star_rating?: number;

	@IsNumber()
	@IsOptional()
	@Min(0)
	review_count?: number;

	// Marketing Copy
	@IsString()
	@IsOptional()
	@MaxLength(500)
	ingredients_features?: string;

	@IsString()
	@IsOptional()
	@MaxLength(300)
	before_description?: string;

	@IsString()
	@IsOptional()
	@MaxLength(300)
	after_description?: string;

	@IsString()
	@IsOptional()
	@MaxLength(200)
	offer_text?: string;
}
