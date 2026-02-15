import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { GenerationService } from './generation.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CreditsGuard } from '../auth/guards/credits.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { RequireCredits } from '../auth/decorators/credits.decorator';
import { CreateGenerationDto } from '../../libs/dto/generation/create-generation.dto';
import { Member } from '../../libs/types/member/member.type';
import { Generation, GenerationStatusResponse } from '../../libs/types/generation/generation.type';

@Controller('generation')
export class GenerationController {
	constructor(private readonly generationService: GenerationService) { }

	@UseGuards(ThrottlerGuard, AuthGuard, CreditsGuard)
	@Throttle({ default: { ttl: 60000, limit: 3 } })
	@RequireCredits(5)
	@Post('createGeneration')
	public async createGeneration(
		@Body() input: CreateGenerationDto,
		@AuthMember() authMember: Member,
	): Promise<Generation> {
		return this.generationService.createGeneration(input, authMember);
	}

	@UseGuards(AuthGuard)
	@Get('getStatus/:jobId')
	public async getStatus(
		@Param('jobId') jobId: string,
		@AuthMember() authMember: Member,
	): Promise<GenerationStatusResponse> {
		return this.generationService.getStatus(jobId, authMember);
	}
}
