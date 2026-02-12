import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ConceptService } from './concept.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminRole } from '../../libs/enums/common.enum';
import { CreateConceptDto } from '../../libs/dto/concept/create-concept.dto';
import { UpdateConceptDto } from '../../libs/dto/concept/update-concept.dto';
import { AdConcept } from '../../libs/types/concept/concept.type';

@Controller('concept')
export class ConceptController {
	constructor(private readonly conceptService: ConceptService) {}

	// createConcept — admin only
	@UseGuards(RolesGuard)
	@Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_ADMIN)
	@Post('createConceptByAdmin')
	public async createConcept(@Body() input: CreateConceptDto): Promise<AdConcept> {
		return this.conceptService.createConcept(input);
	}

	// updateConceptByAdmin — admin only
	@UseGuards(RolesGuard)
	@Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_ADMIN)
	@Post('updateConceptByAdmin/:id')
	public async updateConcept(@Param('id') id: string, @Body() input: UpdateConceptDto): Promise<AdConcept> {
		return this.conceptService.updateConcept(id, input);
	}

	// deleteConceptByAdmin — faqat SUPER_ADMIN
	@UseGuards(RolesGuard)
	@Roles(AdminRole.SUPER_ADMIN)
	@Post('deleteConceptByAdmin/:id')
	public async deleteConcept(@Param('id') id: string): Promise<{ message: string }> {
		return this.conceptService.deleteConcept(id);
	}

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

	// getRecommended — usage_count bo'yicha top 10
	@UseGuards(AuthGuard)
	@Get('getRecommended')
	public async getRecommendedConcepts() {
		return this.conceptService.getRecommendedConcepts();
	}
}
