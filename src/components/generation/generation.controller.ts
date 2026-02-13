import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { GenerationService } from './generation.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CreditsGuard } from '../auth/guards/credits.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { RequireCredits } from '../auth/decorators/credits.decorator';
import { CreateGenerationDto } from '../../libs/dto/generation/create-generation.dto';
import { Member } from '../../libs/types/member/member.type';
import { Generation } from '../../libs/types/generation/generation.type';

@Controller('generation')
export class GenerationController {
	constructor(private readonly generationService: GenerationService) {}

	@UseGuards(AuthGuard, CreditsGuard)
	@RequireCredits(5)
	@Post('createGeneration')
	public async createGeneration(
		@Body() input: CreateGenerationDto,
		@AuthMember() authMember: Member,
	):Promise<Generation> {
		return this.generationService.createGeneration(input, authMember);
	}
}
