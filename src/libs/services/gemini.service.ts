import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GeminiService {
	private readonly logger = new Logger('GeminiService');
	private apiKey: string;

	constructor(private configService: ConfigService) {
		this.apiKey = this.configService.get<string>('GEMINI_API_KEY');
	}

	/**
	 * Gemini Imagen 3 orqali rasm generatsiya qiladi (REST API)
	 * @returns Image buffer (PNG)
	 */
	async generateImage(
		geminiPrompt: string,
		brandColors: { primary: string; secondary: string; accent: string; background: string },
	): Promise<Buffer> {
		const enhancedPrompt = this.enhancePrompt(geminiPrompt, brandColors);

		this.logger.log('Sending image generation request to Gemini Imagen...');

		// Imagen 3 REST API call
		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${this.apiKey}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					instances: [{ prompt: enhancedPrompt }],
					parameters: {
						sampleCount: 1,
						aspectRatio: '1:1',
					},
				}),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			this.logger.error(`Gemini Imagen API error: ${response.status} — ${errorText}`);
			throw new Error(`Gemini Imagen API error: ${response.status}`);
		}

		const result = await response.json();

		if (!result.predictions || result.predictions.length === 0) {
			throw new Error('Gemini Imagen API did not return any images');
		}

		const base64Image = result.predictions[0].bytesBase64Encoded;
		if (!base64Image) {
			throw new Error('Gemini Imagen API returned empty image data');
		}

		const buffer = Buffer.from(base64Image, 'base64');
		this.logger.log(`Image generated successfully (${buffer.length} bytes)`);

		return buffer;
	}

	private enhancePrompt(
		prompt: string,
		brandColors: { primary: string; secondary: string; accent: string; background: string },
	): string {
		return `${prompt}

Technical requirements:
- Aspect ratio: 1:1 (1080x1080 pixels)
- Style: Professional Facebook/Instagram ad creative
- Brand colors: Primary ${brandColors.primary}, Secondary ${brandColors.secondary}, Accent ${brandColors.accent}, Background ${brandColors.background}
- High quality, sharp, commercial photography style
- Clean typography with readable text overlays
- No watermarks, no stock photo artifacts`;
	}
}
