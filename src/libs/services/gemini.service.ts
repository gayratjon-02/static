import { Injectable, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { AIMessage, FileMessage } from '../enums/brand/brand.enum'; // Updated path based on previous step
import { GEMINI_MODEL, VALID_IMAGE_SIZES, GeminiImageResult } from '../config'; // Updated path
import { AnalyzedProductJSON } from '../../common/interfaces/product-json.interface'; // Updated path
import { AnalyzedDAJSON } from '../../common/interfaces/da-json.interface'; // Updated path
import { PRODUCT_ANALYSIS_PROMPT } from './prompts/product-analysis.prompt';
import { DA_ANALYSIS_PROMPT } from './prompts/da-analysis.prompt';
import * as fs from 'fs';
import * as path from 'path';

export interface GeneratedImage {
	ratio: string;
	buffer: Buffer;
}

// Custom error types for better error handling
export class GeminiTimeoutError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'GeminiTimeoutError';
	}
}

export class GeminiGenerationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'GeminiGenerationError';
	}
}

@Injectable()
export class GeminiService {
	private client: GoogleGenAI | null = null;
	private readonly logger = new Logger(GeminiService.name);

	private readonly MODEL = GEMINI_MODEL;
	private readonly ANALYSIS_MODEL = 'gemini-2.0-flash';

	private readonly TIMEOUT_MS = 180 * 1000;

	private static readonly ASPECT_RATIO_MAP: Record<string, string> = {
		'1:1': '1:1',
		'9:16': '9:16',
		'4:5': '4:5',
		'16:9': '16:9',
		'3:4': '3:4',
		'4:3': '4:3',
		'2:3': '2:3',
		'3:2': '3:2',
		'21:9': '21:9',
	};

	constructor(private readonly configService: ConfigService) { }

	async generateAllRatios(
		prompt: string,
		brandColors?: { primary: string; secondary: string; accent: string; background: string },
	): Promise<GeneratedImage[]> {
		const ratios = ['1:1', '9:16', '16:9'];
		const results: GeneratedImage[] = [];

		let fullPrompt = prompt;
		if (brandColors) {
			fullPrompt += `\n\nBrand colors: Primary ${brandColors.primary}, Secondary ${brandColors.secondary}, Accent ${brandColors.accent}, Background ${brandColors.background}`;
		}

		this.logger.log(`Generating images for all 3 ratios...`);

		const promises = ratios.map(async (ratio) => {
			try {
				const result = await this.generateImage(fullPrompt, undefined, ratio);
				if (result && result.data) {
					return {
						ratio,
						buffer: Buffer.from(result.data, 'base64')
					};
				}
				throw new Error(`No data returned for ${ratio}`);
			} catch (e: any) {
				this.logger.error(`Failed to generate ${ratio}: ${e.message}`);
				return null;
			}
		});

		const settled = await Promise.all(promises);

		for (const res of settled) {
			if (res) {
				results.push(res);
			}
		}

		if (results.length === 0) {
			throw new GeminiGenerationError('All ratio generations failed');
		}

		return results;
	}

	private mapAspectRatioToGemini(dtoRatio?: string): string {
		if (!dtoRatio || typeof dtoRatio !== 'string') return '4:5';
		const normalized = dtoRatio.trim();
		return GeminiService.ASPECT_RATIO_MAP[normalized] ?? '4:5';
	}

	private mapResolutionToGemini(resolution?: string): string {
		if (!resolution || typeof resolution !== 'string') return '1K';
		const upper = resolution.trim().toUpperCase();
		return VALID_IMAGE_SIZES.includes(upper as any) ? upper : '1K';
	}

	private withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
		return new Promise((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				reject(new GeminiTimeoutError(
					`⏱️ ${operationName} timed out after ${timeoutMs / 1000} seconds (${timeoutMs / 60000} minutes)`
				));
			}, timeoutMs);

