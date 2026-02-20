import { GenerationStatus } from '../../enums/generation/generation.enum';

/** generated_ads jadvalidan kelgan to'liq record */
export interface GeneratedAd {
	_id: string;
	user_id: string;
	brand_id: string;
	product_id: string;
	concept_id: string;
	folder_id: string | null;

	// Batch (6 variations per generation)
	batch_id: string | null;
	variation_index: number;

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

/** Claude API response format (bitta variation) */
export interface ClaudeResponseJson {
	headline: string;
	subheadline: string;
	body_text: string;
	callout_texts: string[];
	cta_text: string;
	gemini_image_prompt: string;
}

/** Claude API response — 6 ta variation */
export interface Claude6VariationsResponse {
	variations: ClaudeResponseJson[];
	claude_usage?: { input_tokens: number; output_tokens: number };
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
	job_id: string; // Helper for frontend (ID of first ad or batch ID)
	batch_id: string;
	status: GenerationStatus;
	message: string;
}

/** getStatus endpoint response */
export interface GenerationStatusResponse {
	_id: string;
	generation_status: GenerationStatus;
	image_url_1x1: string | null;
	image_url_9x16: string | null;
	image_url_16x9: string | null;
	ad_copy_json: AdCopyJson | null;
	ad_name: string | null;
	created_at: Date;
}

/** getBatchStatus endpoint response */
export interface GenerationBatchResponse {
	batch_id: string;
	status: GenerationStatus; // 'completed' only if all variations are completed/failed
	variations: GenerationStatusResponse[];
}

/** getResults endpoint response — to'liq natija */
export interface GenerationResultsResponse {
	_id: string;
	generation_status: GenerationStatus;
	important_notes: string;
	image_url_1x1: string | null;
	image_url_9x16: string | null;
	image_url_16x9: string | null;
	ad_copy_json: AdCopyJson;
	ad_name: string | null;
	is_saved: boolean;
	is_favorite: boolean;
	brand_snapshot: any;
	product_snapshot: any;
	created_at: Date;
}

/** exportRatios endpoint response */
export interface ExportRatiosResponse {
	_id: string;
	ad_name: string | null;
	ratios: {
		ratio: string;
		label: string;
		image_url: string | null;
	}[];
}

/** BullMQ job'ga yuboriladigan data */
export interface GenerationJobData {
	user_id: string;
	brand_id: string;
	product_id: string;
	concept_id: string;
	important_notes: string;
	generated_ad_id: string;
	batch_id?: string;
	variation_index?: number;
	claude_variation?: ClaudeResponseJson;
}

/** BullMQ fix-errors job data */
export interface FixErrorsJobData {
	user_id: string;
	original_ad_id: string;
	new_ad_id: string;
	error_description: string;
}
