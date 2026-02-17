/** Brand industry categories (PDF spec) */
export enum BrandIndustry {
	ECOMMERCE = 'ecommerce',
	SUPPLEMENTS = 'supplements',
	APPAREL = 'apparel',
	BEAUTY = 'beauty',
	FOOD_BEVERAGE = 'food_beverage',
	SAAS = 'saas',
	FITNESS = 'fitness',
	HOME_GOODS = 'home_goods',
	PETS = 'pets',
	FINANCIAL_SERVICES = 'financial_services',
	EDUCATION = 'education',
	OTHER = 'other',
}

/** Human-readable labels for industries (single source of truth) */
export const INDUSTRY_LABELS: Record<BrandIndustry, string> = {
	[BrandIndustry.ECOMMERCE]: 'E-Commerce',
	[BrandIndustry.SUPPLEMENTS]: 'Supplements',
	[BrandIndustry.APPAREL]: 'Apparel',
	[BrandIndustry.BEAUTY]: 'Beauty',
	[BrandIndustry.FOOD_BEVERAGE]: 'Food & Beverage',
	[BrandIndustry.SAAS]: 'SaaS',
	[BrandIndustry.FITNESS]: 'Fitness',
	[BrandIndustry.HOME_GOODS]: 'Home Goods',
	[BrandIndustry.PETS]: 'Pets',
	[BrandIndustry.FINANCIAL_SERVICES]: 'Financial Services',
	[BrandIndustry.EDUCATION]: 'Education',
	[BrandIndustry.OTHER]: 'Other',
};

/** Brand voice/tone tags (PDF spec) */
export enum BrandVoice {
	PROFESSIONAL = 'professional',
	PLAYFUL = 'playful',
	BOLD = 'bold',
	MINIMALIST = 'minimalist',
	LUXURIOUS = 'luxurious',
	FRIENDLY = 'friendly',
	EDGY = 'edgy',
	TRUSTWORTHY = 'trustworthy',
	YOUTHFUL = 'youthful',
	AUTHORITATIVE = 'authoritative',
}

/** Human-readable labels for voice tags */
export const VOICE_LABELS: Record<BrandVoice, string> = {
	[BrandVoice.PROFESSIONAL]: 'Professional',
	[BrandVoice.PLAYFUL]: 'Playful',
	[BrandVoice.BOLD]: 'Bold',
	[BrandVoice.MINIMALIST]: 'Minimalist',
	[BrandVoice.LUXURIOUS]: 'Luxurious',
	[BrandVoice.FRIENDLY]: 'Friendly',
	[BrandVoice.EDGY]: 'Edgy',
	[BrandVoice.TRUSTWORTHY]: 'Trustworthy',
	[BrandVoice.YOUTHFUL]: 'Youthful',
	[BrandVoice.AUTHORITATIVE]: 'Authoritative',
};

export enum AIMessage {
	GEMINI_API_ERROR = 'Gemini API Error',
	API_KEY_MISSING = 'Gemini API Key is missing',
}

export enum FileMessage {
	FILE_NOT_FOUND = 'File not found',
}
