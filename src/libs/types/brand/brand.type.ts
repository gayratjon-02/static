import { BrandIndustry, BrandVoice } from '../../enums/brand/brand.enum';

/** brands jadvalidan kelgan to'liq brand */
export interface Brand {
	_id: string;
	user_id: string;

	// Step 1: Brand Identity
	name: string;
	description: string;
	website_url: string;
	industry: BrandIndustry;

	// Step 2: Brand Visuals
	logo_url: string;
	primary_color: string;
	secondary_color: string;
	accent_color: string;
	background_color: string;

	// Step 3: Brand Voice & Tone
	voice_tags: BrandVoice[];
	target_audience: string;
	competitors: string;

	// Timestamps
	created_at: Date;
	updated_at: Date;
}
