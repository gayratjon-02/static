import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class FulfillCanvaOrderDto {
    @IsString()
    @IsNotEmpty()
    canva_link: string;
}
