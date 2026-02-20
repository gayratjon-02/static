import { IsEnum, IsIn, IsNotEmpty, IsString } from 'class-validator';

export enum BillingInterval {
    MONTHLY = 'monthly',
    ANNUAL = 'annual',
}

export class CreateCheckoutDto {
    @IsNotEmpty()
    @IsString()
    @IsIn(['starter', 'pro', 'growth'], { message: 'Invalid tier. Allowed: starter, pro, growth' })
    tier: string;

    @IsNotEmpty()
    @IsEnum(BillingInterval)
    billing_interval: BillingInterval;
}
