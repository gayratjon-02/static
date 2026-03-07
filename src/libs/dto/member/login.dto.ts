import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsBoolean } from 'class-validator';

export class LoginDto {
	@IsEmail()
	@IsNotEmpty()
	email: string;

	@IsString()
	@MinLength(6)
	@IsNotEmpty()
	password: string;
}

export class GoogleLoginDto {
	@IsString()
	@IsNotEmpty()
	access_token: string;

	@IsBoolean()
	@IsOptional()
	tos_accepted?: boolean;

	@IsString()
	@IsOptional()
	tos_version?: string;
}
