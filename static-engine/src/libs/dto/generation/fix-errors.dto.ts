import { IsOptional, IsString, MaxLength } from 'class-validator';

export class FixErrorsDto {
    @IsString()
    @IsOptional()
    @MaxLength(500)
    error_description?: string;
}
