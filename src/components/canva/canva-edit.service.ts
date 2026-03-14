import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CanvaOAuthService } from './canva-oauth.service';
import { CanvaDesignService } from './canva-design.service';
import { Message } from '../../libs/enums/common.enum';

export interface EditInCanvaResult {
	canva_edit_url: string;
	canva_view_url: string;
	canva_design_id: string;
}

export interface NeedsAuthResult {
	needs_auth: true;
	auth_url: string;
}

interface ClaudeResponseJson {
	headline?: string;
	subheadline?: string;
	cta_text?: string;
	body_text?: string;
	price?: string;
	[key: string]: string | undefined;
}

@Injectable()
export class CanvaEditService {
	constructor(
		private readonly databaseService: DatabaseService,
		private readonly canvaOAuthService: CanvaOAuthService,
		private readonly canvaDesignService: CanvaDesignService,
	) {}

	async editInCanva(userId: string, generatedAdId: string): Promise<EditInCanvaResult | NeedsAuthResult> {
		console.log('CanvaEditService: editInCanva');

		const connectionStatus = await this.canvaOAuthService.getConnectionStatus(userId);

		if (!connectionStatus.connected) {
			const { authUrl } = await this.canvaOAuthService.generateAuthUrl(userId);
			return { needs_auth: true, auth_url: authUrl };
		}

		const { data: ad, error: adError } = await this.databaseService.client
			.from('generated_ads')
			.select('_id, claude_response_json, concept_id, brand_id, product_id, ad_name, canva_design_id, canva_edit_url')
			.eq('_id', generatedAdId)
			.eq('user_id', userId)
			.single();

		if (adError ?? !ad) throw new BadRequestException(Message.AD_NOT_FOUND);

		if (ad.canva_edit_url) {
			return {
				canva_edit_url: ad.canva_edit_url,
				canva_view_url: ad.canva_edit_url,
				canva_design_id: ad.canva_design_id,
			};
		}

		const { data: concept } = await this.databaseService.client
			.from('ad_concepts')
			.select('canva_template_id')
			.eq('_id', ad.concept_id)
			.single();

		if (!concept?.canva_template_id) {
			throw new BadRequestException(Message.CANVA_TEMPLATE_NOT_CONFIGURED);
		}

		const [brand, product] = await Promise.all([
			this.databaseService.client
				.from('brands')
				.select('logo_url, name')
				.eq('_id', ad.brand_id)
				.single()
				.then((r) => r.data),
			this.databaseService.client
				.from('products')
				.select('photo_url, name')
				.eq('_id', ad.product_id)
				.single()
				.then((r) => r.data),
		]);

		if (!product) throw new BadRequestException(Message.PRODUCT_NOT_FOUND);
		if (!brand) throw new BadRequestException(Message.BRAND_NOT_FOUND);

		const uploadPromises: Promise<string | null>[] = [
			product.photo_url
				? this.canvaDesignService.uploadAssetFromUrl(userId, product.photo_url, `product-${product.name}`)
				: Promise.resolve(null),
			brand.logo_url
				? this.canvaDesignService.uploadAssetFromUrl(userId, brand.logo_url, `logo-${brand.name}`)
				: Promise.resolve(null),
		];

		const [productAssetId, logoAssetId] = await Promise.all(uploadPromises);

		const claudeJson: ClaudeResponseJson = ad.claude_response_json ?? {};
		const autofillData: Record<string, { type: string; text?: string; asset_id?: string }> = {};

		if (claudeJson.headline) {
			autofillData.headline = { type: 'text', text: claudeJson.headline };
		}
		if (claudeJson.subheadline) {
			autofillData.subheadline = { type: 'text', text: claudeJson.subheadline };
		}
		if (claudeJson.cta_text) {
			autofillData.cta_text = { type: 'text', text: claudeJson.cta_text };
		}
		if (claudeJson.body_text) {
			autofillData.body_text = { type: 'text', text: claudeJson.body_text };
		}
		if (claudeJson.price) {
			autofillData.price = { type: 'text', text: claudeJson.price };
		}
		if (productAssetId) {
			autofillData.product_image = { type: 'image', asset_id: productAssetId };
		}
		if (logoAssetId) {
			autofillData.logo = { type: 'image', asset_id: logoAssetId };
		}

		const title = ad.ad_name ?? `Ad - ${product.name}`;

		const jobId = await this.canvaDesignService.createAutofillJob(
			userId,
			concept.canva_template_id,
			autofillData,
			title,
		);

		const designResult = await this.canvaDesignService.getAutofillJobResult(userId, jobId);

		await this.databaseService.client
			.from('generated_ads')
			.update({
				canva_design_id: designResult.designId,
				canva_edit_url: designResult.editUrl,
			})
			.eq('_id', generatedAdId);

		return {
			canva_edit_url: designResult.editUrl,
			canva_view_url: designResult.viewUrl,
			canva_design_id: designResult.designId,
		};
	}
}
