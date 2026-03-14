import { IsNotEmpty, IsOptional, IsString, IsUUID, IsIn, MaxLength } from 'class-validator';

export class CreateGenerationDto {
	@IsUUID()
	@IsNotEmpty()
	brand_id: string;

	@IsUUID()
	@IsNotEmpty()
	product_id: string;

	@IsUUID()
	@IsNotEmpty()
	concept_id: string;

	@IsString()
	@IsOptional()
	@MaxLength(500)
	important_notes?: string;

	@IsString()
	@IsOptional()
	@IsIn(['1:1', '9:16', '16:9'])
	selected_ratio?: '1:1' | '9:16' | '16:9';
}
