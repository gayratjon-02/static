import { Injectable, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { AIMessage, FileMessage } from '../enums/brand/brand.enum'; // Updated path based on previous step
import { GEMINI_MODEL, GeminiImageResult } from '../config'; // Updated path
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

	// ── Circuit Breaker ──────────────────────────────────────────────────────
	private circuitState: 'closed' | 'open' | 'half-open' = 'closed';
	private failureCount = 0;
	private lastFailureTime = 0;
	private readonly FAILURE_THRESHOLD = 5;
	private readonly RECOVERY_TIMEOUT_MS = 60_000; // 1 minute

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

	constructor(private readonly configService: ConfigService) {
		const apiKey = this.configService.get<string>('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
		this.logger.log(`═══════════════════════════════════════════`);
		this.logger.log(`🤖 Gemini Service initialized`);
		this.logger.log(`📋 Model: ${this.MODEL}`);
		this.logger.log(`⏱️ Timeout: ${this.TIMEOUT_MS / 1000}s (${this.TIMEOUT_MS / 60000} min)`);
		this.logger.log(
			`🔑 API Key: ${apiKey ? `${apiKey.substring(0, 8)}****${apiKey.substring(apiKey.length - 4)}` : '❌ MISSING!'}`,
		);
		this.logger.log(`═══════════════════════════════════════════`);
	}

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
						buffer: Buffer.from(result.data, 'base64'),
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

	private withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
		return new Promise((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				reject(
					new GeminiTimeoutError(
						`⏱️ ${operationName} timed out after ${timeoutMs / 1000} seconds (${timeoutMs / 60000} minutes)`,
					),
				);
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

	async generateImages(
		prompt: string,
		aspectRatio?: string,
		_resolution?: string,
		userApiKey?: string,
	): Promise<{ images: GeminiImageResult[] }> {
		const client = this.getClient(userApiKey);
		const startTime = Date.now();

		const ratioText = this.mapAspectRatioToGemini(aspectRatio ?? '1:1');

		if (!prompt) {
			this.logger.error('❌ CRITICAL: generateImages called with EMPTY/UNDEFINED prompt!');
			throw new GeminiGenerationError('Prompt string is required');
		}

		const sanitizedPrompt = this.sanitizePromptForImageGeneration(prompt);

		const enhancedPrompt = `Professional commercial advertisement photo. ${sanitizedPrompt}. High quality studio lighting, sharp details, clean background, modern minimal design. CRITICAL: Any human models must be FULLY CLOTHED.`;

		const requestId = Math.random().toString(36).substring(2, 8);
		this.logger.log(`🎨 [${requestId}] ===== IMAGEN START | ${ratioText} | Model: ${this.MODEL} =====`);
		this.logger.log(`🎨 [${requestId}] Prompt length: ${enhancedPrompt.length} chars`);

		try {
			this.checkCircuitBreaker();

			const generatePromise = (client.models as any).generateImages({
				model: this.MODEL,
				prompt: enhancedPrompt,
				config: {
					numberOfImages: 1,
					aspectRatio: ratioText,
				},
			});

			const response = await this.withTimeout(generatePromise, this.TIMEOUT_MS, 'Imagen image generation');

			const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
			this.logger.log(`✅ [${requestId}] Response received in ${elapsedTime}s | ${ratioText}`);

			const generatedImages = (response as any)?.generatedImages;

			if (!generatedImages || generatedImages.length === 0) {
				this.logger.error(`❌ [${requestId}] No images returned from Imagen`);
				throw new GeminiGenerationError('Imagen returned no images');
			}

			const images: GeminiImageResult[] = [];

			for (const generatedImage of generatedImages) {
				const imageBytes = generatedImage?.image?.imageBytes;
				const mimeType = generatedImage?.image?.mimeType || 'image/jpeg';

				if (imageBytes) {
					images.push({ mimeType, data: imageBytes as string });
				}
			}

			if (images.length === 0) {
				this.logger.error(`❌ [${requestId}] No image bytes in Imagen response`);
				throw new GeminiGenerationError('Imagen did not return any image bytes');
			}

			const totalSize = images.reduce((sum, img) => sum + (img.data?.length || 0), 0);
			this.logger.log(
				`✅ [${requestId}] SUCCESS | ${images.length} image(s) | ~${(totalSize / 1024).toFixed(0)}KB | ${elapsedTime}s | ${ratioText}`,
			);
			this.recordSuccess();
			return { images };
		} catch (error: any) {
			const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
			const errorMessage = error?.message || String(error);
			const statusCode = error?.status || error?.statusCode || error?.code || 'unknown';

			if (error instanceof GeminiTimeoutError) {
				this.logger.error(
					`⏱️ TIMEOUT after ${elapsedTime}s | Ratio: ${ratioText} | Timeout limit: ${this.TIMEOUT_MS / 1000}s`,
				);
				this.recordFailure(errorMessage);
				throw new InternalServerErrorException(`Image generation timed out after ${this.TIMEOUT_MS / 60000} minutes.`);
			}

			if (error instanceof GeminiGenerationError) {
				this.logger.error(`🚫 GENERATION ERROR after ${elapsedTime}s | ${error.message}`);
				this.recordFailure(errorMessage);
				throw new InternalServerErrorException(error.message);
			}

			if (statusCode === 429 || errorMessage.includes('quota') || errorMessage.includes('rate')) {
				this.logger.error(`💰 RATE LIMIT / QUOTA ERROR | Status: ${statusCode} | ${errorMessage}`);
			} else if (statusCode === 403 || errorMessage.includes('permission') || errorMessage.includes('billing')) {
				this.logger.error(`🔒 BILLING / PERMISSION ERROR | Status: ${statusCode} | ${errorMessage}`);
			} else if (statusCode === 401 || errorMessage.includes('API key') || errorMessage.includes('auth')) {
				this.logger.error(`🔑 AUTH ERROR — Invalid API key | Status: ${statusCode} | ${errorMessage}`);
			} else {
				this.logger.error(`❌ IMAGEN ERROR after ${elapsedTime}s | Status: ${statusCode} | ${errorMessage}`);
			}

			this.recordFailure(errorMessage);
			throw new InternalServerErrorException(`Imagen error: ${errorMessage.substring(0, 300)}`);
		}
	}

	async generateImage(
		prompt: string,
		_modelName?: string,
		aspectRatio?: string,
		resolution?: string,
		userApiKey?: string,
	): Promise<GeminiImageResult> {
		const maxRetries = 4;
		const retryDelays = [5000, 15000, 30000, 45000]; // 5s, 15s, 30s, 45s

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				if (attempt > 0) {
					const delay = retryDelays[attempt - 1] || 30000;
					this.logger.log(`🔄 Retry #${attempt}/${maxRetries - 1} — waiting ${delay / 1000}s before retry...`);
					await new Promise((resolve) => setTimeout(resolve, delay));
				}

				const result = await this.generateImages(prompt, aspectRatio, resolution, userApiKey);

				if (result.images.length > 0) {
					if (attempt > 0) {
						this.logger.log(`✅ Retry #${attempt} SUCCESS`);
					}
					return result.images[0];
				}

				throw new GeminiGenerationError('No images generated');
			} catch (error: any) {
				const isLastAttempt = attempt === maxRetries - 1;
				const errMsg = error?.message || String(error);

				// Check if this is a retryable error
				const is503 = errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('high demand');
				const isTimeout = errMsg.includes('timed out') || errMsg.includes('timeout');
				const is429 = errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('rate');
				const isRetryable = is503 || isTimeout || is429;

				// Non-retryable: safety violations, policy blocks
				if (errMsg.includes('violates') || errMsg.includes('safety') || errMsg.includes('refused')) {
					this.logger.error(`🚫 Non-retryable error (safety/policy): ${errMsg.substring(0, 200)}`);
					throw error;
				}

				if (isRetryable && !isLastAttempt) {
					const reason = is503 ? '503 UNAVAILABLE' : isTimeout ? 'TIMEOUT' : '429 RATE LIMIT';
					this.logger.warn(`⚠️ Attempt ${attempt + 1}/${maxRetries} failed: ${reason} — will retry`);
					continue;
				}

				if (isLastAttempt) {
					this.logger.error(`❌ All ${maxRetries} attempts failed. Last error: ${errMsg.substring(0, 200)}`);
				}
				throw error;
			}
		}

		throw new InternalServerErrorException(AIMessage.GEMINI_API_ERROR);
	}

	async generateImageWithReference(
		prompt: string,
		referenceImages: string[],
		aspectRatio?: string,
		resolution?: string,
		userApiKey?: string,
	): Promise<GeminiImageResult> {
		const validImages = (referenceImages || []).filter((img) => img && img.trim() !== '');

		if (validImages.length === 0) {
			return this.generateImage(prompt, undefined, aspectRatio, resolution, userApiKey);
		}

		try {
			// Step 1: Use Gemini Vision to analyze product images and get detailed visual description
			const client = this.getClient(userApiKey);
			const imageParts = await this.buildImageParts(validImages);

			const analysisPrompt = `You are a professional product photographer and designer analyzing a product image to create a pixel-perfect visual description for advertisement generation. Be EXTREMELY precise and exhaustive.

Analyze and describe ALL of the following:

SHAPE & STRUCTURE:
- Overall form (geometric shape, silhouette, outline)
- Exact proportions (width:height:depth ratios, if estimable)
- All structural components, parts, segments, and how they connect
- Edges (sharp, rounded, beveled), curves, angles
- Surface topology (flat, convex, concave, ridged, embossed)

COLORS (be exact):
- Primary color(s) with specific shade names (e.g. "matte charcoal grey", "warm ivory white", "electric teal #00C2A8")
- Secondary and accent colors and exactly where they appear
- Gradient, ombre, or color transition areas
- Metallic, iridescent, or special finish colors

MATERIALS & FINISH:
- Material type for each part (plastic, rubber, metal, fabric, glass, silicone, etc.)
- Surface finish (matte, semi-matte, glossy, satin, brushed metal, textured rubber, soft-touch)
- Transparency or opacity of each component
- Any reflective or shiny areas

BRANDING & TEXT:
- Logo: exact position, size relative to product, color, font style
- Any text or labels on product: exact wording, font style, size, color, placement
- Symbols, icons, patterns, engravings, or embossed text

FINE DETAILS:
- Buttons, switches, ports, seams, stitching, joints
- Patterns or textures on surface (knurling, mesh, weave, grain)
- Any accessories, attachments, or separate components shown
- Packaging elements if visible (box, wrapper, label)

SCALE & CONTEXT:
- Estimated real-world size (small handheld / medium / large)
- Any scale reference visible (hand, table, common object)
- Product orientation in image (front view, side, angle, flat lay)

Output a dense, structured description covering every point above. Do not omit anything visible. This will be used to recreate the product in a photorealistic advertisement.`;

			const analysisResponse = await client.models.generateContent({
				model: this.ANALYSIS_MODEL,
				contents: [{ role: 'user', parts: [{ text: analysisPrompt }, ...imageParts] }],
			});

			const productDescription = (analysisResponse.candidates?.[0]?.content?.parts || [])
				.filter((p: any) => p.text)
				.map((p: any) => p.text)
				.join('');

			if (productDescription) {
				this.logger.log(`🔍 Product analysis done (${productDescription.length} chars) — feeding into Imagen`);
			}

			// Step 2: Pass the detailed product description into the Imagen prompt
			const enrichedPrompt = productDescription
				? `${prompt}\n\n[PRODUCT VISUAL REFERENCE — render exactly as described]: ${productDescription}`
				: prompt;

			return this.generateImage(enrichedPrompt, undefined, aspectRatio, resolution, userApiKey);
		} catch (error: any) {
			this.logger.error(`Product analysis failed: ${error.message} — falling back to prompt-only generation`);
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

	// ── Circuit Breaker Methods ──────────────────────────────────────────────

	private checkCircuitBreaker(): void {
		if (this.circuitState === 'open') {
			const now = Date.now();
			if (now - this.lastFailureTime >= this.RECOVERY_TIMEOUT_MS) {
				this.circuitState = 'half-open';
				this.logger.warn(`🔄 Circuit breaker HALF-OPEN — testing Gemini API recovery`);
			} else {
				const waitSecs = Math.ceil((this.RECOVERY_TIMEOUT_MS - (now - this.lastFailureTime)) / 1000);
				throw new InternalServerErrorException(
					`Gemini API temporarily unavailable. Circuit breaker open. Retry in ${waitSecs}s`,
				);
			}
		}
	}

	private recordSuccess(): void {
		if (this.circuitState !== 'closed') {
			this.logger.log(`✅ Circuit breaker CLOSED — Gemini API recovered`);
		}
		this.circuitState = 'closed';
		this.failureCount = 0;
	}

	private recordFailure(errMsg: string): void {
		// Don't trip circuit for rate limits or safety violations — these aren't infrastructure failures
		const isRateLimit = errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('rate');
		const isSafety = errMsg.includes('violates') || errMsg.includes('safety') || errMsg.includes('refused');
		if (isRateLimit || isSafety) return;

		this.failureCount++;
		this.lastFailureTime = Date.now();

		if (this.failureCount >= this.FAILURE_THRESHOLD || this.circuitState === 'half-open') {
			this.circuitState = 'open';
			this.logger.error(
				`🔴 Circuit breaker OPEN after ${this.failureCount} failures — Gemini paused for ${this.RECOVERY_TIMEOUT_MS / 1000}s`,
			);
		} else {
			this.logger.warn(`⚠️ Circuit breaker failure count: ${this.failureCount}/${this.FAILURE_THRESHOLD}`);
		}
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
				model: this.ANALYSIS_MODEL,
				contents: [
					{
						role: 'user',
						parts: [{ text: promptText }, ...imageParts],
					},
				],
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
						data: base64Data,
					},
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
						parts: [{ text: DA_ANALYSIS_PROMPT }, ...parts],
					},
				],
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
			this.logger.log(`🔑 Using USER API key: ${userApiKey.substring(0, 8)}****`);
			return new GoogleGenAI({ apiKey: userApiKey });
		}
		if (this.client) return this.client;

		const apiKey = this.configService.get<string>('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
		if (!apiKey) {
			this.logger.error(`❌ GEMINI_API_KEY is MISSING! Check .env or docker-compose environment.`);
			throw new InternalServerErrorException(AIMessage.API_KEY_MISSING);
		}

		this.logger.log(`🔑 Using SYSTEM API key: ${apiKey.substring(0, 8)}****${apiKey.substring(apiKey.length - 4)}`);
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
