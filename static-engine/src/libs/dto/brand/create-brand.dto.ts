import {
	IsString,
	IsNotEmpty,
	IsOptional,
	IsEnum,
	IsArray,
	IsUrl,
	MaxLength,
	Matches,
	ArrayMinSize,
} from 'class-validator';
import { BrandIndustry, BrandVoice } from '../../enums/brand/brand.enum';

export class CreateBrandDto {
	// Step 1: Brand Identity
	@IsString()
	@IsNotEmpty()
	@MaxLength(100)
	name: string;

	@IsString()
	@IsNotEmpty()
	@MaxLength(500)
	description: string;

	@IsUrl()
	@IsNotEmpty()
	website_url: string;

	@IsEnum(BrandIndustry)
	@IsNotEmpty()
	industry: BrandIndustry;

	// Step 2: Brand Visuals
	@IsString()
	@IsOptional()
	logo_url?: string;

	@IsString()
	@IsNotEmpty()
	@Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'primary_color must be a valid hex color (e.g. #FF5733)' })
	primary_color: string;

	@IsString()
	@IsNotEmpty()
	@Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'secondary_color must be a valid hex color (e.g. #333333)' })
	secondary_color: string;

	@IsString()
	@IsOptional()
	@Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'accent_color must be a valid hex color' })
	accent_color?: string;

	@IsString()
	@IsOptional()
	@Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'background_color must be a valid hex color' })
	background_color?: string;

	// Step 3: Brand Voice & Tone
	@IsArray()
	@ArrayMinSize(1)
	@IsEnum(BrandVoice, { each: true })
	voice_tags: BrandVoice[];

	@IsString()
	@IsNotEmpty()
	@MaxLength(300)
	target_audience: string;

	@IsString()
	@IsOptional()
	competitors?: string;
}
