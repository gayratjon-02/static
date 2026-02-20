import { IsNotEmpty, IsNumber, IsString, IsUUID } from 'class-validator';

export class CreateCanvaOrderDto {
    @IsUUID()
    @IsNotEmpty()
    generated_ad_id: string;

    @IsString()
    @IsNotEmpty()
    stripe_payment_id: string;

    @IsNumber()
    @IsNotEmpty()
    price_paid_cents: number;
}
