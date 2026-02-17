import {
	Body,
	Controller,
	Get,
	Param,
	Patch,
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
import { ConceptConfigService } from './concept-config.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminRole } from '../../libs/enums/common.enum';
import { CreateConceptDto } from '../../libs/dto/concept/create-concept.dto';
import { UpdateConceptDto } from '../../libs/dto/concept/update-concept.dto';
import { CreateCategoryDto } from '../../libs/dto/concept/create-category.dto';
import { ReorderConceptsDto } from '../../libs/dto/concept/reorder-concepts.dto';
import { AdConcept, ConceptCategoryItem } from '../../libs/types/concept/concept.type';

// Ensure uploads/concepts directory exists
const CONCEPTS_UPLOAD_DIR = join(process.cwd(), 'uploads', 'concepts');
if (!existsSync(CONCEPTS_UPLOAD_DIR)) {
	mkdirSync(CONCEPTS_UPLOAD_DIR, { recursive: true });
}

// Allowed image extensions
const ALLOWED_IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|webp)$/i;
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

@Controller('concept')
export class ConceptController {
	constructor(
		private readonly conceptService: ConceptService,
		private readonly conceptConfig: ConceptConfigService,
	) { }

	// =============================================
	// CONFIG — Public endpoint for frontend
	// =============================================

	/** GET /concept/config — public config (popular threshold, etc.) */
	@UseGuards(AuthGuard)
	@Get('config')
	public getConfig() {
		return this.conceptConfig.getPublicConfig();
	}

	// =============================================
	// CATEGORIES
	// =============================================

	/** GET /concept/getCategories — authenticated, fetch all categories */
	@UseGuards(AuthGuard)
	@Get('getCategories')
	public async getCategories(): Promise<{ list: ConceptCategoryItem[] }> {
		return this.conceptService.getCategories();
	}

	/** POST /concept/createCategoryByAdmin — admin only */
	@UseGuards(RolesGuard)
	@Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_ADMIN)
	@Post('createCategoryByAdmin')
	public async createCategory(@Body() input: CreateCategoryDto): Promise<ConceptCategoryItem> {
		return this.conceptService.createCategory(input);
	}

	// =============================================
	// CONCEPTS — IMAGE UPLOAD
	// =============================================

	/** POST /concept/uploadImage — admin only, upload concept image */
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
				// Validate extension
				if (!ALLOWED_IMAGE_EXTENSIONS.test(extname(file.originalname))) {
					return cb(new BadRequestException('Only PNG, JPG, JPEG, WEBP files are allowed'), false);
				}
				// Validate MIME type
				if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
					return cb(new BadRequestException('Invalid file MIME type'), false);
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

	// =============================================
	// CONCEPTS — CRUD (Admin)
	// =============================================

	/** POST /concept/createConceptByAdmin — admin, create concept */
	@UseGuards(RolesGuard)
	@Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_ADMIN)
	@Post('createConceptByAdmin')
	public async createConcept(@Body() input: CreateConceptDto): Promise<AdConcept> {
		return this.conceptService.createConcept(input);
	}

	/** POST /concept/updateConceptByAdmin/:id — admin, update concept */
	@UseGuards(RolesGuard)
	@Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_ADMIN)
	@Post('updateConceptByAdmin/:id')
	public async updateConcept(@Param('id') id: string, @Body() input: UpdateConceptDto): Promise<AdConcept> {
		return this.conceptService.updateConcept(id, input);
	}

	/** POST /concept/deleteConceptByAdmin/:id — SUPER_ADMIN only, soft delete */
	@UseGuards(RolesGuard)
	@Roles(AdminRole.SUPER_ADMIN)
	@Post('deleteConceptByAdmin/:id')
	public async deleteConcept(@Param('id') id: string): Promise<{ message: string }> {
		return this.conceptService.deleteConcept(id);
	}

	// =============================================
	// CONCEPTS — REORDER (Admin, category-scoped)
	// =============================================

	/** POST /concept/reorderConceptsByAdmin — admin, batch reorder within category */
	@UseGuards(RolesGuard)
	@Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_ADMIN)
	@Post('reorderConceptsByAdmin')
	public async reorderConcepts(@Body() input: ReorderConceptsDto): Promise<{ message: string }> {
		return this.conceptService.reorderConcepts(input);
	}

	// =============================================
	// CONCEPTS — PUBLIC / USER
	// =============================================

	/** GET /concept/getConcepts — concept library with server-side pagination */
	@UseGuards(AuthGuard)
	@Get('getConcepts')
	public async getConcepts(
		@Query('category_id') categoryId?: string,
		@Query('search') search?: string,
		@Query('tags') tags?: string,
		@Query('page') page: string = '1',
		@Query('limit') limit: string = '20',
		@Query('include_inactive') includeInactive?: string,
	) {
		return this.conceptService.getConcepts(
			categoryId,
			search,
			tags,
			+page,
			+limit,
			includeInactive === 'true',
		);
	}

	/** PATCH /concept/incrementUsage/:id — atomic usage increment (call on generation confirm) */
	@UseGuards(AuthGuard)
	@Patch('incrementUsage/:id')
	public async incrementUsage(@Param('id') id: string): Promise<{ usage_count: number }> {
		return this.conceptService.incrementUsage(id);
	}

	/** GET /concept/getRecommended — top concepts by usage_count */
	@UseGuards(AuthGuard)
	@Get('getRecommended')
	public async getRecommendedConcepts() {
		return this.conceptService.getRecommendedConcepts();
	}
}
