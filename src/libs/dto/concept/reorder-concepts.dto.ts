import {
    IsArray,
    ValidateNested,
    IsString,
    IsNotEmpty,
    IsNumber,
    IsUUID,
    Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReorderItem {
    @IsString()
    @IsNotEmpty()
    id: string;

    @IsNumber()
    @Min(0)
    display_order: number;
}

export class ReorderConceptsDto {
    @IsUUID()
    @IsNotEmpty()
    category_id: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ReorderItem)
    items: ReorderItem[];
}
