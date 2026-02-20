import { IsEmail, IsEnum, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { AdminRole } from '../../enums/common.enum';

export class AdminSignupDto {
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
	name: string;

	@IsEnum(AdminRole)
	@IsNotEmpty()
	role: AdminRole;
}
