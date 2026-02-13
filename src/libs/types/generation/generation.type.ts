import { GenerationStatus } from '../../enums/generation/generation.enum';

/** generated_ads jadvalidan kelgan to'liq record */
export interface GeneratedAd {
	_id: string;
	user_id: string;
	brand_id: string;
	product_id: string;
	concept_id: string;
	folder_id: string | null;

	// User Input
	important_notes: string;

	// AI Response Data
	claude_response_json: ClaudeResponseJson;
	gemini_prompt: string;

	// Generated Images
	image_url_1x1: string;
	image_url_9x16: string;
	image_url_16x9: string;

	// Ad Copy
	ad_copy_json: AdCopyJson;

	// Status
	generation_status: GenerationStatus;

	// Organization
	ad_name: string;
	is_saved: boolean;
	is_favorite: boolean;

	// Snapshots
	brand_snapshot: any;
	product_snapshot: any;

	// Timestamps
	created_at: Date;
}

/** Claude API response format */
export interface ClaudeResponseJson {
	headline: string;
	subheadline: string;
	body_text: string;
	callout_texts: string[];
	cta_text: string;
	gemini_image_prompt: string;
}

/** Ad copy (Claude response'dan gemini_image_prompt chiqarilgan) */
export interface AdCopyJson {
	headline: string;
	subheadline: string;
	body_text: string;
	callout_texts: string[];
	cta_text: string;
}

/** createGeneration endpoint response */
export interface Generation {
	job_id: string;
	status: GenerationStatus;
	message: string;
}

/** BullMQ job'ga yuboriladigan data */
export interface GenerationJobData {
	user_id: string;
	brand_id: string;
	product_id: string;
	concept_id: string;
	important_notes: string;
	generated_ad_id: string;
}
