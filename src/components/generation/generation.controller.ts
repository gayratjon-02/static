import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { GenerationService } from './generation.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CreditsGuard } from '../auth/guards/credits.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { RequireCredits } from '../auth/decorators/credits.decorator';
import { CreateGenerationDto } from '../../libs/dto/generation/create-generation.dto';
import { FixErrorsDto } from '../../libs/dto/generation/fix-errors.dto';
import { Member } from '../../libs/types/member/member.type';
import { Generation, GenerationStatusResponse, GenerationResultsResponse, ExportRatiosResponse } from '../../libs/types/generation/generation.type';

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

	@UseGuards(AuthGuard)
	@Get('getResults/:jobId')
	public async getResults(
		@Param('jobId') jobId: string,
		@AuthMember() authMember: Member,
	): Promise<GenerationResultsResponse> {
		return this.generationService.getResults(jobId, authMember);
	}

	@UseGuards(AuthGuard, CreditsGuard)
	@RequireCredits(2)
	@Post('fixErrors/:adId')
	public async fixErrors(
		@Param('adId') adId: string,
		@Body() input: FixErrorsDto,
		@AuthMember() authMember: Member,
	): Promise<Generation> {
		return this.generationService.fixErrors(adId, input, authMember);
	}

	@UseGuards(AuthGuard, CreditsGuard)
	@RequireCredits(2)
	@Post('regenerateSingle/:adId')
	public async regenerateSingle(
		@Param('adId') adId: string,
		@AuthMember() authMember: Member,
	): Promise<Generation> {
		return this.generationService.regenerateSingle(adId, authMember);
	}

	@UseGuards(AuthGuard)
	@Post('exportRatios/:adId')
	public async exportRatios(
		@Param('adId') adId: string,
		@AuthMember() authMember: Member,
	): Promise<ExportRatiosResponse> {
		return this.generationService.exportRatios(adId, authMember);
	}
}
