import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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
}
