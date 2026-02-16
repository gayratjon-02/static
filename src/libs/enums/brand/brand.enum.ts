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

export enum AIMessage {
	GEMINI_API_ERROR = 'Gemini API Error',
	API_KEY_MISSING = 'Gemini API Key is missing',
}

export enum FileMessage {
	FILE_NOT_FOUND = 'File not found',
}
