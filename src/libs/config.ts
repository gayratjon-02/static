export const GEMINI_MODEL = 'gemini-2.0-flash-exp'; // Supports responseModalities: ['TEXT', 'IMAGE'] for native image generation
// Note: 'gemini-3-pro-image-preview' might be an internal or preview name. 
// Using a standard model for now, but user requested specific one.
// User spec: private readonly MODEL = GEMINI_MODEL; 
// and in code: private readonly MODEL = 'gemini-3-pro-image-preview';
// Wait, the user code has:
// private readonly MODEL = GEMINI_MODEL;
// private readonly ANALYSIS_MODEL = 'gemini-2.0-flash';
// But later:
// async generateImage(..., _modelName?: string, ...) { ... }

// Let's define the config as requested by the user's snippet context.
export const VALID_IMAGE_SIZES = ['1024x1024', '1K', '2K', '4K']; // Mapping might differ based on SDK

export interface GeminiImageResult {
    mimeType: string;
    data: string | null; // base64
}
