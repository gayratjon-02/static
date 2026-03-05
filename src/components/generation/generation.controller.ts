import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import * as archiver from 'archiver';
import { GenerationService } from './generation.service';
import { S3Service } from '../s3/s3.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CreditsGuard } from '../auth/guards/credits.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { RequireCredits } from '../auth/decorators/credits.decorator';
import { CreateGenerationDto } from '../../libs/dto/generation/create-generation.dto';
import { GetGenerationsDto } from '../../libs/dto/generation/get-generations.dto';
import { FixErrorsDto } from '../../libs/dto/generation/fix-errors.dto';
import { BulkDownloadDto } from '../../libs/dto/generation/bulk-download.dto';
import { Member } from '../../libs/types/member/member.type';
import { Generation, GenerationStatusResponse, GenerationResultsResponse, ExportRatiosResponse, GenerationBatchResponse } from '../../libs/types/generation/generation.type';

@Controller('generation')
export class GenerationController {
	constructor(
		private readonly generationService: GenerationService,
		private readonly s3Service: S3Service,
	) { }

	@UseGuards(ThrottlerGuard, AuthGuard, CreditsGuard)
	@Throttle({ default: { ttl: 60000, limit: 3 } })
	@RequireCredits('credits_per_generation')
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

	@SkipThrottle()
	@UseGuards(AuthGuard)
	@Get('getBatchStatus/:batchId')
	public async getBatchStatus(
		@Param('batchId') batchId: string,
		@AuthMember() authMember: Member,
	): Promise<GenerationBatchResponse> {
		return this.generationService.getBatchStatus(batchId, authMember);
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
	@RequireCredits('credits_per_fix_errors')
	@Post('fixErrors/:adId')
	public async fixErrors(
		@Param('adId') adId: string,
		@Body() input: FixErrorsDto,
		@AuthMember() authMember: Member,
	): Promise<Generation> {
		return this.generationService.fixErrors(adId, input, authMember);
	}

	@UseGuards(AuthGuard, CreditsGuard)
	@RequireCredits('credits_per_regenerate_single')
	@Post('regenerateSingle/:adId')
	public async regenerateSingle(
		@Param('adId') adId: string,
		@AuthMember() authMember: Member,
	): Promise<Generation> {
		return this.generationService.regenerateSingle(adId, authMember);
	}

	@UseGuards(AuthGuard)
	@Post('cancelBatch/:batchId')
	public async cancelBatch(
		@Param('batchId') batchId: string,
		@AuthMember() authMember: Member,
	): Promise<{ cancelled: number }> {
		return this.generationService.cancelBatch(batchId, authMember);
	}

	@UseGuards(AuthGuard)
	@Post('exportRatios/:adId')
	public async exportRatios(
		@Param('adId') adId: string,
		@AuthMember() authMember: Member,
	): Promise<ExportRatiosResponse> {
		return this.generationService.exportRatios(adId, authMember);
	}

	@UseGuards(AuthGuard)
	@Get('download/:adId')
	public async downloadImage(
		@Param('adId') adId: string,
		@AuthMember() authMember: Member,
		@Res() res: Response,
	): Promise<void> {
		return this.streamImageDownload(adId, '1x1', authMember, res);
	}

	@UseGuards(AuthGuard)
	@Get('download/:adId/:ratio')
	public async downloadImageByRatio(
		@Param('adId') adId: string,
		@Param('ratio') ratio: string,
		@AuthMember() authMember: Member,
		@Res() res: Response,
	): Promise<void> {
		return this.streamImageDownload(adId, ratio, authMember, res);
	}

	private async streamImageDownload(adId: string, ratio: string, authMember: Member, res: Response): Promise<void> {
		const { url: imageUrl, adName } = await this.generationService.getImageUrlByRatio(adId, ratio, authMember);
		if (!imageUrl) {
			res.status(404).json({ message: 'Image not found' });
			return;
		}

		const key = this.s3Service.extractKeyFromUrl(imageUrl);
		if (!key) {
			res.redirect(imageUrl);
			return;
		}

		try {
			const { body, contentType } = await this.s3Service.getObject(key);
			const safeName = (adName || adId).replace(/[^a-zA-Z0-9_-]/g, '_');
			const filename = `${safeName}_${ratio}.png`;
			res.set({
				'Content-Type': contentType,
				'Content-Disposition': `attachment; filename="${filename}"`,
				'Cache-Control': 'no-cache',
			});
			body.transformToWebStream().pipeTo(
				new WritableStream({
					write(chunk) { res.write(chunk); },
					close() { res.end(); },
					abort() { res.status(500).end(); },
				}),
			);
		} catch {
			res.status(500).json({ message: 'Failed to download image' });
		}
	}

	@UseGuards(AuthGuard)
	@Get('getRecent')
	public async getRecent(
		@AuthMember() authMember: Member,
	): Promise<any[]> {
		return this.generationService.getRecent(authMember);
	}

	@UseGuards(AuthGuard)
	@Get('list')
	public async getList(
		@Query() query: GetGenerationsDto,
		@AuthMember() authMember: Member,
	): Promise<any> {
		return this.generationService.findAll(query, authMember);
	}

	@UseGuards(AuthGuard)
	@Get('counts')
	public async getCounts(
		@AuthMember() authMember: Member,
	): Promise<any> {
		return this.generationService.getLibraryCounts(authMember);
	}

	@UseGuards(AuthGuard)
	@Post('toggleFavorite/:adId')
	public async toggleFavorite(
		@Param('adId') adId: string,
		@AuthMember() authMember: Member,
	): Promise<{ is_favorite: boolean }> {
		return this.generationService.toggleFavorite(adId, authMember);
	}

	@UseGuards(AuthGuard)
	@Post('rename/:adId')
	public async renameAd(
		@Param('adId') adId: string,
		@Body() body: { name: string },
		@AuthMember() authMember: Member,
	): Promise<{ ad_name: string }> {
		return this.generationService.renameAd(adId, body.name, authMember);
	}

	@UseGuards(AuthGuard)
	@Post('bulkDownload')
	public async bulkDownload(
		@Body() input: BulkDownloadDto,
		@AuthMember() authMember: Member,
		@Res() res: Response,
	): Promise<void> {
		console.log('GenerationController: bulkDownload');
		const ads = await this.generationService.getBulkDownloadAds(input.ids, authMember);
		return this.streamZipDownload(ads, res);
	}

	@UseGuards(AuthGuard)
	@Get('batchDownload/:batchId')
	public async batchDownload(
		@Param('batchId') batchId: string,
		@AuthMember() authMember: Member,
		@Res() res: Response,
	): Promise<void> {
		console.log('GenerationController: batchDownload');
		const ads = await this.generationService.getBatchDownloadAds(batchId, authMember);
		return this.streamZipDownload(ads, res);
	}

	private async streamZipDownload(
		ads: { _id: string; ad_name: string; image_url_1x1: string | null; image_url_9x16: string | null; image_url_16x9: string | null }[],
		res: Response,
	): Promise<void> {
		const ratios = ['1x1', '9x16', '16x9'] as const;
		const ratioFields = {
			'1x1': 'image_url_1x1',
			'9x16': 'image_url_9x16',
			'16x9': 'image_url_16x9',
		} as const;

		res.set({
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="ads_${Date.now()}.zip"`,
			'Cache-Control': 'no-cache',
		});

		const archive = archiver('zip', { zlib: { level: 5 } });
		archive.pipe(res);

		archive.on('error', () => {
			res.status(500).end();
		});

		for (const ad of ads) {
			const safeName = (ad.ad_name || ad._id).replace(/[^a-zA-Z0-9_-]/g, '_');

			for (const ratio of ratios) {
				const imageUrl = ad[ratioFields[ratio]];
				if (!imageUrl) continue;

				const key = this.s3Service.extractKeyFromUrl(imageUrl);
				if (!key) continue;

				try {
					const { body } = await this.s3Service.getObject(key);
					const chunks: Buffer[] = [];
					const stream = body.transformToWebStream();
					const reader = stream.getReader();

					let done = false;
					while (!done) {
						const result = await reader.read();
						done = result.done;
						if (result.value) chunks.push(Buffer.from(result.value));
					}

					archive.append(Buffer.concat(chunks), { name: `${safeName}/${safeName}_${ratio}.png` });
				} catch {
					// Skip failed images
				}
			}
		}

		await archive.finalize();
	}

	@UseGuards(AuthGuard)
	@Post('deleteMany')
	public async deleteAds(
		@Body() body: { ids: string[] },
		@AuthMember() authMember: Member,
	): Promise<{ deleted: number }> {
		return this.generationService.deleteAds(body.ids, authMember);
	}
}
