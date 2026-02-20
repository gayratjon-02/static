// =============================================
// TYPES — Generation
// =============================================

export enum GenerationStatus {
    PENDING = "pending",
    PROCESSING = "processing",
    COMPLETED = "completed",
    FAILED = "failed",
}

/** POST /generation/createGeneration request body */
export interface CreateGenerationInput {
    brand_id: string;
    product_id: string;
    concept_id: string;
    important_notes?: string;
}

/** POST /generation/createGeneration response */
export interface GenerationResponse {
    job_id: string;
    batch_id: string;
    status: GenerationStatus;
    message: string;
}

/** Full generated ad record (from DB) */
export interface GeneratedAd {
    _id: string;
    user_id: string;
    brand_id: string;
    product_id: string;
    concept_id: string;
    folder_id: string | null;

    important_notes: string;

    claude_response_json: any;
    gemini_prompt: string;

    image_url_1x1: string;
    image_url_9x16: string;
    image_url_16x9: string;

    ad_copy_json: {
        headline: string;
        subheadline: string;
        body_text: string;
        callout_texts: string[];
        cta_text: string;
    };

    generation_status: GenerationStatus;

    ad_name: string;
    is_saved: boolean;
    is_favorite: boolean;

    created_at: string;
}

export interface GenerationBatchResponse {
    batch_id: string;
    status: GenerationStatus;
    variations: {
        _id: string;
        generation_status: GenerationStatus;
        image_url_1x1: string | null;
        image_url_9x16: string | null;
        image_url_16x9: string | null;
        ad_copy_json: any;
        ad_name: string | null;
        created_at: string;
    }[];
}

export interface AdLibraryItem {
    _id: string;
    name: string;
    image: string;
    image_url_1x1?: string;
    image_url_9x16?: string;
    image_url_16x9?: string;
    created_at: string;
    brand_name: string;
    brand_color: string;
    product_name: string;
    concept_name: string;
    ratios: string[];
    canva_status: string;
    canva_link: string | null;
    is_favorite: boolean;
    is_saved: boolean;
}

export interface LibraryCounts {
    brands: {
        _id: string;
        name: string;
        color: string;
        count: number;
    }[];
    products: {
        _id: string;
        name: string;
        brand_id: string;
        count: number;
    }[];
    total_ads: number;
}

export interface GetGenerationsQuery {
    page?: number;
    limit?: number;
    search?: string;
    brand_id?: string;
    product_id?: string;
    concept_id?: string;
    sort_by?: string;
}
