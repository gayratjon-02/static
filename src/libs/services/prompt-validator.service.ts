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
			'phermones': 'pheromones',
			'anxieus': 'anxious',
			'seaason': 'season',
			'finaly': 'finally',
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
		// CHECK 3: Deduplicate review/callout quotes (exact + near-duplicates)
		// ════════════════════════════════════════
		if (Array.isArray(claudeOutput.callout_texts)) {
			const original = claudeOutput.callout_texts;
			const deduped = this.deduplicateCallouts(original);
			if (deduped.length < original.length) {
				issues.push(`Removed ${original.length - deduped.length} duplicate callout(s): had ${original.length}, now ${deduped.length}`);
				claudeOutput.callout_texts = deduped;
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

	/**
	 * Deduplicate callout/review texts — removes exact and near-duplicates.
	 * Two callouts are "near-duplicates" if they share >60% of their words.
	 */
	deduplicateCallouts(callouts: string[]): string[] {
		if (!callouts || callouts.length <= 1) return callouts;

		const unique: string[] = [];
		const seenNormalized: string[] = [];

		for (const callout of callouts) {
			const normalized = callout.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

			// Skip exact duplicates
			if (seenNormalized.includes(normalized)) continue;

			// Check near-duplicates (>60% word overlap)
			const words = new Set(normalized.split(/\s+/).filter(w => w.length > 0));
			let isNearDuplicate = false;

			for (const seen of seenNormalized) {
				const seenWords = new Set(seen.split(/\s+/).filter(w => w.length > 0));
				const intersection = [...words].filter(w => seenWords.has(w));
				const similarity = intersection.length / Math.max(words.size, seenWords.size);
				if (similarity > 0.6) {
					isNearDuplicate = true;
					break;
				}
			}

			if (!isNearDuplicate) {
				seenNormalized.push(normalized);
				unique.push(callout);
			}
		}

		if (unique.length < callouts.length) {
			this.logger.warn(`Deduplicated callouts: ${callouts.length} → ${unique.length}`);
		}

		return unique;
	}

	/**
	 * Validate that Claude's ad copy does not contain claims borrowed from concept reference images.
	 * Checks all text fields against the product's actual USPs and flags foreign content.
	 */
	validateAdCopyRelevance(
		claudeOutput: any,
		product: { name: string; description?: string; usps?: string[]; ingredients_features?: string },
		brand: { name: string; industry?: string },
	): { isClean: boolean; warnings: string[] } {
		const warnings: string[] = [];

		// Combine all text fields from ad copy
		const allText = [
			claudeOutput.headline,
			claudeOutput.subheadline,
			claudeOutput.body_text,
			claudeOutput.cta_text,
			claudeOutput.gemini_image_prompt,
			...(claudeOutput.callout_texts || []),
		].filter(Boolean).join(' ').toLowerCase();

		// Build product context keywords for relevance checking
		const productContext = [
			product.name,
			product.description || '',
			...(product.usps || []),
			product.ingredients_features || '',
			brand.name,
			brand.industry || '',
		].join(' ').toLowerCase();

		// Known concept template terms that indicate cross-contamination
		// These are common in concept images but unlikely to be relevant to arbitrary products
		const crossContaminationTerms = [
			// Human health supplement terms (ARMRA, AG1, etc.)
			'colostrum', 'bioactive nutrients', 'grass-fed', 'grass fed',
			'gut health', 'bloating', 'probiotic', 'prebiotic',
			'superfood', 'antioxidant',
			// Beauty/skincare terms
			'retinol', 'collagen boost', 'radiant skin',
			'anti-aging', 'complexion',
			// Specific brand attributes from common templates
			'physician-founded', 'physician founded',
		];

		for (const term of crossContaminationTerms) {
			// Only flag if term appears in ad copy BUT NOT in the actual product data
			if (allText.includes(term) && !productContext.includes(term)) {
				warnings.push(`Possible concept leak: "${term}" found in ad copy but not in product data for "${product.name}"`);
			}
		}

		if (warnings.length > 0) {
			this.logger.warn(`Ad copy relevance check: ${warnings.length} warnings — ${warnings.join('; ')}`);
		}

		return {
			isClean: warnings.length === 0,
			warnings,
		};
	}

	/**
	 * Validate and shorten badge-like callout text to 2 words max.
	 * Small circular badge icons have very limited space — 3+ words cause merging ("60 Time Setup").
	 * Only affects callouts that are exactly 3 words (badge-range) or match known badge patterns.
	 * Callouts with 4-5 words are assumed to be review text and left untouched.
	 */
	validateBadgeText(callouts: string[]): string[] {
		const shortenings: Record<string, string> = {
			'one time setup': 'Easy Setup',
			'lasts 60 days': '60 Days',
			'easy to use': 'Easy Use',
			'vet approved formula': 'Vet Approved',
			'works for all breeds': 'All Breeds',
			'safe for daily use': 'Safe Daily',
			'no mess formula': 'No Mess',
			'clinically tested formula': 'Lab Tested',
			'money back guarantee': 'Guaranteed',
			'all natural ingredients': 'All Natural',
			'fast acting formula': 'Fast Acting',
			'made in usa': 'USA Made',
			'free shipping available': 'Free Shipping',
			'satisfaction guaranteed': 'Guaranteed',
		};

		return callouts.map(callout => {
			const words = callout.trim().split(/\s+/);
			if (words.length <= 2) return callout;

			const lowerCallout = callout.toLowerCase().trim();

			// Check known shortenings first (any length)
			if (shortenings[lowerCallout]) {
				this.logger.warn(`Badge shortened: "${callout}" → "${shortenings[lowerCallout]}"`);
				return shortenings[lowerCallout];
			}

			// Only auto-truncate 3-word callouts (likely badges, not reviews)
			// 4-5 word callouts are likely review text — leave them alone
			if (words.length === 3) {
				const shortened = words.slice(-2).join(' ');
				this.logger.warn(`Badge truncated from 3 to 2 words: "${callout}" → "${shortened}"`);
				return shortened;
			}

			return callout;
		});
	}

	/**
	 * Hardcoded list of short, common, easy-to-spell reviewer names.
	 * Prevents Gemini from garbling unusual names like "Pnenor E." or "Nnnd T."
	 */
	private static readonly REVIEWER_NAMES = [
		'Sarah M.', 'David K.', 'Lisa R.', 'Mike T.',
		'Emma L.', 'John P.', 'Amy W.', 'Chris B.',
		'Kate S.', 'Alex H.', 'Jess N.', 'Ryan D.',
		'Mia G.', 'Sam F.', 'Zoe C.', 'Ben E.',
		'Leah J.', 'Noah A.', 'Maya V.', 'Jake R.',
	];

	/**
	 * Get shuffled reviewer names for callout cards.
	 * Returns an array of short, common names matching the callout count.
	 */
	getReviewerNames(count: number): string[] {
		const shuffled = [...PromptValidatorService.REVIEWER_NAMES]
			.sort(() => Math.random() - 0.5);
		return shuffled.slice(0, count);
	}

	/**
	 * Enforce a strict word limit on review/callout texts.
	 * Gemini renders 4-5 word phrases accurately; longer text causes garbled trailing words.
	 */
	enforceWordLimit(callouts: string[], maxWords: number = 5): string[] {
		return callouts.map(callout => {
			const words = callout.trim().split(/\s+/);
			if (words.length <= maxWords) return callout;
			const truncated = words.slice(0, maxWords).join(' ');
			this.logger.warn(
				`Review truncated from ${words.length} to ${maxWords} words: "${callout}" → "${truncated}"`,
			);
			return truncated;
		});
	}

	/**
	 * Replace words with double letters (hard for image models to spell) with simpler synonyms.
	 * Preserves original capitalization.
	 */
	simplifyDifficultWords(text: string): string {
		const replacements: Record<string, string> = {
			// Double-letter words (hard to render)
			'effortless': 'easy',
			'embarrassing': 'stressful',
			'aggressive': 'intense',
			'professional': 'expert',
			'recommended': 'approved',
			'difference': 'change',
			'happiness': 'joy',
			'successful': 'proven',
			'comfortable': 'cozy',
			'immediately': 'fast',
			'unnecessary': 'excess',
			'accommodate': 'fit',
			'occurrence': 'event',
			'assessment': 'review',
			'accessible': 'available',
			'addressing': 'fixing',
			'aggression': 'stress',
			'irritability': 'tension',
			// Words that consistently fail in image generation
			'finally': 'at last',
			'anxious': 'stressed',
			'anxiety': 'stress',
			'pheromones': 'calming scent',
			'pheromone': 'calming',
			'separation': 'alone time',
			'thunderstorm': 'storm',
			'fireworks': 'loud noise',
			'behaviorist': 'vet',
			'veterinarian': 'vet',
			// Common Gemini misspellings → correct simple words
			'anxieus': 'stressed',
			'phermones': 'calming scent',
			'phermone': 'calming',
			'seaason': 'season',
			'finaly': 'at last',
		};

		let result = text;
		for (const [difficult, simple] of Object.entries(replacements)) {
			const regex = new RegExp(`\\b${difficult}\\b`, 'gi');
			result = result.replace(regex, (match: string) => {
				if (match[0] === match[0].toUpperCase()) {
					return simple.charAt(0).toUpperCase() + simple.slice(1);
				}
				return simple;
			});
		}

		if (result !== text) {
			this.logger.warn(`Simplified difficult words: "${text}" → "${result}"`);
		}
		return result;
	}

	/**
	 * Add character-by-character spelling hints for words 7+ characters.
	 * Helps Gemini render longer words accurately.
	 */
	addSpellingHints(text: string): string {
		const words = text.split(/\s+/);
		const hints: string[] = [];

		for (const word of words) {
			const cleanWord = word.replace(/[^a-zA-Z]/g, '');
			if (cleanWord.length >= 7) {
				hints.push(`"${cleanWord}" is spelled: ${cleanWord.split('').join('-')}`);
			}
		}

		if (hints.length === 0) return '';
		return `\nSPELLING HINTS:\n${hints.join('\n')}`;
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
