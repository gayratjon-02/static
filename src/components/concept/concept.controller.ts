import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ConceptService } from './concept.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('concept')
export class ConceptController {
	constructor(private readonly conceptService: ConceptService) {}

	// getConcepts — concept library
	@UseGuards(AuthGuard)
	@Get('getConcepts')
	public async getConcepts(
		@Query('category') category?: string,
		@Query('search') search?: string,
		@Query('page') page: string = '1',
		@Query('limit') limit: string = '20',
	) {
		return this.conceptService.getConcepts(category, search, +page, +limit);
	}
}
