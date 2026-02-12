import {
	IsString,
	IsOptional,
	IsEnum,
	IsArray,
	IsUrl,
	MaxLength,
	Matches,
	ArrayMinSize,
} from 'class-validator';
import { BrandIndustry, BrandVoice } from '../../enums/brand/brand.enum';

export class UpdateBrandDto {
	// Step 1: Brand Identity
	@IsString()
	@MaxLength(100)
	@IsOptional()
	name?: string;

	@IsString()
	@MaxLength(500)
	@IsOptional()
	description?: string;

	@IsUrl()
	@IsOptional()
	website_url?: string;

	@IsEnum(BrandIndustry)
	@IsOptional()
	industry?: BrandIndustry;

	// Step 2: Brand Visuals
	@IsString()
	@IsOptional()
	logo_url?: string;

	@IsString()
	@Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'primary_color must be a valid hex color (e.g. #FF5733)' })
	@IsOptional()
	primary_color?: string;

	@IsString()
	@Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'secondary_color must be a valid hex color (e.g. #333333)' })
	@IsOptional()
	secondary_color?: string;

	@IsString()
	@Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'accent_color must be a valid hex color' })
	@IsOptional()
	accent_color?: string;

	@IsString()
	@Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'background_color must be a valid hex color' })
	@IsOptional()
	background_color?: string;

	// Step 3: Brand Voice & Tone
	@IsArray()
	@ArrayMinSize(1)
	@IsEnum(BrandVoice, { each: true })
	@IsOptional()
	voice_tags?: BrandVoice[];

	@IsString()
	@MaxLength(300)
	@IsOptional()
	target_audience?: string;

	@IsString()
	@IsOptional()
	competitors?: string;
}
