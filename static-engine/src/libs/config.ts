export const GEMINI_MODEL = 'imagen-4.0-generate-001'; // Imagen image generation model
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
