import {
	IsString,
	IsNotEmpty,
	IsOptional,
	IsEnum,
	IsArray,
	IsUrl,
	MaxLength,
	MinLength,
	Matches,
	ArrayMinSize,
	ArrayMaxSize,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { BrandIndustry, BrandVoice } from '../../enums/brand/brand.enum';

export class CreateBrandDto {
	// Step 1: Brand Identity
	@IsString()
	@IsNotEmpty({ message: 'Brand name is required' })
	@MaxLength(100, { message: 'Brand name must be under 100 characters' })
	@Transform(({ value }) => value?.trim())
	name: string;

	@IsString()
	@IsNotEmpty({ message: 'Brand description is required' })
	@MinLength(10, { message: 'Brand description must be at least 10 characters' })
	@MaxLength(500, { message: 'Brand description must be under 500 characters' })
	description: string;

	@IsUrl({}, { message: 'Please enter a valid website URL (e.g., https://yourbrand.com)' })
	@IsNotEmpty({ message: 'Website URL is required' })
	website_url: string;

	@IsEnum(BrandIndustry, { message: 'Please select a valid industry' })
	@IsNotEmpty({ message: 'Industry is required' })
	industry: BrandIndustry;

	// Step 2: Brand Visuals
	@IsString()
	@IsOptional()
	logo_url?: string;

	@IsString()
	@IsNotEmpty({ message: 'Primary color is required' })
	@Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Primary color must be a valid hex color (e.g. #FF5733)' })
	primary_color: string;

	@IsString()
	@IsNotEmpty({ message: 'Secondary color is required' })
	@Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Secondary color must be a valid hex color (e.g. #333333)' })
	secondary_color: string;

	@IsString()
	@IsOptional()
	@Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Accent color must be a valid hex color' })
	accent_color?: string;

	@IsString()
	@IsOptional()
	@Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Background color must be a valid hex color' })
	background_color?: string;

	// Step 3: Brand Voice & Tone
	@IsArray({ message: 'Voice tags must be an array' })
	@ArrayMinSize(1, { message: 'Please select at least one voice/tone option' })
	@ArrayMaxSize(5, { message: 'Maximum 5 voice/tone options allowed' })
	@IsEnum(BrandVoice, { each: true, message: 'Invalid voice/tone option' })
	voice_tags: BrandVoice[];

	@IsString()
	@IsNotEmpty({ message: 'Target audience is required' })
	@MinLength(5, { message: 'Target audience must be at least 5 characters' })
	@MaxLength(300, { message: 'Target audience must be under 300 characters' })
	target_audience: string;

	@IsString()
	@IsOptional()
	competitors?: string;
}
