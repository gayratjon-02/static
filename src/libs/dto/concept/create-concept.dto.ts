import {
	IsString,
	IsNotEmpty,
	IsOptional,
	IsArray,
	IsBoolean,
	IsUUID,
	IsUrl,
	IsNumber,
	MaxLength,
	ArrayMinSize,
	Min,
} from 'class-validator';

export class CreateConceptDto {
	@IsUUID()
	@IsNotEmpty()
	category_id: string;

	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	name: string;

	@IsString()
	@IsNotEmpty()
	image_url: string;

	@IsArray()
	@ArrayMinSize(1)
	@IsString({ each: true })
	@MaxLength(50, { each: true })
	tags: string[];

	@IsString()
	@IsOptional()
	@MaxLength(500)
	description?: string;

	@IsUrl()
	@IsOptional()
	source_url?: string;

	@IsBoolean()
	@IsOptional()
	is_active?: boolean;

	@IsNumber()
	@IsOptional()
	@Min(0)
	display_order?: number;
}
