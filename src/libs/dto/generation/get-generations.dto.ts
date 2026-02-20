import { IsOptional, IsString, IsNumber, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetGenerationsDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 50;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsString()
    brand_id?: string;

    @IsOptional()
    @IsString()
    product_id?: string;

    @IsOptional()
    @IsString()
    concept_id?: string;

    @IsOptional()
    @IsString()
    sort_by?: string; // 'newest', 'oldest', 'brand'
}
