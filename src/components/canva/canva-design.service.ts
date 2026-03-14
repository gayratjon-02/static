import { BadRequestException, Injectable } from '@nestjs/common';
import { CanvaOAuthService } from './canva-oauth.service';
import { Message } from '../../libs/enums/common.enum';

const CANVA_API_BASE = 'https://api.canva.com/rest/v1';
const CANVA_API_VERSION = '2024-10';

interface CanvaAssetUploadJob {
	job: {
		id: string;
		status: string;
	};
}

interface CanvaAssetUploadResult {
	job: {
		id: string;
		status: string;
		asset?: {
			id: string;
		};
		error?: {
			code: string;
			message: string;
		};
	};
}

export interface CanvaBrandTemplate {
	id: string;
	title: string;
	created_at: number;
	updated_at: number;
}

interface CanvaTemplateDatasetField {
	type: 'text' | 'image';
}

export interface CanvaTemplateDataset {
	dataset: Record<string, CanvaTemplateDatasetField>;
}

interface CanvaAutofillJob {
	job: {
		id: string;
		status: string;
	};
}

interface CanvaAutofillResult {
	job: {
		id: string;
		status: string;
		result?: {
			type: string;
			design: {
				id: string;
				title: string;
				urls: {
					edit_url: string;
					view_url: string;
				};
			};
		};
		error?: {
			code: string;
			message: string;
		};
	};
}

interface CanvaDesignResult {
	designId: string;
	editUrl: string;
	viewUrl: string;
}

@Injectable()
export class CanvaDesignService {
	constructor(private readonly canvaOAuthService: CanvaOAuthService) {}

	async uploadAssetFromUrl(userId: string, imageUrl: string, name: string): Promise<string> {
		console.log('CanvaDesignService: uploadAssetFromUrl');

		const token = await this.canvaOAuthService.getValidToken(userId);

		const response = await fetch(`${CANVA_API_BASE}/asset-uploads`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
				'Api-Version': CANVA_API_VERSION,
			},
			body: JSON.stringify({ name, url: imageUrl }),
		});

		if (!response.ok) {
			const errorBody = await response.text();
			console.error('CanvaDesignService: asset upload failed:', response.status, errorBody);
			throw new BadRequestException(Message.CANVA_ASSET_UPLOAD_FAILED);
		}

		const data: CanvaAssetUploadJob = await response.json();
		const jobId = data.job.id;

		return this.pollAssetUpload(token, jobId);
	}

	private async pollAssetUpload(token: string, jobId: string): Promise<string> {
		const maxAttempts = 15;
		const delayMs = 2000;

		for (let i = 0; i < maxAttempts; i++) {
			await this.delay(delayMs);

			const response = await fetch(`${CANVA_API_BASE}/asset-uploads/${jobId}`, {
				headers: {
					Authorization: `Bearer ${token}`,
					'Api-Version': CANVA_API_VERSION,
				},
			});

			if (!response.ok) {
				console.error('CanvaDesignService: pollAssetUpload status check failed:', response.status);
				continue;
			}

			const data: CanvaAssetUploadResult = await response.json();

			if (data.job.status === 'success' && data.job.asset) {
				return data.job.asset.id;
			}

			if (data.job.status === 'failed') {
				console.error('CanvaDesignService: asset upload job failed:', data.job.error);
				throw new BadRequestException(Message.CANVA_ASSET_UPLOAD_FAILED);
			}
		}

		throw new BadRequestException(Message.CANVA_DESIGN_TIMEOUT);
	}

	async listBrandTemplates(userId: string): Promise<CanvaBrandTemplate[]> {
		console.log('CanvaDesignService: listBrandTemplates');

		const token = await this.canvaOAuthService.getValidToken(userId);

		const response = await fetch(`${CANVA_API_BASE}/brand-templates`, {
			headers: {
				Authorization: `Bearer ${token}`,
				'Api-Version': CANVA_API_VERSION,
			},
		});

		if (!response.ok) {
			const errorBody = await response.text();
			console.error('CanvaDesignService: listBrandTemplates failed:', response.status, errorBody);
			throw new BadRequestException(Message.SOMETHING_WENT_WRONG);
		}

		const data = await response.json();
		return data.items ?? [];
	}

	async getTemplateDataset(userId: string, templateId: string): Promise<CanvaTemplateDataset> {
		console.log('CanvaDesignService: getTemplateDataset');

		const token = await this.canvaOAuthService.getValidToken(userId);

		const response = await fetch(`${CANVA_API_BASE}/brand-templates/${templateId}/dataset`, {
			headers: {
				Authorization: `Bearer ${token}`,
				'Api-Version': CANVA_API_VERSION,
			},
		});

		if (!response.ok) {
			const errorBody = await response.text();
			console.error('CanvaDesignService: getTemplateDataset failed:', response.status, errorBody);
			throw new BadRequestException(Message.SOMETHING_WENT_WRONG);
		}

		return response.json();
	}

	async createAutofillJob(
		userId: string,
		templateId: string,
		data: Record<string, { type: string; text?: string; asset_id?: string }>,
		title?: string,
	): Promise<string> {
		console.log('CanvaDesignService: createAutofillJob');

		const token = await this.canvaOAuthService.getValidToken(userId);

		const body: Record<string, unknown> = {
			brand_template_id: templateId,
			data,
		};
		if (title) body.title = title;

		const response = await fetch(`${CANVA_API_BASE}/autofills`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
				'Api-Version': CANVA_API_VERSION,
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const errorBody = await response.text();
			console.error('CanvaDesignService: createAutofillJob failed:', response.status, errorBody);
			throw new BadRequestException(Message.CANVA_AUTOFILL_FAILED);
		}

		const result: CanvaAutofillJob = await response.json();
		return result.job.id;
	}

	async getAutofillJobResult(userId: string, jobId: string): Promise<CanvaDesignResult> {
		console.log('CanvaDesignService: getAutofillJobResult');

		const token = await this.canvaOAuthService.getValidToken(userId);
		const maxAttempts = 15;
		const delayMs = 2000;

		for (let i = 0; i < maxAttempts; i++) {
			await this.delay(delayMs);

			const response = await fetch(`${CANVA_API_BASE}/autofills/${jobId}`, {
				headers: {
					Authorization: `Bearer ${token}`,
					'Api-Version': CANVA_API_VERSION,
				},
			});

			if (!response.ok) {
				console.error('CanvaDesignService: autofill status check failed:', response.status);
				continue;
			}

			const data: CanvaAutofillResult = await response.json();

			if (data.job.status === 'success' && data.job.result) {
				return {
					designId: data.job.result.design.id,
					editUrl: data.job.result.design.urls.edit_url,
					viewUrl: data.job.result.design.urls.view_url,
				};
			}

			if (data.job.status === 'failed') {
				console.error('CanvaDesignService: autofill job failed:', data.job.error);
				throw new BadRequestException(Message.CANVA_AUTOFILL_FAILED);
			}
		}

		throw new BadRequestException(Message.CANVA_DESIGN_TIMEOUT);
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
