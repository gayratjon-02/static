// =============================================
// TYPES — Brand
// =============================================

export enum BrandIndustry {
    ECOMMERCE = "ecommerce",
    SUPPLEMENTS = "supplements",
    APPAREL = "apparel",
    BEAUTY = "beauty",
    FOOD_BEVERAGE = "food_beverage",
    SAAS = "saas",
    FITNESS = "fitness",
    HOME_GOODS = "home_goods",
    PETS = "pets",
    FINANCIAL_SERVICES = "financial_services",
    EDUCATION = "education",
    OTHER = "other",
}

export enum BrandVoice {
    PROFESSIONAL = "professional",
    PLAYFUL = "playful",
    BOLD = "bold",
    MINIMALIST = "minimalist",
    LUXURIOUS = "luxurious",
    FRIENDLY = "friendly",
    EDGY = "edgy",
    TRUSTWORTHY = "trustworthy",
    YOUTHFUL = "youthful",
    AUTHORITATIVE = "authoritative",
}

export interface Brand {
    _id: string;
    user_id: string;

    // Brand Identity
    name: string;
    description: string;
    website_url: string;
    industry: BrandIndustry;

    // Brand Visuals
    logo_url: string;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    background_color: string;

    // Brand Voice & Tone
    voice_tags: BrandVoice[];
    target_audience: string;
    competitors: string;

    // Timestamps
    created_at: string;
    updated_at: string;
}

export interface CreateBrandInput {
    name: string;
    description: string;
    website_url: string;
    industry: BrandIndustry;
    logo_url?: string;
    primary_color: string;
    secondary_color: string;
    accent_color?: string;
    background_color?: string;
    voice_tags: BrandVoice[];
    target_audience: string;
    competitors?: string;
}

export interface UpdateBrandInput {
    name?: string;
    description?: string;
    website_url?: string;
    industry?: BrandIndustry;
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    accent_color?: string;
    background_color?: string;
    voice_tags?: BrandVoice[];
    target_audience?: string;
    competitors?: string;
}
