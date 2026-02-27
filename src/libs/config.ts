export const GEMINI_MODEL = 'gemini-3.1-flash-image-preview'; // Gemini Flash Image (text+image input → image output)
export const VALID_IMAGE_SIZES = ['1024x1024', '1K', '2K', '4K']; // Mapping might differ based on SDK

export interface GeminiImageResult {
    mimeType: string;
    data: string | null; // base64
}

export enum ProductPlans {
    STARTER = "starter",
    PRO = "pro",
    GROWTH = "growth"
}
