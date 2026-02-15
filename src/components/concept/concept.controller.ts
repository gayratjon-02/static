import {
	Body,
	Controller,
	Get,
	Param,
	Post,
	Query,
	UploadedFile,
	UseGuards,
	UseInterceptors,
	BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { ConceptService } from './concept.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminRole } from '../../libs/enums/common.enum';
import { CreateConceptDto } from '../../libs/dto/concept/create-concept.dto';
import { UpdateConceptDto } from '../../libs/dto/concept/update-concept.dto';
import { AdConcept } from '../../libs/types/concept/concept.type';

// Ensure uploads/concepts directory exists
const CONCEPTS_UPLOAD_DIR = join(process.cwd(), 'uploads', 'concepts');
if (!existsSync(CONCEPTS_UPLOAD_DIR)) {
	mkdirSync(CONCEPTS_UPLOAD_DIR, { recursive: true });
}

@Controller('concept')
export class ConceptController {
	constructor(private readonly conceptService: ConceptService) { }

	// uploadImage — concept image upload (admin only)
	@UseGuards(RolesGuard)
	@Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_ADMIN)
	@Post('uploadImage')
	@UseInterceptors(
		FileInterceptor('image', {
			storage: diskStorage({
				destination: (_req, _file, cb) => cb(null, CONCEPTS_UPLOAD_DIR),
				filename: (_req, file, cb) => {
					const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
					cb(null, uniqueName);
				},
			}),
			limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
			fileFilter: (_req, file, cb) => {
				const allowed = /\.(png|jpg|jpeg|webp)$/i;
				if (!allowed.test(extname(file.originalname))) {
					return cb(new BadRequestException('Only PNG, JPG, JPEG, WEBP files are allowed'), false);
				}
				cb(null, true);
			},
		}),
	)
	public async uploadImage(
		@UploadedFile() file: Express.Multer.File,
	) {
		if (!file) {
			throw new BadRequestException('No file uploaded');
		}
		const imageUrl = `/uploads/concepts/${file.filename}`;
		return { image_url: imageUrl };
	}

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
		@Query('include_inactive') includeInactive?: string,
	) {
		return this.conceptService.getConcepts(category, search, +page, +limit, includeInactive === 'true');
	}

	// getRecommended — usage_count bo'yicha top 10
	@UseGuards(AuthGuard)
	@Get('getRecommended')
	public async getRecommendedConcepts() {
		return this.conceptService.getRecommendedConcepts();
	}
}
