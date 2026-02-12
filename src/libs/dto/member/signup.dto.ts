import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

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
}
