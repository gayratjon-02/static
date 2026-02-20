import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdatePromptTemplateDto {
    @IsOptional()
    @IsString()
    content?: string;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}
