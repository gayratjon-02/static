import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { AIMessage } from '../enums/brand/brand.enum';
import { GEMINI_MODEL, GeminiImageResult } from '../config';

export interface GeneratedImage {
	ratio: string;
	buffer: Buffer;
}

export interface ReferenceImageMeta {
	productImageCount: number;
	hasLogo: boolean;
	hasConcept: boolean;
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
			// Convert hex colors to descriptive names to prevent them appearing as text in generated images
			fullPrompt += `\n\nBrand color palette: Primary ${this.hexToColorName(brandColors.primary?.replace('#', '') || '333333')}, Secondary ${this.hexToColorName(brandColors.secondary?.replace('#', '') || '666666')}, Accent ${this.hexToColorName(brandColors.accent?.replace('#', '') || '999999')}, Background ${this.hexToColorName(brandColors.background?.replace('#', '') || 'ffffff')}`;
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
		referenceImageParts?: Array<{ data: string; mimeType: string }>,
		imageMeta?: ReferenceImageMeta,
	): Promise<{ images: GeminiImageResult[] }> {
		const client = this.getClient(userApiKey);
		const startTime = Date.now();

		const ratioText = this.mapAspectRatioToGemini(aspectRatio ?? '1:1');

		if (!prompt) {
			this.logger.error('❌ CRITICAL: generateImages called with EMPTY/UNDEFINED prompt!');
			throw new GeminiGenerationError('Prompt string is required');
		}

		const sanitizedPrompt = this.sanitizePromptForImageGeneration(prompt);

		const refCount = referenceImageParts?.length ?? 0;
		const referenceInstructions = this.buildReferenceInstructions(refCount, imageMeta);

		const aspectInstruction = `Generate this image in ${ratioText} aspect ratio.`;

		const enhancedPrompt = `${referenceInstructions}${aspectInstruction}\n\nProfessional commercial advertisement photo. ${sanitizedPrompt}. High quality studio lighting, sharp details, clean background, modern minimal design. CRITICAL: Any human models must be FULLY CLOTHED. Do NOT render any hex codes, color codes, or technical codes as visible text in the image. Render all text EXACTLY as specified with correct spelling. CRITICAL: Maintain the exact same color palette across all variations — do not shift or alter brand colors.\n\n═══ IGNORE TECHNICAL TEXT (CRITICAL) ═══\nThe image must contain ONLY the marketing text listed in TEXT RENDERING REQUIREMENTS above.\nDo NOT render ANY of the following as visible text in the image:\n- Pixel dimensions (e.g. "115px", "1080x1080", "48pt")\n- CSS values or code (e.g. "font-size", "margin", "padding")\n- File paths, URLs, or technical identifiers\n- Numbers followed by units (px, rem, em, pt, vw, vh)\n- Aspect ratio labels (e.g. "1:1", "9:16", "16:9")\n- Any debug, metadata, or instructional text from this prompt\nIf you see ANY technical-looking text in this prompt, it is an INSTRUCTION — do NOT render it visually.\n\n═══ WORD DUPLICATION PREVENTION ═══\n- NEVER render the same word twice in a row.\n- Before starting each new line of text, check the last word of the previous line — do NOT repeat it.\n- Wrong: "both both", "my my", "the the", "and and" — each word must appear only ONCE.\n- The rendered word count must EXACTLY match the word count specified in TEXT RENDERING REQUIREMENTS.\n- If the text says 8 words, render exactly 8 words — no more, no fewer.\n\n═══ FINAL REMINDER — TEXT ACCURACY ═══\nBefore generating the image, verify EVERY word you are about to render:\n1. Check each word letter by letter against the TEXT RENDERING REQUIREMENTS section above.\n2. If a word looks wrong or you are unsure of the spelling, OMIT the word entirely.\n3. Render FEWER words perfectly rather than MORE words with errors.\n4. NEVER invent, paraphrase, or abbreviate any text — copy the exact strings provided.\n5. Short, simple words only — if the text is long, prioritize the headline and CTA.\n6. NEVER render dimension values, CSS properties, or technical metadata as visible text.\n7. NEVER duplicate a word — scan for consecutive identical words and remove the duplicate.`;

		const requestId = Math.random().toString(36).substring(2, 8);
		this.logger.log(`🎨 [${requestId}] ===== GEMINI FLASH IMAGE START | ${ratioText} | Model: ${this.MODEL} | Refs: ${refCount} =====`);
		this.logger.log(`🎨 [${requestId}] Prompt length: ${enhancedPrompt.length} chars`);

		try {
			this.checkCircuitBreaker();

			// Build content parts: TEXT FIRST (highest priority), then images
			// Placing text before images ensures Gemini prioritizes written instructions
			// over any text visible in reference images (prevents content cross-contamination)
			const contentParts: any[] = [];

			contentParts.push({ text: enhancedPrompt });

			if (referenceImageParts) {
				for (const img of referenceImageParts) {
					contentParts.push({
						inlineData: {
							mimeType: img.mimeType,
							data: img.data,
						},
					});
				}
			}

			const generatePromise = client.models.generateContent({
				model: this.MODEL,
				contents: contentParts,
				config: {
					responseModalities: ['Text', 'Image'],
					imageConfig: {
						aspectRatio: ratioText,
					},
				},
			});

			const response = await this.withTimeout(generatePromise, this.TIMEOUT_MS, 'Gemini Flash image generation');

			const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
			this.logger.log(`✅ [${requestId}] Response received in ${elapsedTime}s | ${ratioText}`);

			// Parse Gemini generateContent response — look for inlineData in candidates parts
			const images: GeminiImageResult[] = [];

			const parts = (response as any)?.candidates?.[0]?.content?.parts;
			if (parts) {
				for (const part of parts) {
					if (part.inlineData) {
						images.push({
							mimeType: part.inlineData.mimeType || 'image/png',
							data: part.inlineData.data,
						});
					}
				}
			}

			if (images.length === 0) {
				this.logger.error(`❌ [${requestId}] No images in Gemini Flash response`);
				throw new GeminiGenerationError('Gemini Flash Image returned no images');
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
				this.logger.error(`❌ GEMINI FLASH ERROR after ${elapsedTime}s | Status: ${statusCode} | ${errorMessage}`);
			}

			this.recordFailure(errorMessage);
			throw new InternalServerErrorException(`Gemini Flash error: ${errorMessage.substring(0, 300)}`);
		}
	}

	async generateImage(
		prompt: string,
		_modelName?: string,
		aspectRatio?: string,
		resolution?: string,
		userApiKey?: string,
		referenceImageParts?: Array<{ data: string; mimeType: string }>,
		imageMeta?: ReferenceImageMeta,
	): Promise<GeminiImageResult> {
		try {
			const result = await this.generateImages(prompt, aspectRatio, resolution, userApiKey, referenceImageParts, imageMeta);

			if (result.images.length > 0) {
				return result.images[0];
			}

			throw new GeminiGenerationError('No images generated');
		} catch (error: any) {
			const errMsg = error?.message || String(error);
			this.logger.error(`❌ Image generation failed. Error: ${errMsg.substring(0, 200)}`);
			throw error;
		}
	}

	async generateImageWithReference(
		prompt: string,
		referenceImages: string[],
		aspectRatio?: string,
		resolution?: string,
		userApiKey?: string,
		productDescription?: string,
		imageMeta?: ReferenceImageMeta,
	): Promise<GeminiImageResult> {
		const imageParts: Array<{ data: string; mimeType: string }> = [];
		for (const url of (referenceImages ?? [])) {
			if (!url) continue;
			try {
				const { base64, mimeType } = await this.downloadImageAsBase64(url);
				imageParts.push({ data: base64, mimeType });
			} catch (err: unknown) {
				const errMsg = err instanceof Error ? err.message : String(err);
				this.logger.warn(`Failed to download reference image: ${url.substring(0, 80)} — ${errMsg}`);
			}
		}

		let enrichedPrompt = prompt;
		if (productDescription) {
			enrichedPrompt = `${prompt}\n\n═══ PRODUCT VISUAL REFERENCE (HIGHEST PRIORITY) ═══\nRender the product EXACTLY as described below — do NOT generate a different-looking product.\nThe product must be LARGE and PROMINENT — occupy 40–60% of the image area.\nALL text visible on the product packaging (labels, brand name, ingredients) must be:\n  • PIXEL-PERFECT — sharp edges, no blur, no smearing\n  • CORRECTLY SPELLED — copy every letter exactly from the description\n  • READABLE at the rendered size — if text would be too small to read, scale the product up\nDo NOT invent, alter, or garble any packaging text.\n\nProduct details:\n${productDescription}\n═══════════════════════════════════════════════════`;
		}

		return this.generateImage(enrichedPrompt, undefined, aspectRatio, resolution, userApiKey, imageParts.length > 0 ? imageParts : undefined, imageMeta);
	}

	/**
	 * Generate image with retry logic — 3 attempts with simplified prompt fallback.
	 * Returns null data instead of throwing on total failure.
	 */
	async generateImageWithRetry(
		prompt: string,
		referenceImages: string[],
		aspectRatio: string,
		variationLabel: string,
		productDescription?: string,
		imageMeta?: ReferenceImageMeta,
	): Promise<{ data: string | null; error: string | null }> {
		const MAX_RETRIES = 3;
		const strategies = ['original', 'simplified', 'minimal'] as const;

		for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
			try {
				const currentPrompt = attempt === 0
					? prompt
					: this.simplifyPrompt(prompt, strategies[attempt]);

				if (attempt > 0) {
					this.logger.warn(`Retry ${attempt + 1}/${MAX_RETRIES} for ${variationLabel} using "${strategies[attempt]}" strategy`);
				}

				const result = await this.generateImageWithReference(
					currentPrompt,
					referenceImages,
					aspectRatio,
					undefined,
					undefined,
					productDescription,
					imageMeta,
				);

				if (result?.data) {
					if (attempt > 0) {
						this.logger.log(`Retry succeeded for ${variationLabel} on attempt ${attempt + 1}`);
					}
					return { data: result.data, error: null };
				}

				throw new GeminiGenerationError(`No data returned for ${variationLabel}`);
			} catch (error: any) {
				this.logger.warn(
					`Generation attempt ${attempt + 1}/${MAX_RETRIES} failed for ${variationLabel}: ${error.message?.substring(0, 200)}`,
				);

				// Wait before retry (exponential backoff: 1s, 2s, 4s)
				if (attempt < MAX_RETRIES - 1) {
					const delay = Math.pow(2, attempt) * 1000;
					await new Promise((resolve) => setTimeout(resolve, delay));
				}

				// Content policy errors → skip to simplified strategy immediately
				if (this.isContentPolicyError(error) && attempt === 0) {
					this.logger.warn(`Content policy rejection for ${variationLabel} — jumping to simplified strategy`);
				}
			}
		}

		this.logger.error(`All ${MAX_RETRIES} attempts failed for ${variationLabel}`);
		return {
			data: null,
			error: `Image generation failed after ${MAX_RETRIES} attempts. Please retry this variation.`,
		};
	}

	/**
	 * Simplify prompt for retry attempts — reduces complex instructions that may cause failures.
	 */
	private simplifyPrompt(originalPrompt: string, strategy: string): string {
		switch (strategy) {
			case 'simplified':
				// Remove complex layout instructions, keep core elements
				return originalPrompt
					.replace(/position(ed)?\s+(exactly|precisely)\s+/gi, 'place ')
					.replace(
						/floating\s+review\s+cards?\s+arranged\s+in\s+a\s+\w+\s+pattern/gi,
						'review cards around the product',
					)
					.replace(/with\s+subtle\s+drop\s+shadow\s+of\s+\d+px/gi, 'with shadow')
					.replace(/\d+px\s+(gap|margin|padding|spacing)/gi, 'appropriate spacing')
					.replace(/\d+%\s+(opacity|transparency)/gi, 'subtle transparency');

			case 'minimal': {
				// Extract just the essential: product + headline + brand colors
				const lines = originalPrompt.split('\n');
				const essentialLines = lines.filter(
					(line) =>
						line.toLowerCase().includes('headline') ||
						line.toLowerCase().includes('product') ||
						line.toLowerCase().includes('logo') ||
						line.toLowerCase().includes('background') ||
						line.toLowerCase().includes('color palette') ||
						line.toLowerCase().includes('brand color'),
				);
				return `Create a clean, professional Facebook ad image.\n${essentialLines.join('\n')}`;
			}

			default:
				return originalPrompt;
		}
	}

	/**
	 * Check if an error is a content policy rejection (different handling for retries).
	 */
	private isContentPolicyError(error: any): boolean {
		const message = error?.message?.toLowerCase() || '';
		return (
			message.includes('safety') ||
			message.includes('policy') ||
			message.includes('blocked') ||
			message.includes('harm') ||
			message.includes('violates') ||
			message.includes('refused')
		);
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

		let sanitized = prompt;

		// Strip hex color codes — Gemini/Imagen renders them as visible text
		sanitized = sanitized.replace(
			/#([0-9a-fA-F]{3,8})\b/g,
			(_match, hex) => {
				const colorName = this.hexToColorName(hex);
				this.logger.warn(`Stripped hex code #${hex} from prompt, replaced with "${colorName}"`);
				return colorName;
			},
		);

		// Strip CSS dimension values — Gemini renders "115px", "48px", "20rem" as visible text
		sanitized = sanitized.replace(/\b\d+(\.\d+)?\s*px\b/gi, 'appropriate size');
		sanitized = sanitized.replace(/\b\d+(\.\d+)?\s*rem\b/gi, 'appropriate size');
		sanitized = sanitized.replace(/\b\d+(\.\d+)?\s*em\b/gi, 'appropriate size');
		sanitized = sanitized.replace(/\b\d+(\.\d+)?\s*pt\b/gi, 'appropriate size');
		sanitized = sanitized.replace(/\b\d+(\.\d+)?\s*vw\b/gi, 'appropriate size');
		sanitized = sanitized.replace(/\b\d+(\.\d+)?\s*vh\b/gi, 'appropriate size');

		// Strip pixel dimension pairs like "1080x1080", "1920x1080"
		sanitized = sanitized.replace(/\b\d{3,4}\s*x\s*\d{3,4}\b/gi, '');

		// Strip CSS-like property patterns: "font-size: 48px", "margin: 20px 10px"
		sanitized = sanitized.replace(/\b(font-size|margin|padding|border-radius|gap|spacing|line-height|letter-spacing|width|height|top|left|right|bottom)\s*:\s*[\d\s.]+\w*/gi, '');

		// Strip percentage values used as dimensions (e.g., "80% width")
		sanitized = sanitized.replace(/\b\d+(\.\d+)?%\s*(opacity|transparency|width|height)/gi, 'subtle $2');

		// Strip file paths and URLs that shouldn't appear in image
		sanitized = sanitized.replace(/(?:\/[\w.-]+){2,}/g, '');

		// Clean up duplicate whitespace from removals
		sanitized = sanitized.replace(/\s{2,}/g, ' ').trim();

		// Remove nude/naked/topless references
		sanitized = sanitized.replace(/\b(nude|naked|topless)\b/gi, '');

		return sanitized;
	}

	/**
	 * Fallback hex → color name converter.
	 * Last line of defense if Claude's prompt still contains hex codes.
	 */
	private hexToColorName(hex: string): string {
		// Normalize to 6-digit hex
		let fullHex = hex;
		if (hex.length === 3) {
			fullHex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
		}
		if (fullHex.length < 6) return 'neutral color';

		const r = parseInt(fullHex.substring(0, 2), 16);
		const g = parseInt(fullHex.substring(2, 4), 16);
		const b = parseInt(fullHex.substring(4, 6), 16);
		const brightness = (r * 299 + g * 587 + b * 114) / 1000;

		if (brightness > 240) return 'pure white';
		if (brightness < 30) return 'pure black';

		// Check for grays
		if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20) {
			if (brightness > 180) return 'light gray';
			if (brightness > 100) return 'medium gray';
			return 'dark charcoal gray';
		}

		// Dominant channel
		const max = Math.max(r, g, b);
		const dominantColor =
			max === r
				? g > 150 ? 'warm yellow-orange' : b > 100 ? 'deep magenta pink' : 'rich red'
				: max === g
					? r > 150 ? 'lime yellow-green' : b > 100 ? 'teal cyan' : 'forest green'
					: r > 100 ? 'deep purple' : g > 100 ? 'ocean teal blue' : 'deep navy blue';

		if (brightness > 180) return `light ${dominantColor}`;
		if (brightness < 80) return `dark ${dominantColor}`;
		return dominantColor;
	}

	/**
	 * Download image from URL as base64 (for Gemini Flash Image inlineData input).
	 */
	private async downloadImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
		const response = await fetch(url);
		if (!response.ok) throw new Error(`Image download failed: ${response.status}`);
		const buffer = await response.arrayBuffer();
		const base64 = Buffer.from(buffer).toString('base64');
		const contentType = response.headers.get('content-type') || '';
		const mimeType = this.detectMediaType(base64, contentType);
		return { base64, mimeType };
	}

	private detectMediaType(base64Data: string, contentTypeHeader?: string): string {
		const header = base64Data.substring(0, 20);
		if (header.startsWith('/9j/')) return 'image/jpeg';
		if (header.startsWith('iVBOR')) return 'image/png';
		if (header.startsWith('UklGR')) return 'image/webp';
		if (header.startsWith('R0lGO')) return 'image/gif';
		if (contentTypeHeader && contentTypeHeader.startsWith('image/')) {
			return contentTypeHeader.split(';')[0].trim();
		}
		return 'image/jpeg';
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

	// ── Dynamic Reference Image Labeling ────────────────────────────────────

	private buildReferenceInstructions(refCount: number, meta?: ReferenceImageMeta): string {
		if (refCount === 0) return '';

		const lines: string[] = ['REFERENCE IMAGES PROVIDED:'];
		let idx = 1;

		if (meta) {
			const { productImageCount, hasLogo, hasConcept } = meta;

			if (productImageCount >= 1) {
				lines.push(this.buildProductFrontLabel(idx));
				idx++;
			}
			if (productImageCount >= 2) {
				lines.push(this.buildProductBackLabel(idx));
				idx++;
			}
			for (let i = 2; i < productImageCount; i++) {
				lines.push(`- Image ${idx}: PRODUCT REFERENCE ANGLE ${i - 1} — additional product view. Use to understand the product shape, colors, and details from another angle.`);
				idx++;
			}
			if (hasLogo) {
				lines.push(this.buildLogoLabel(idx));
				idx++;
			}
			if (hasConcept) {
				lines.push(this.buildConceptLabel(idx));
				idx++;
			}
		} else {
			if (refCount >= 1) lines.push(this.buildProductFrontLabel(1));
			if (refCount >= 2) lines.push(this.buildLogoLabel(2));
			if (refCount >= 3) lines.push(this.buildConceptLabel(3));
		}

		return lines.join('\n') + '\n\n';
	}

	private buildProductFrontLabel(idx: number): string {
		return [
			`- Image ${idx}: PRODUCT FRONT IMAGE — this is the primary product view.`,
			'  ═══ PRODUCT RENDERING RULES (CRITICAL) ═══',
			'  • Render the product LARGE — it should occupy 40–60% of the image area',
			'  • The product is the HERO of this ad — do NOT shrink it to a small corner',
			'  • Match the product\'s exact colors, shape, proportions, and material finish from the reference photo',
			'  • Preserve ALL text on the product packaging (labels, brand name, ingredients, dosage) with PERFECT clarity',
			'  • Product label text must be SHARP, READABLE, and CORRECTLY SPELLED — never blurred, smeared, or garbled',
			'  • If the product has small text on the label, render it at a size where it remains legible',
			'  • Do NOT invent or alter any text on the product packaging — copy it exactly from the reference',
			'  • The product photo is the MOST IMPORTANT reference — prioritize product accuracy over everything else',
			'  ═══════════════════════════════════════════',
		].join('\n');
	}

	private buildProductBackLabel(idx: number): string {
		return [
			`- Image ${idx}: PRODUCT BACK IMAGE — this shows the back/reverse side of the product.`,
			'  • Use this to understand the product packaging from behind (ingredient lists, barcodes, certifications)',
			'  • This angle helps ensure accurate 3D understanding of the product shape and material',
			'  • If the back shows important text (ingredients, certifications), note them for accurate rendering',
			'  • Do NOT render the back side as the primary view — the FRONT image is the hero',
		].join('\n');
	}

	private buildLogoLabel(idx: number): string {
		return [
			`- Image ${idx}: BRAND LOGO — use the VISUAL DESIGN (shape, colors, icon style) from this logo image.`,
			'  CRITICAL: The logo image may contain text from a DIFFERENT brand (placeholder/template).',
			'  IGNORE any text visible in the logo image. Instead, render the brand name from the',
			'  CRITICAL BRAND NAME REQUIREMENT section in this prompt. Use ONLY that brand name.',
			'  Do NOT reproduce "GlowVita", "PREMIUM SKINCARE", or any other text from the logo image.',
		].join('\n');
	}

	private buildConceptLabel(idx: number): string {
		return [
			`- Image ${idx}: CONCEPT REFERENCE — LAYOUT AND VISUAL STYLE ONLY.`,
			'',
			'  ═══ CONTENT ISOLATION RULES (CRITICAL) ═══',
			'  FROM THE CONCEPT IMAGE, COPY ONLY:',
			'    • Overall layout structure (where elements are positioned)',
			'    • Visual style (font types, design aesthetic, element types)',
			'    • Background style and composition approach',
			'  FROM THE CONCEPT IMAGE, DO NOT COPY:',
			'    • ANY text, testimonials, quotes, or written words',
			'    • ANY product names, brand names, or logos',
			'    • ANY product claims, feature descriptions, or slogans',
			'    • ANY product imagery (bottles, containers, packaging)',
			'    • ANY reviewer names or attribution text',
			'    • ANY pricing, offers, or promotional text',
			'  The concept image shows a DIFFERENT product from a DIFFERENT brand.',
			'  ALL text visible in the concept image belongs to that other product — DO NOT reproduce it.',
			'  The ONLY text allowed in this ad is from the TEXT RENDERING REQUIREMENTS section below.',
			'  ═══════════════════════════════════════════',
		].join('\n');
	}
}
