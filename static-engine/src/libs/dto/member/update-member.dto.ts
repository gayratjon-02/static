import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

export class UpdateMemberDto {
	@IsString()
	@MinLength(2)
	@MaxLength(255)
	@IsOptional()
	full_name?: string;

	@IsString()
	@IsOptional()
	avatar_url?: string;

	@IsString()
	@MinLength(6)
	@MaxLength(50)
	@IsOptional()
	password?: string;
}

export class ForgetPasswordDto {
	@IsString()
	@MinLength(6)
	@MaxLength(50)
	password: string;

	@IsString()
	@MinLength(6)
	@MaxLength(50)
	confirm_password: string;
}
