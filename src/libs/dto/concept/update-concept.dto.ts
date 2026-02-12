import {
	IsString,
	IsOptional,
	IsArray,
	IsBoolean,
	IsEnum,
	IsNumber,
	MaxLength,
	ArrayMinSize,
	Min,
} from 'class-validator';
import { ConceptCategory } from '../../enums/concept/concept.enum';

export class UpdateConceptDto {
	@IsEnum(ConceptCategory)
	@IsOptional()
	category?: ConceptCategory;

	@IsString()
	@IsOptional()
	@MaxLength(255)
	name?: string;

	@IsString()
	@IsOptional()
	image_url?: string;

	@IsArray()
	@IsOptional()
	@ArrayMinSize(1)
	@IsString({ each: true })
	@MaxLength(50, { each: true })
	tags?: string[];

	@IsString()
	@IsOptional()
	@MaxLength(500)
	description?: string;

	@IsString()
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
