/** products jadvalidan kelgan to'liq product */
export interface Product {
	_id: string;
	brand_id: string;
	user_id: string;

	// Product Info
	name: string;
	description: string;
	usps: string[];
	photo_url: string;
	has_physical_product: boolean;

	// Pricing & URL
	price_text: string;
	product_url: string;

	// Social Proof
	star_rating: number;
	review_count: number;

	// Marketing Copy
	ingredients_features: string;
	before_description: string;
	after_description: string;
	offer_text: string;

	// Timestamps
	created_at: Date;
	updated_at: Date;
}
