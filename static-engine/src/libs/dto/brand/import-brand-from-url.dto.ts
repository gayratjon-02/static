import { IsNotEmpty, IsUrl } from 'class-validator';

export class ImportBrandFromUrlDto {
    @IsUrl()
    @IsNotEmpty()
    url: string;
}
