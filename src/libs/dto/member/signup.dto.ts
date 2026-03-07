import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { SubscriptionTier } from '../../enums/common.enum';

export class SignupDto {
	@IsEmail()
	@IsNotEmpty()
	email: string;

	@IsString()
	@MinLength(6)
	@MaxLength(50)
	@IsNotEmpty()
	password: string;

	@IsString()
	@MinLength(2)
	@MaxLength(255)
	@IsNotEmpty()
	full_name: string;

	@IsString()
	@IsOptional()
	avatar_url?: string;

	@IsEnum(SubscriptionTier)
	@IsOptional()
	subscription_tier?: SubscriptionTier;

	@IsNotEmpty()
	tos_accepted: boolean;

	@IsString()
	@IsNotEmpty()
	tos_version: string;
}
