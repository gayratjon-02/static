import { IsEnum, IsNotEmpty, IsString } from "class-validator";
import { ProductPlans } from "../../config";

export class CreateCheckoutDto {
    @IsNotEmpty()
    @IsString()
    tier: string;

    @IsNotEmpty()
    @IsEnum(ProductPlans)
    plan: ProductPlans;
}