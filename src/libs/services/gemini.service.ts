import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AspectRatio = '1:1' | '9:16' | '16:9';

export interface GeneratedImage {
	ratio: AspectRatio;
	buffer: Buffer;
}

@Injectable()
export class GeminiService {
	private readonly logger = new Logger('GeminiService');
	private apiKey: string;

	constructor(private configService: ConfigService) {
		this.apiKey = this.configService.get<string>('GEMINI_API_KEY');
	}

	/**
	 * Barcha 3 ratio uchun rasm generatsiya qiladi (1x1, 9x16, 16x9)
	 * @returns 3 ta GeneratedImage array
	 */
	async generateAllRatios(
		geminiPrompt: string,
		brandColors: { primary: string; secondary: string; accent: string; background: string },
	): Promise<GeneratedImage[]> {
		const ratios: AspectRatio[] = ['1:1', '9:16', '16:9'];

		this.logger.log('Generating images for all 3 ratios...');

		const results = await Promise.allSettled(
			ratios.map((ratio) => this.generateImage(geminiPrompt, brandColors, ratio)),
		);

		const images: GeneratedImage[] = [];
		for (let i = 0; i < results.length; i++) {
			const result = results[i];
			if (result.status === 'fulfilled') {
				images.push({ ratio: ratios[i], buffer: result.value });
			} else {
				this.logger.error(`Failed to generate ${ratios[i]}: ${result.reason?.message}`);
			}
		}

		if (images.length === 0) {
			throw new Error('All image generation attempts failed');
		}

		this.logger.log(`Generated ${images.length}/3 images successfully`);
		return images;
	}

	/**
	 * Bitta ratio uchun rasm generatsiya qiladi
	 */
	async generateImage(
		geminiPrompt: string,
		brandColors: { primary: string; secondary: string; accent: string; background: string },
		ratio: AspectRatio = '1:1',
	): Promise<Buffer> {
		const enhancedPrompt = this.enhancePrompt(geminiPrompt, brandColors, ratio);

		this.logger.log(`Sending image generation request (${ratio})...`);

		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${this.apiKey}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					instances: [{ prompt: enhancedPrompt }],
					parameters: {
						sampleCount: 1,
						aspectRatio: ratio,
					},
				}),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			this.logger.error(`Gemini Imagen API error (${ratio}): ${response.status} — ${errorText}`);
			throw new Error(`Gemini Imagen API error: ${response.status}`);
		}

		const result = await response.json();

		if (!result.predictions || result.predictions.length === 0) {
			throw new Error(`Gemini Imagen API returned no images for ${ratio}`);
		}

		const base64Image = result.predictions[0].bytesBase64Encoded;
		if (!base64Image) {
			throw new Error(`Gemini Imagen API returned empty image data for ${ratio}`);
		}

		const buffer = Buffer.from(base64Image, 'base64');
		this.logger.log(`Image generated (${ratio}): ${buffer.length} bytes`);

		return buffer;
	}

	private enhancePrompt(
		prompt: string,
		brandColors: { primary: string; secondary: string; accent: string; background: string },
		ratio: AspectRatio,
	): string {
		const resolutionMap: Record<AspectRatio, string> = {
			'1:1': '1080x1080',
			'9:16': '1080x1920',
			'16:9': '1920x1080',
		};

		return `${prompt}

Technical requirements:
- Aspect ratio: ${ratio} (${resolutionMap[ratio]} pixels)
- Style: Professional Facebook/Instagram ad creative
- Brand colors: Primary ${brandColors.primary}, Secondary ${brandColors.secondary}, Accent ${brandColors.accent}, Background ${brandColors.background}
- High quality, sharp, commercial photography style
- Clean typography with readable text overlays
- No watermarks, no stock photo artifacts`;
	}
}
