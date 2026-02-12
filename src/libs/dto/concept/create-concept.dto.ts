import {
	IsString,
	IsNotEmpty,
	IsOptional,
	IsArray,
	IsBoolean,
	IsEnum,
	IsUrl,
	IsNumber,
	MaxLength,
	ArrayMinSize,
	Min,
} from 'class-validator';
import { ConceptCategory } from '../../enums/concept/concept.enum';

export class CreateConceptDto {
	@IsEnum(ConceptCategory)
	@IsNotEmpty()
	category: ConceptCategory;

	@IsUrl()
	@IsNotEmpty()
	image_url: string;

	@IsArray()
	@ArrayMinSize(1)
	@IsString({ each: true })
	@MaxLength(50, { each: true })
	tags: string[];

	@IsString()
	@IsNotEmpty()
	@MaxLength(500)
	description: string;

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
