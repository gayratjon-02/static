import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

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
	id_token: string;
}
