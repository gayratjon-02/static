import { Injectable, Logger } from '@nestjs/common';

interface ValidationResult {
	isValid: boolean;
	issues: string[];
	cleanedPrompt: string;
}

@Injectable()
export class PromptValidatorService {
	private readonly logger = new Logger(PromptValidatorService.name);

	/**
	 * Validate and clean Claude's output before sending to Gemini.
	 * Defense-in-depth: strips hex codes, fixes typos, detects duplicates.
	 */
	validateGeminiPrompt(
		claudeOutput: any,
		brandColors: Record<string, string>,
	): ValidationResult {
		const issues: string[] = [];
		let prompt: string = claudeOutput.gemini_image_prompt || '';

		// ════════════════════════════════════════
		// CHECK 1: Strip ALL hex codes from prompt
		// ════════════════════════════════════════
		const hexPattern = /#([0-9a-fA-F]{3,8})\b/g;
		const hexMatches = prompt.match(hexPattern);
		if (hexMatches) {
			issues.push(
				`Found ${hexMatches.length} hex codes in prompt: ${hexMatches.join(', ')}`,
			);
			prompt = prompt.replace(hexPattern, (match: string) => {
				return this.hexToName(match.replace('#', ''));
			});
		}

		// ════════════════════════════════════════
		// CHECK 2: Spell-check common AI typos
		// ════════════════════════════════════════
		const typoMap: Record<string, string> = {
			'chaging': 'changing',
			'changeing': 'changing',
			'life-chaging': 'life-changing',
			'veriified': 'verified',
			'verifed': 'verified',
			'reccommended': 'recommended',
			'recomended': 'recommended',
			'recommened': 'recommended',
			'gauranteed': 'guaranteed',
			'guarenteed': 'guaranteed',
			'garaunteed': 'guaranteed',
			'profesional': 'professional',
			'proffesional': 'professional',
			'beutiful': 'beautiful',
			'beautifull': 'beautiful',
			'recieve': 'receive',
			'occured': 'occurred',
			'definately': 'definitely',
			'seperate': 'separate',
			'ingrediants': 'ingredients',
			'benifits': 'benefits',
			'expereince': 'experience',
			'satisifed': 'satisfied',
			'excelent': 'excellent',
			'imediately': 'immediately',
			'noticable': 'noticeable',
			'caliming': 'calming',
			'pheramone': 'pheromone',
			'phermone': 'pheromone',
		};

		// Fix typos in gemini_image_prompt
		for (const [typo, correction] of Object.entries(typoMap)) {
			const regex = new RegExp(`\\b${typo}\\b`, 'gi');
			if (regex.test(prompt)) {
				issues.push(`Fixed typo in prompt: "${typo}" → "${correction}"`);
				prompt = prompt.replace(new RegExp(`\\b${typo}\\b`, 'gi'), correction);
			}
		}

		// Fix typos in all ad copy fields
		const copyFields = ['headline', 'subheadline', 'body_text', 'cta_text'];
		for (const field of copyFields) {
			if (claudeOutput[field]) {
				for (const [typo, correction] of Object.entries(typoMap)) {
					const regex = new RegExp(`\\b${typo}\\b`, 'gi');
					if (regex.test(claudeOutput[field])) {
						issues.push(`Fixed typo in ${field}: "${typo}" → "${correction}"`);
						claudeOutput[field] = claudeOutput[field].replace(
							new RegExp(`\\b${typo}\\b`, 'gi'),
							correction,
						);
					}
				}
			}
		}

		// Fix typos in callout_texts
		if (Array.isArray(claudeOutput.callout_texts)) {
			claudeOutput.callout_texts = claudeOutput.callout_texts.map(
				(text: string) => {
					let fixed = text;
					for (const [typo, correction] of Object.entries(typoMap)) {
						const regex = new RegExp(`\\b${typo}\\b`, 'gi');
						if (regex.test(fixed)) {
							issues.push(`Fixed typo in callout: "${typo}" → "${correction}"`);
							fixed = fixed.replace(new RegExp(`\\b${typo}\\b`, 'gi'), correction);
						}
					}
					return fixed;
				},
			);
		}

		// ════════════════════════════════════════
		// CHECK 3: Detect duplicate review quotes
		// ════════════════════════════════════════
		if (Array.isArray(claudeOutput.callout_texts)) {
			const normalized = claudeOutput.callout_texts.map((t: string) =>
				t.toLowerCase().trim(),
			);
			const duplicates = normalized.filter(
				(item: string, index: number) => normalized.indexOf(item) !== index,
			);
			if (duplicates.length > 0) {
				issues.push(`Duplicate callout texts found: ${duplicates.join(', ')}`);
			}
		}

		// ════════════════════════════════════════
		// CHECK 4: Ensure prompt references provided images, not descriptions
		// ════════════════════════════════════════
		const productDescPatterns = [
			/a\s+(white|black|silver|round|cylindrical)\s+(device|diffuser|bottle|product)/i,
			/image\s+of\s+a\s+\w+\s+(device|product|bottle|container)/i,
		];
		for (const pattern of productDescPatterns) {
			if (pattern.test(prompt)) {
				issues.push(
					'WARNING: Prompt appears to describe the product instead of referencing the provided photo',
				);
			}
		}

		if (issues.length > 0) {
			this.logger.warn(
				`Prompt validation found ${issues.length} issues: ${issues.join('; ')}`,
			);
		}

		return {
			isValid: issues.length === 0,
			issues,
			cleanedPrompt: prompt,
		};
	}

	private hexToName(hex: string): string {
		const colorMap: Record<string, string> = {
			'ffffff': 'pure white',
			'000000': 'pure black',
			'2c3e50': 'dark charcoal navy',
			'676986': 'muted slate purple',
			'e94560': 'vibrant coral pink',
			'bd2e46': 'deep crimson red',
			'ffd700': 'bright gold',
			'333333': 'dark charcoal',
			'f5f5f5': 'very light gray',
			'f5f0eb': 'warm cream off-white',
		};
		const lower = hex.toLowerCase();
		return colorMap[lower] || this.approximateColorName(lower);
	}

	private approximateColorName(hex: string): string {
		if (hex.length < 6) return 'neutral color';
		const r = parseInt(hex.substring(0, 2), 16);
		const g = parseInt(hex.substring(2, 4), 16);
		const b = parseInt(hex.substring(4, 6), 16);
		const brightness = (r * 299 + g * 587 + b * 114) / 1000;

		if (brightness > 220) return 'very light tone';
		if (brightness < 40) return 'very dark tone';

		if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20) {
			if (brightness > 150) return 'light gray';
			return 'dark gray';
		}

		if (r > g && r > b) return brightness > 150 ? 'warm light red-pink' : 'deep rich red';
		if (g > r && g > b) return brightness > 150 ? 'fresh light green' : 'deep forest green';
		return brightness > 150 ? 'soft light blue' : 'deep navy blue';
	}
}
