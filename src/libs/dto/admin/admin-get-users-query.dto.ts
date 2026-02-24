import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class AdminGetUsersQueryDto {
	@IsString()
	@IsOptional()
	search?: string;

	@IsString()
	@IsOptional()
	tier?: string;

	@IsString()
	@IsOptional()
	status?: string;

	@Type(() => Number)
	@IsInt()
	@Min(1)
	@IsOptional()
	page?: number = 1;

	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	@IsOptional()
	limit?: number = 20;
}