			promise
				.then((result) => {
					clearTimeout(timeoutId);
					resolve(result);
				})
				.catch((error) => {
					clearTimeout(timeoutId);
					reject(error);
				});
		});
	}

	async generateImages(prompt: string, aspectRatio?: string, resolution?: string, userApiKey?: string): Promise<{ images: GeminiImageResult[] }> {
		const client = this.getClient(userApiKey);
		const startTime = Date.now();

		const ratioText = this.mapAspectRatioToGemini(aspectRatio ?? '4:5');
		const resolutionText = this.mapResolutionToGemini(resolution);

		if (!prompt) {
			this.logger.error('❌ CRITICAL: generateImages called with EMPTY/UNDEFINED prompt!');
			throw new GeminiGenerationError('Prompt string is required');
		}

		const sanitizedPrompt = this.sanitizePromptForImageGeneration(prompt);

		// Aspect ratio ni prompt ichida ko'rsatamiz (model imageConfig.aspectRatio ni qo'llab-quvvatlamaydi)
		const dimensionsMap: Record<string, string> = {
			'1:1': '1080x1080',
			'9:16': '1080x1920',
			'16:9': '1920x1080',
			'4:5': '1080x1350',
			'3:4': '1080x1440',
			'4:3': '1440x1080',
		};
		const dimensions = dimensionsMap[ratioText] || '1080x1080';

		const enhancedPrompt = `You are a professional commercial ad designer.

STRICT TEXT RENDERING RULES:
- ZERO tolerance for misspelled words, garbled text, random micro text, blurry small text, cropped typography, or deformed letters.
- All visible text MUST be: sharp, fully readable, correctly spelled, aligned properly, using clean sans-serif font, with correct kerning and spacing.
- Do NOT generate fake nutrition labels, microscopic product packaging text, or random supplement claims on products.
- If any text cannot be rendered perfectly clear and readable, DO NOT render it at all.
- Before generating the image, internally verify: all words are spelled correctly, no extra words exist, no cropped letters, no deformed characters. If verification fails, regenerate internally.

Generate a ${dimensions} pixel image (${ratioText} aspect ratio). Render EXACTLY as specified. Do NOT add, remove, or change any element. 100% match to the product specification. No creative additions.
CRITICAL: Any human models must be FULLY CLOTHED. NEVER shirtless, bare-chested, or topless.

Professional commercial ad design: ${sanitizedPrompt}.
High quality studio lighting, sharp details, clean background, modern minimal design.`;

		this.logger.log(`🎨 ========== GEMINI IMAGE GENERATION START ==========`);
		this.logger.log(`📋 Model: ${this.MODEL}`);
		this.logger.log(`📐 Aspect ratio: ${ratioText} (${dimensions})`);
		this.logger.log(`📏 Resolution: ${resolutionText}`);

		try {
			const generatePromise = client.models.generateContent({
				model: this.MODEL,
				contents: enhancedPrompt,
				config: {
					responseModalities: ['IMAGE', 'TEXT'],
					safetySettings: [
						{ category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
						{ category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
						{ category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
						{ category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
					]
				}
			});

			const response = await this.withTimeout(
				generatePromise,
				this.TIMEOUT_MS,
				'Gemini image generation'
			);

			const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
			this.logger.log(`⏱️ Gemini response received in ${elapsedTime}s`);

			if (!response.candidates || response.candidates.length === 0) {
				throw new GeminiGenerationError('Gemini returned no candidates');
			}

			const candidate = response.candidates[0];
			const parts = candidate.content?.parts || [];

			if (parts.length === 0) {
				const finishReason = (candidate as any).finishReason || (candidate as any).finish_reason;
				if (finishReason === 'IMAGE_SAFETY' || finishReason === 'SAFETY') {
					throw new GeminiGenerationError(
						'Image generation was blocked by platform safety policy.'
					);
				}
				throw new GeminiGenerationError('Gemini returned no parts');
			}

			const images: GeminiImageResult[] = [];
			let textResponse = '';

			for (let i = 0; i < parts.length; i++) {
				const part = parts[i] as any;

				if (part.text) {
					textResponse = part.text;
					const lowerText = part.text.toLowerCase();
					if (
						lowerText.includes('cannot generate') ||
						lowerText.includes('unable to generate') ||
						lowerText.includes('violates') ||
						lowerText.includes('policy')
					) {
						throw new GeminiGenerationError(`Model refused: ${part.text.substring(0, 300)}`);
					}
				}

				if (part.inlineData) {
					const mimeType = part.inlineData.mimeType || 'image/png';
					const data = part.inlineData.data;

					if (data && data.length > 0) {
						images.push({
							mimeType: mimeType,
							data: data
						});
					}
				}
			}

			if (images.length === 0) {
				if (textResponse) {
					throw new GeminiGenerationError(
						`Gemini did not generate any images. Model response: ${textResponse.substring(0, 300)}`
					);
				} else {
					throw new GeminiGenerationError(
						'Gemini did not generate any images and provided no explanation.'
					);
				}
			}

			return { images };

		} catch (error: any) {
			const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

			if (error instanceof GeminiTimeoutError) {
				throw new InternalServerErrorException(
					`Image generation timed out after ${this.TIMEOUT_MS / 60000} minutes.`
				);
			}

			if (error instanceof GeminiGenerationError) {
				throw new InternalServerErrorException(error.message);
			}

			const errorMessage = error?.message || String(error);
			this.logger.error(`Gemini Error: ${errorMessage}`);
			throw new InternalServerErrorException(`Gemini error: ${errorMessage.substring(0, 200)}`);
		}
	}

	async generateImage(
		prompt: string,
		_modelName?: string,
		aspectRatio?: string,
		resolution?: string,
		userApiKey?: string
	): Promise<GeminiImageResult> {
		const maxRetries = 2;

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				if (attempt > 0) {
					await new Promise(resolve => setTimeout(resolve, 3000));
				}

				const result = await this.generateImages(prompt, aspectRatio, resolution, userApiKey);

				if (result.images.length > 0) {
					return result.images[0];
				}

				throw new GeminiGenerationError('No images generated');

			} catch (error: any) {
				const isLastAttempt = attempt === maxRetries - 1;

				if (error instanceof InternalServerErrorException &&
					(error.message.includes('timed out') || error.message.includes('violates'))) {
					throw error;
				}

				if (isLastAttempt) {
					throw error;
				}
			}
		}

		throw new InternalServerErrorException(AIMessage.GEMINI_API_ERROR);
	}

	async generateImageWithReference(
		prompt: string,
		referenceImages: string[],
		aspectRatio?: string,
		resolution?: string,
		userApiKey?: string
	): Promise<GeminiImageResult> {
		const client = this.getClient(userApiKey);

		const validImages = (referenceImages || []).filter(img => img && img.trim() !== '');

		if (validImages.length === 0) {
			return this.generateImage(prompt, undefined, aspectRatio, resolution, userApiKey);
		}

		const imageParts = await this.buildImageParts(validImages);

		if (imageParts.length === 0) {
			return this.generateImage(prompt, undefined, aspectRatio, resolution, userApiKey);
		}

		const ratioText = this.mapAspectRatioToGemini(aspectRatio ?? '4:5');
		const resolutionText = this.mapResolutionToGemini(resolution);

		const referencePrompt = `🎯 CRITICAL: Use the provided reference images as EXACT VISUAL GUIDE.
You MUST match ALL details from reference images precisely:
GENERATE A NEW PROFESSIONAL PRODUCT PHOTOGRAPHY.
The product must look IDENTICAL across all generated shots.

PHOTOGRAPHY REQUIREMENTS:
${this.sanitizePromptForImageGeneration(prompt)}`;

		try {
			const generatePromise = client.models.generateContent({
				model: this.MODEL,
				contents: [
					{
						role: 'user',
						parts: [
							{ text: referencePrompt },
							...imageParts
						]
					}
				],
				config: {
					responseModalities: ['IMAGE', 'TEXT'],
					safetySettings: [
						{ category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
						{ category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
						{ category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
						{ category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
					]
				}
			});

			const response = await this.withTimeout(
				generatePromise,
				this.TIMEOUT_MS,
				'Gemini image generation with reference'
			);

			if (!response.candidates || response.candidates.length === 0) {
				throw new GeminiGenerationError('Gemini returned no candidates');
			}

			const candidate = response.candidates[0];
			const parts = candidate.content?.parts || [];

			for (let i = 0; i < parts.length; i++) {
				const part = parts[i] as any;

				if (part.inlineData) {
					const mimeType = part.inlineData.mimeType || 'image/png';
					const data = part.inlineData.data;

					if (data && data.length > 0) {
						return { mimeType, data };
					}
				}
			}

			throw new GeminiGenerationError('Gemini did not generate any images with reference');

		} catch (error: any) {
			this.logger.error(`Gemini Reference Generation Failed: ${error.message}`);
			return this.generateImage(prompt, undefined, aspectRatio, resolution, userApiKey);
		}
	}

	async generateBatch(prompts: string[], aspectRatio?: string, resolution?: string): Promise<GeminiImageResult[]> {
		const results: GeminiImageResult[] = [];

		for (const prompt of prompts) {
			try {
				const result = await this.generateImage(prompt, undefined, aspectRatio, resolution);
				results.push(result);
			} catch (error) {
				this.logger.error(`Batch generation failed for prompt: ${prompt.substring(0, 50)}...`);
			}
		}

		return results;
	}

	private sanitizePromptForImageGeneration(prompt: string): string {
		if (!prompt) return '';
		// Simplified sanitization for brevity, matches user intent to clean prompt
		return prompt.replace(/\b(nude|naked|topless)\b/gi, '');
	}

	async analyzeProduct(input: { images: string[]; productName?: string }): Promise<AnalyzedProductJSON> {
		if (!input.images || input.images.length === 0) {
			throw new BadRequestException(FileMessage.FILE_NOT_FOUND);
		}

		const client = this.getClient();
		let promptText = PRODUCT_ANALYSIS_PROMPT;
		if (input.productName) {
			promptText += `\n\nProduct name: ${input.productName}`;
		}

		const imageParts = await this.buildImageParts(input.images);

		try {
			const response = await client.models.generateContent({
				model: this.MODEL,
				contents: [
					{
						role: 'user',
						parts: [
							{ text: promptText },
							...imageParts
						]
					}
				]
			});

			const candidate = response.candidates?.[0];
			if (!candidate || !candidate.content?.parts) {
				throw new InternalServerErrorException('No response from Gemini');
			}

			let textResponse = '';
			for (const part of candidate.content.parts) {
				if ((part as any).text) {
					textResponse += (part as any).text;
				}
			}

			const parsed = this.parseJson(textResponse);
			if (!parsed) throw new InternalServerErrorException('Failed to parse product analysis');

			return {
				...parsed,
				analyzed_at: new Date().toISOString(),
			};

		} catch (error: any) {
			throw new InternalServerErrorException(`Gemini analysis error: ${error.message}`);
		}
	}

	private async buildImageParts(images: string[]): Promise<any[]> {
		const parts: any[] = [];

		for (const image of images) {
			try {
				let base64Data: string;
				let mimeType = 'image/jpeg';

				if (image.startsWith('http://') || image.startsWith('https://')) {
					const response = await fetch(image);
					if (!response.ok) continue;
					const buffer = Buffer.from(await response.arrayBuffer());
					base64Data = buffer.toString('base64');
					mimeType = response.headers.get('content-type') || 'image/jpeg';
				} else if (image.startsWith('data:')) {
					const matches = image.match(/^data:([^;]+);base64,(.+)$/);
					if (matches) {
						mimeType = matches[1];
						base64Data = matches[2];
					} else continue;
				} else {
					if (!fs.existsSync(image)) continue;
					const buffer = fs.readFileSync(image);
					base64Data = buffer.toString('base64');
					if (image.endsWith('.png')) mimeType = 'image/png';
				}

				parts.push({
					inlineData: {
						mimeType,
						data: base64Data
					}
				});
			} catch (error) {
				this.logger.error(`Failed to load image part: ${image}`);
			}
		}

		if (parts.length === 0) {
			throw new BadRequestException('No valid images could be loaded');
		}

		return parts;
	}

	private parseJson(text: string): any {
		if (!text) return null;
		try {
			return JSON.parse(text);
		} catch {
			const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
			return jsonMatch ? JSON.parse(jsonMatch[1]) : null;
		}
	}

	async analyzeDAReference(imageUrl: string): Promise<AnalyzedDAJSON> {
		const client = this.getClient();
		const parts = await this.buildImageParts([imageUrl]);

		try {
			const response = await client.models.generateContent({
				model: this.ANALYSIS_MODEL,
				contents: [
					{
						role: 'user',
						parts: [
							{ text: DA_ANALYSIS_PROMPT },
							...parts
						]
					}
				]
			});

			const candidate = response.candidates?.[0];
			let textResponse = '';
			if (candidate?.content?.parts) {
				for (const part of candidate.content.parts) {
					if ((part as any).text) textResponse += (part as any).text;
				}
			}

			const parsed = this.parseJson(textResponse);
			if (!parsed) throw new InternalServerErrorException('Failed to parse DA analysis');

			return {
				...parsed,
				analyzed_at: new Date().toISOString(),
			};
		} catch (error: any) {
			throw new InternalServerErrorException(`Gemini DA analysis error: ${error.message}`);
		}
	}

	private getClient(userApiKey?: string): GoogleGenAI {
		if (userApiKey && userApiKey.trim() && !userApiKey.includes('****')) {
			return new GoogleGenAI({ apiKey: userApiKey });
		}
		if (this.client) return this.client;

		const apiKey = this.configService.get<string>('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
		if (!apiKey) throw new InternalServerErrorException(AIMessage.API_KEY_MISSING);

		this.client = new GoogleGenAI({ apiKey });
		return this.client;
	}

	getApiKeyStatus(): { hasSystemKey: boolean; systemKeyMasked: string | null } {
		const apiKey = this.configService.get<string>('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
		return {
			hasSystemKey: !!apiKey,
			systemKeyMasked: apiKey ? `${apiKey.substring(0, 10)}****${apiKey.substring(apiKey.length - 4)}` : null,
		};
	}

	getModel(): string {
		return this.MODEL;
	}
}
