import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { DatabaseService } from '../../database/database.service';
import { Brand } from '../types/brand/brand.type';
import { Product } from '../types/product/product.type';
import { AdConcept } from '../types/concept/concept.type';
import { ClaudeResponseJson, Claude6VariationsResponse } from '../types/generation/generation.type';

@Injectable()
export class ClaudeService {
	private readonly logger = new Logger('ClaudeService');
	private client: Anthropic;

	constructor(
		private configService: ConfigService,
		private databaseService: DatabaseService,
	) {
		this.client = new Anthropic({
			apiKey: this.configService.get<string>('ANTHROPIC_API_KEY'),
		});
	}

	/**
	 * Creates 6 different variations — each with a different headline, angle, and visual approach.
	 * Used for the main generation flow.
	 */
	async generate6Variations(
		brand: Brand,
		product: Product,
		concept: AdConcept,
		importantNotes: string,
	): Promise<Claude6VariationsResponse> {
		const sanitizedNotes = this.sanitizeImportantNotes(importantNotes);
		const systemPrompt = await this.get6VariationsSystemPrompt();
		const userPromptText = this.build6VariationsUserPrompt(brand, product, concept, sanitizedNotes);

		this.logger.log('Sending 6-variations request to Claude API...');

		const messageContent = this.buildUserMessageContent(userPromptText, concept.image_url);
		if (concept.image_url) {
			this.logger.log(`Sending concept image to Claude as vision: ${concept.image_url.substring(0, 80)}...`);
		}

		const response = await this.client.messages.create({
			model: 'claude-sonnet-4-5-20250929',
			max_tokens: 8000,
			messages: [
				{
					role: 'user',
					content: messageContent,
				},
			],
			system: systemPrompt,
		});

		const textContent = response.content.find((block) => block.type === 'text');
		if (!textContent || textContent.type !== 'text') {
			throw new Error('Claude API did not return text content');
		}

		const parsed = this.parse6VariationsResponse(textContent.text);
		this.logger.log(`Claude API returned ${parsed.variations.length} variations successfully`);
		this.logger.log(`Claude usage: ${response.usage.input_tokens} input tokens, ${response.usage.output_tokens} output tokens`);

		return {
			...parsed,
			claude_usage: {
				input_tokens: response.usage.input_tokens,
				output_tokens: response.usage.output_tokens,
			},
		};
	}

	/**
	 * Creates a single ad copy — used for fixErrors and regenerateSingle.
	 * Legacy generateAdCopy kept for backward compatibility.
	 */
	async generateAdCopy(
		brand: Brand,
		product: Product,
		concept: AdConcept,
		importantNotes: string,
		variationIndex: number = 0,
	): Promise<ClaudeResponseJson> {
		const sanitizedNotes = this.sanitizeImportantNotes(importantNotes);
		const systemPrompt = await this.getSystemPrompt();
		const userPromptText = this.buildUserPrompt(brand, product, concept, sanitizedNotes, variationIndex);

		this.logger.log('Sending single ad request to Claude API...');

		const messageContent = this.buildUserMessageContent(userPromptText, concept.image_url);

		const response = await this.client.messages.create({
			model: 'claude-sonnet-4-5-20250929',
			max_tokens: 2000,
			messages: [
				{
					role: 'user',
					content: messageContent,
				},
			],
			system: systemPrompt,
		});

		const textContent = response.content.find((block) => block.type === 'text');
		if (!textContent || textContent.type !== 'text') {
			throw new Error('Claude API did not return text content');
		}

		const parsed = this.parseResponse(textContent.text);
		this.logger.log('Claude API response parsed successfully');
		return parsed;
	}

	/**
	 * Generic completion — used by brand import and other services
	 * that need a simple system + user prompt → text response.
	 */
	async complete(params: {
		system: string;
		messages: { role: 'user' | 'assistant'; content: string }[];
		model?: string;
		max_tokens?: number;
		temperature?: number;
	}): Promise<{ content: string }> {
		const response = await this.client.messages.create({
			model: params.model || 'claude-sonnet-4-5-20250929',
			max_tokens: params.max_tokens || 1000,
			temperature: params.temperature ?? 0.1,
			system: params.system,
			messages: params.messages,
		});

		const textContent = response.content.find((block) => block.type === 'text');
		if (!textContent || textContent.type !== 'text') {
			throw new Error('Claude API did not return text content');
		}

		this.logger.log(`Claude complete() usage: ${response.usage.input_tokens} input, ${response.usage.output_tokens} output tokens`);
		return { content: textContent.text };
	}

	/**
	 * Fix-Errors: original ad data + error description → yangilangan Gemini prompt
	 */
	async fixAdErrors(
		originalAdCopy: ClaudeResponseJson,
		errorDescription: string,
	): Promise<ClaudeResponseJson> {
		const systemPrompt = `You are an expert Facebook ad creative director. You are fixing errors in a previously generated ad image. The user has described the issues. Your task is to generate an improved version that fixes the reported problems while keeping the same brand message and style.

CRITICAL RULES FOR THE GEMINI IMAGE PROMPT:
- NEVER include hex codes (#2c3e50, #FFFFFF, etc.) — Gemini renders them as visible text in the image
- ALWAYS describe colors by name: "dark navy blue", "pure white", "vibrant coral pink"
- Reference the "provided product photo" and "provided brand logo" — do NOT describe what they look like
- Spell-check every word obsessively
- All review quotes must be unique — never duplicate

You MUST respond with valid JSON only, no markdown, no code blocks. The JSON must have these exact fields:
{
  "headline": "Short, punchy headline (max 8 words)",
  "subheadline": "Supporting text (max 15 words)",
  "body_text": "Persuasive body copy (max 30 words)",
  "callout_texts": ["Callout 1", "Callout 2", "Callout 3"],
  "cta_text": "Call to action button text",
  "gemini_image_prompt": "IMPROVED image generation prompt that fixes the reported issues. Colors by NAME only — NEVER hex codes. Reference provided product photo and brand logo."
}`;

		const userPrompt = `Fix the following ad creative that has issues.

=== ORIGINAL AD COPY ===
Headline: ${originalAdCopy.headline}
Subheadline: ${originalAdCopy.subheadline}
Body: ${originalAdCopy.body_text}
Callouts: ${originalAdCopy.callout_texts.join(', ')}
CTA: ${originalAdCopy.cta_text}

=== ORIGINAL GEMINI IMAGE PROMPT ===
${originalAdCopy.gemini_image_prompt}

=== USER-REPORTED ISSUES ===
${errorDescription || 'General quality issues — improve text clarity, product placement, and visual consistency.'}

Generate an improved version. Keep the same ad copy/messaging but create a much better gemini_image_prompt that specifically addresses the reported issues. Be very precise about text positioning, font sizes, and layout to avoid rendering errors.`;

		this.logger.log('Sending fix-errors request to Claude API...');

		const response = await this.client.messages.create({
			model: 'claude-sonnet-4-5-20250929',
			max_tokens: 2000,
			messages: [{ role: 'user', content: userPrompt }],
			system: systemPrompt,
		});

		const textContent = response.content.find((block) => block.type === 'text');
		if (!textContent || textContent.type !== 'text') {
			throw new Error('Claude API did not return text content for fix-errors');
		}

		const parsed = this.parseResponse(textContent.text);
		this.logger.log('Claude fix-errors response parsed successfully');
		return parsed;
	}

	/**
	 * System prompt for 6 variations.
	 * Asks Claude for 6 ad copies with different creative angles.
	 */
	private async get6VariationsSystemPrompt(): Promise<string> {
		try {
			const { data, error } = await this.databaseService.client
				.from('prompt_templates')
				.select('content')
				.eq('template_type', 'system')
				.eq('is_active', true)
				.order('version', { ascending: false })
				.limit(1)
				.single();

			if (!error && data?.content) {
				this.logger.log('System prompt loaded from DB (6 variations mode)');
				return `${data.content}\n\n${this.get6VariationsJsonSchema()}`;
			}
		} catch {
			this.logger.warn('Failed to load prompt from DB, using fallback (6 variations)');
		}

		return this.getFallback6VariationsSystemPrompt();
	}

	private getFallback6VariationsSystemPrompt(): string {
		return `You are an expert Facebook ad creative director working for Static Engine. Your job is to write ad copy AND create a detailed image generation prompt for Gemini (Google's image AI).

═══════════════════════════════════════════════════
ABSOLUTE RULES — VIOLATING THESE RUINS THE AD
═══════════════════════════════════════════════════

RULE 1: NEVER PUT HEX CODES IN THE IMAGE PROMPT
- NEVER: "text color #2c3e50" or "background #FFFFFF" or "use color #bd2e46"
- ALWAYS: Describe colors by name: "dark navy blue text", "pure white background", "deep coral red accent"
- NEVER: "primary color: #2c3e50" — Gemini will LITERALLY render "#2c3e50" as text in the image
- ALWAYS: Convert hex to descriptive color names before writing the prompt
- This is the #1 most critical rule. If you include ANY hex code in the Gemini prompt, it WILL appear as visible text in the generated ad image.

HEX-TO-NAME CONVERSION (do this mentally before writing prompts):
- #2c3e50 → "dark charcoal navy"
- #FFFFFF → "pure white"
- #000000 → "pure black"
- #E94560 → "vibrant coral pink"
- #676986 → "muted slate purple"
- For any hex: describe the approximate color in plain English words

RULE 2: SPELL-CHECK ALL TEXT OBSESSIVELY
- Double-check every single word you write that will appear in the ad
- Common AI mistakes to avoid: "chaging" (changing), "veriified" (verified), "reccommended" (recommended), "gauranteed" (guaranteed)
- After writing all ad copy, re-read each word letter by letter
- If you include review quotes, each one must be a DIFFERENT unique quote with correct spelling

RULE 3: EVERY REVIEW/TESTIMONIAL MUST BE UNIQUE
- NEVER repeat the same quote twice in one ad
- NEVER use generic "Dog owner, 67" format for all reviews
- Each review must have: unique quote text, unique reviewer name, unique detail
- Example of 5 UNIQUE reviews:
  * "My dog stopped barking at thunder!" — Sarah M., Golden Retriever owner
  * "Noticed a difference within 24 hours" — James K., verified buyer
  * "Wish I found this sooner" — Lisa R., anxious puppy mom
  * "Our vet recommended this exact product" — Mike D., 2 dogs
  * "Night and day difference in our home" — Emma T., rescue dog parent

RULE 4: PRODUCT PHOTO HANDLING
- The user's actual product photo will be provided to Gemini as a reference image
- In your prompt, describe WHERE to place the product photo, do NOT describe what the product looks like
- Say: "Place the provided product photo in the center-right of the composition"
- Do NOT say: "A white cylindrical diffuser device plugged into a wall outlet" — this makes Gemini generate a fake product
- The goal is for Gemini to USE the actual photo, not create an AI-imagined version

RULE 5: LOGO HANDLING
- The user's actual brand logo will be provided as a separate reference image
- In your prompt say: "Place the provided brand logo in the bottom-right corner"
- Do NOT describe the logo or ask Gemini to create one
- Do NOT say: "A logo with the text 'BrandName' and an icon" — this creates a fake logo

RULE 6: COLOR DESCRIPTIONS IN PROMPTS
When the brand has specific colors, ALWAYS convert to descriptive names:
- Instead of "Use #2c3e50 for headings" → "Use dark charcoal navy for headings"
- Instead of "Background: #F5F0EB" → "Background: warm cream off-white"
- Instead of "CTA button in #E94560" → "CTA button in vibrant coral pink"
- Include a color palette description section:
  "COLOR PALETTE: The ad uses a dark charcoal navy as the primary color, muted slate purple as secondary, and vibrant coral pink for accents and CTAs. Background is pure white for the top section."

═══════════════════════════════════════════════════
VARIATION REQUIREMENTS
═══════════════════════════════════════════════════

You MUST generate exactly 6 unique ad creative variations. Each variation should use a DIFFERENT creative angle:

1. **Emotional Appeal** — Focus on feelings, aspirations, transformation
2. **Social Proof** — Leverage reviews, ratings, testimonials, popularity
3. **Problem-Solution** — Highlight the pain point and how the product solves it
4. **Feature Highlight** — Showcase specific product features/ingredients/specs
5. **Urgency/Offer** — Create urgency with deals, limited time, scarcity
6. **Lifestyle/Aspirational** — Show the desired outcome, lifestyle after using the product

For each variation:
- Create a unique headline (different approach, not just rewording)
- Write distinct body copy tailored to that angle
- Design a completely different gemini_image_prompt with different layouts, compositions, and visual treatments
- All variations MUST stay on-brand (same colors described by NAME, typography style, brand feel)

BEFORE OUTPUTTING: Re-read EVERY gemini_image_prompt and verify:
- Zero hex codes anywhere (search for # followed by letters/numbers)
- Every word correctly spelled
- All reviews/quotes are unique (no duplicates)
- Product placement says "provided product photo" not a description
- Logo placement says "provided brand logo" not a description
- Colors described by name only

${this.get6VariationsJsonSchema()}`;
	}

	private get6VariationsJsonSchema(): string {
		return `You MUST respond with valid JSON only, no markdown, no code blocks. The JSON must follow this EXACT structure:
{
  "variations": [
    {
      "headline": "Short, punchy headline (max 8 words)",
      "subheadline": "Supporting text (max 15 words)",
      "body_text": "Persuasive body copy (max 30 words)",
      "callout_texts": ["array of unique callout strings — badges, features, quotes"],
      "cta_text": "Call to action button text",
      "ad_copy_review": {
        "all_text_spell_checked": true,
        "no_hex_codes_in_prompt": true,
        "all_reviews_unique": true,
        "product_described_not_generated": true
      },
      "gemini_image_prompt": "The COMPLETE image generation prompt following ALL rules above. Describe colors by NAME only — NEVER hex codes. Reference the provided product photo and brand logo — do NOT describe them."
    }
  ]
}

The "variations" array MUST contain exactly 6 objects. Each object represents one unique ad creative variation.`;
	}

	/**
	 * System prompt for single ad (fixErrors, regenerateSingle).
	 */
	private async getSystemPrompt(): Promise<string> {
		try {
			const { data, error } = await this.databaseService.client
				.from('prompt_templates')
				.select('content')
				.eq('template_type', 'system')
				.eq('is_active', true)
				.order('version', { ascending: false })
				.limit(1)
				.single();

			if (!error && data?.content) {
				this.logger.log('System prompt loaded from DB');
				return `${data.content}

You MUST respond with valid JSON only, no markdown, no code blocks. The JSON must have these exact fields:
{
  "headline": "Short, punchy headline (max 8 words)",
  "subheadline": "Supporting text (max 15 words)",
  "body_text": "Persuasive body copy (max 30 words)",
  "callout_texts": ["Callout 1", "Callout 2", "Callout 3"],
  "cta_text": "Call to action button text",
  "ad_copy_review": {
    "all_text_spell_checked": true,
    "no_hex_codes_in_prompt": true,
    "all_reviews_unique": true,
    "product_described_not_generated": true
  },
  "gemini_image_prompt": "The COMPLETE image generation prompt. Colors by NAME only — NEVER hex codes. Reference provided product photo and brand logo."
}`;
			}
		} catch {
			this.logger.warn('Failed to load prompt from DB, using fallback');
		}

		return this.getFallbackSystemPrompt();
	}

	private getFallbackSystemPrompt(): string {
		return `You are an expert Facebook ad creative director working for Static Engine. Your job is to write ad copy AND create a detailed image generation prompt for Gemini (Google's image AI).

ABSOLUTE RULES — VIOLATING THESE RUINS THE AD:

RULE 1: NEVER PUT HEX CODES IN THE IMAGE PROMPT
- NEVER: "text color #2c3e50" or "background #FFFFFF" — Gemini will LITERALLY render hex codes as visible text
- ALWAYS: Describe colors by name: "dark navy blue text", "pure white background", "deep coral red accent"

RULE 2: SPELL-CHECK ALL TEXT OBSESSIVELY
- Double-check every word. Common AI mistakes: "chaging" (changing), "veriified" (verified), "reccommended" (recommended)

RULE 3: EVERY REVIEW/TESTIMONIAL MUST BE UNIQUE — never repeat the same quote

RULE 4: PRODUCT PHOTO — The actual photo will be provided to Gemini. Describe WHERE to place it, do NOT describe what it looks like.

RULE 5: LOGO — The actual logo will be provided to Gemini. Say "Place the provided brand logo" — do NOT describe or recreate it.

RULE 6: COLOR DESCRIPTIONS — Always convert hex to descriptive names in the gemini_image_prompt.

You MUST respond with valid JSON only, no markdown, no code blocks. The JSON must have these exact fields:
{
  "headline": "Short, punchy headline (max 8 words)",
  "subheadline": "Supporting text (max 15 words)",
  "body_text": "Persuasive body copy (max 30 words)",
  "callout_texts": ["Callout 1", "Callout 2", "Callout 3"],
  "cta_text": "Call to action button text",
  "ad_copy_review": {
    "all_text_spell_checked": true,
    "no_hex_codes_in_prompt": true,
    "all_reviews_unique": true,
    "product_described_not_generated": true
  },
  "gemini_image_prompt": "The COMPLETE image generation prompt following ALL rules above. Colors by NAME only. Reference provided product photo and brand logo."
}`;
	}

	/**
	 * User prompt for 6 variations.
	 */
	private build6VariationsUserPrompt(
		brand: Brand,
		product: Product,
		concept: AdConcept,
		importantNotes: string,
	): string {
		// Detect concept category for specific rules
		const isSocialProof = concept.category?.toLowerCase().includes('social') || concept.category?.toLowerCase().includes('proof');

		let conceptRules = '';
		if (isSocialProof) {
			conceptRules = `
=== SOCIAL PROOF RULES (MANDATORY FOR ALL 6 VARIATIONS) ===
You are a professional commercial ad designer and template rendering engine, NOT a creative explorer.
ZERO tolerance for misspelled words, garbled text, random micro text, extra product claims, fake nutrition labels, blurry small text, cropped typography, or deformed letters.

ALL variations MUST follow this base layout:

1. **TOP SECTION**:
   - Large headline: "${product.star_rating || '4.7'} ★ Rated" + short benefit phrase
   - Clean sans-serif font, use the brand's primary color (${this.hexToColorName(brand.primary_color)}) — NEVER put hex codes in the prompt
   - Text MUST be sharp, fully readable, correctly spelled, and aligned properly

2. **MIDDLE SECTION**:
   - Place the PROVIDED PRODUCT PHOTO centered (do NOT generate a fake product image)
   - NO small unreadable packaging text on the product — clean label only
   - Behind the product: 3–5 review cards (white bg, soft shadow, slight angle max 15°)
   - Each card: 5 bright yellow/gold stars + short UNIQUE testimonial (max 8 words) + first name + last initial
   - Cards must NOT overlap the product — NEVER include hex codes on review cards
   - NO random supplement claims, NO fake weight labels, NO distorted micro text

3. **BOTTOM SECTION**:
   ${product.offer_text ? `- Offer badge: "${product.offer_text}" — ${this.hexToColorName(brand.accent_color)} background, white bold text` : '- No offer badge'}
   - Review count: "${product.review_count || '3,000'}+ Happy Customers"

4. **STRICT COLOR RULES**: ONLY use primary (${this.hexToColorName(brand.primary_color)}), secondary (${this.hexToColorName(brand.secondary_color)}), accent (${this.hexToColorName(brand.accent_color)}), white, dark navy. NO hex codes, NO neon, NO glow, NO random gradients.

5. **TYPOGRAPHY RULES (CRITICAL)**:
   - Clean modern sans-serif ONLY
   - ALL visible text must be: sharp, fully readable, correctly spelled, aligned properly, with correct kerning and spacing
   - Strong hierarchy: headline large, testimonials medium, meta small
   - If any text cannot be rendered perfectly, DO NOT render it at all
   - Star ratings: describe as "5 bright yellow/gold stars" not any hex color

6. **FORBIDDEN**: No hex color codes in prompt, no extra badges, no claims not in USPs, no medical claims, no fake awards, no watermarks, no text cut-off, no decorative fonts, no microscopic product packaging text, no random supplement facts, no duplicate reviews.

7. **SELF-VERIFICATION**: In each gemini_image_prompt, include: "Before generating, internally verify: all words spelled correctly, no hex codes present, no extra words exist, no cropped letters, no deformed characters, all reviews unique. If verification fails, regenerate."

Each variation should differ in: headline wording, testimonial content, card arrangement, background style, and overall emphasis — but ALL must follow the Social Proof layout above.
`;
		}

		return `Create exactly 6 unique Facebook ad creative variations based on the following:
${conceptRules}
=== BRAND ===
Name: ${brand.name}
Industry: ${brand.industry}
Description: ${brand.description}
Voice & Tone: ${brand.voice_tags?.join(', ') || 'professional'}
Target Audience: ${brand.target_audience || 'General audience'}
Colors: Primary ${this.formatColor(brand.primary_color)}, Secondary ${this.formatColor(brand.secondary_color)}, Accent ${this.formatColor(brand.accent_color)}, Background ${this.formatColor(brand.background_color)}
IMPORTANT: In your gemini_image_prompt, use the DESCRIPTIVE color names above — NEVER the hex codes.
${brand.logo_url ? `Brand Logo: PROVIDED as reference image — do NOT describe or recreate it` : ''}
${brand.competitors ? `Competitors: ${brand.competitors}` : ''}

=== PRODUCT ===
Name: ${product.name}
Description: ${product.description}
USPs: ${product.usps?.join(', ') || 'N/A'}
${product.photo_url ? `Product Photo: PROVIDED as reference image — describe WHERE to place it, not WHAT it looks like` : ''}
Price: ${product.price_text || 'N/A'}
Rating: ${product.star_rating ? `${product.star_rating}/5 (${product.review_count || 0} reviews)` : 'N/A'}
${product.offer_text ? `Offer: ${product.offer_text}` : ''}
${product.ingredients_features ? `Features/Ingredients: ${product.ingredients_features}` : ''}
${product.before_description ? `Before: ${product.before_description}` : ''}
${product.after_description ? `After: ${product.after_description}` : ''}

=== CONCEPT STYLE ===
Category: ${concept.category}
Name: ${concept.name}
Description: ${concept.description}
Tags: ${concept.tags?.join(', ') || 'N/A'}
${concept.image_url ? `Reference Image: ${concept.image_url}` : ''}

${importantNotes ? `=== USER NOTES ===\n${importantNotes}` : ''}

Generate EXACTLY 6 unique variations as a JSON object with a "variations" array. Each variation should:
1. Use a DIFFERENT creative angle (emotional, social proof, problem-solution, feature highlight, urgency/offer, lifestyle)
2. Have a unique headline — not just a rewording but a genuinely different approach
3. Include a detailed gemini_image_prompt describing a 1080x1080 static image ad — use DESCRIPTIVE color names (NEVER hex codes), reference "the provided product photo" and "the provided brand logo"
4. Each gemini_image_prompt should describe a DIFFERENT visual layout and composition`;
	}

	/**
	 * User prompt for single ad (fixErrors, regenerateSingle).
	 */
	/**
	 * User prompt for single ad (fixErrors, regenerateSingle).
	 */
	private buildUserPrompt(
		brand: Brand,
		product: Product,
		concept: AdConcept,
		importantNotes: string,
		variationIndex: number = 0,
	): string {
		// Detect Concept Category
		const isFeatureCallout = concept.category?.toLowerCase().includes('feature') || concept.category?.toLowerCase().includes('callout');
		const isSocialProof = concept.category?.toLowerCase().includes('social') || concept.category?.toLowerCase().includes('proof');
		const isComparison = concept.category?.toLowerCase().includes('comparison') || concept.category?.toLowerCase().includes('us vs them');

		// Variation Styles (0-5)
		const styles = [
			"Balanced & Clean: Balanced composition with ample whitespace.",
			"Bold & High Contrast: Use strong contrast with brand colors for maximum impact.",
			"Gradient & Dynamic: Use brand gradients and dynamic shapes.",
			"Minimalist: absolute essential elements only, very clean.",
			"Detailed & Informative: richer detail in callouts, structured layout.",
			"Lifestyle/Contextual: If possible, imply usage context or soft background elements."
		];
		const currentStyle = styles[variationIndex % styles.length];

		let specificInstructions = "";
		if (isFeatureCallout) {
			specificInstructions = `
=== FEATURE CALLOUT RULES (Category: ${concept.category}) ===
1. **Layout**: CENTER the product photo. It must be the hero.
2. **Callouts**: Place 3 to 5 callout bubbles AROUND the product.
   - Prefer 4 callouts if USPs allow.
   - Bubbles must NOT overlap the product.
   - Text inside bubbles must be legible and auto-scaled (no fixed font sizes).
3. **Hierarchy**:
   - Headline: Top Center or Top Left (Max 5-9 words).
   - CTA: Distinct button style, placed clearly (Bottom Center or aligned with Offer).
   - If an Offer exists (${product.offer_text || 'N/A'}), display it in a badge or integrated into the CTA, do not clutter.
4. **Safety**: DO NOT use medical claims (cure, treat, heal). Use "support", "help", "promote".
`;
		} else if (isSocialProof) {
			specificInstructions = `
=== SOCIAL PROOF RULES (Category: ${concept.category}) ===
You are a professional commercial ad designer and template rendering engine, NOT a creative explorer.
ZERO tolerance for misspelled words, garbled text, random micro text, extra product claims, fake nutrition labels, blurry small text, cropped typography, or deformed letters.

Follow this layout EXACTLY:

1. **TOP SECTION**:
   - Large headline: "${product.star_rating || '4.7'} ★ Rated" + short benefit phrase
   - Clean sans-serif font
   - Use the brand's primary color (${this.hexToColorName(brand.primary_color)}) for headline — NEVER put hex codes in the prompt
   - Text MUST be sharp, fully readable, correctly spelled, and aligned properly

2. **MIDDLE SECTION**:
   - Place the PROVIDED PRODUCT PHOTO centered (do NOT generate a fake product image)
   - NO small unreadable packaging text on the product — clean label only
   - NO random supplement claims, NO fake weight labels (e.g. 30g), NO distorted micro text
   - Subtle soft shadow only, no rotation more than 10 degrees
   - Behind the product: 3–5 review cards with:
     * White background, soft shadow, slight angle variation (max 15 degrees)
     * Each card: 5 bright yellow/gold stars + short UNIQUE testimonial (max 8 words) + first name + last initial
     * Cards must NOT overlap the product — NEVER include hex codes on cards

3. **BOTTOM SECTION**:
   ${product.offer_text ? `- Offer badge: "${product.offer_text}" — ${this.hexToColorName(brand.accent_color)} background, white bold text` : '- No offer badge needed'}
   - Review count line: "${product.review_count || '3,000'}+ Happy Customers" — clean typography

4. **COLOR RULES** (STRICT):
   - Background: soft neutral gradient (very subtle) or clean white
   - ONLY use: primary (${this.hexToColorName(brand.primary_color)}), secondary (${this.hexToColorName(brand.secondary_color)}), accent (${this.hexToColorName(brand.accent_color)}), white, dark navy text
   - NO hex codes in the prompt, NO extra colors, NO neon glow, NO random gradients

5. **TYPOGRAPHY RULES (CRITICAL)**:
   - Clean modern sans-serif ONLY
   - ALL visible text must be: sharp, fully readable, correctly spelled, aligned properly, with correct kerning and spacing
   - Strong hierarchy: headline large, testimonials medium, meta info small
   - Star ratings: describe as "5 bright yellow/gold stars" — NEVER use hex color codes
   - If any text cannot be rendered perfectly, DO NOT render it at all

6. **COMPOSITION**: Balanced spacing, clean margins, no crowded layout, no overlapping chaos. Clear visual focus on provided product photo.

7. **FORBIDDEN**: No hex color codes in prompt, no extra badges, no random claims not in USPs, no medical claims, no fake awards, no watermarks, no text cut-off, no inconsistent star format, no decorative fonts, no microscopic product packaging text, no random supplement facts, no duplicate review quotes.

8. **SELF-VERIFICATION INSTRUCTION**: Include in the gemini_image_prompt: "Before generating, internally verify: all words spelled correctly, no hex codes present, all reviews unique, no extra words exist, no cropped letters, no deformed characters. If verification fails, regenerate."
`;
		}

		return `Create a Facebook ad creative based on the following:

=== VARIATION SETTINGS ===
Variation Index: ${variationIndex + 1}/6
Visual Style: ${currentStyle}

${specificInstructions}

=== BRAND ===
Name: ${brand.name}
Industry: ${brand.industry}
Description: ${brand.description}
Voice & Tone: ${brand.voice_tags?.join(', ') || 'professional'}
Target Audience: ${brand.target_audience || 'General audience'}
Colors: Primary ${this.formatColor(brand.primary_color)}, Secondary ${this.formatColor(brand.secondary_color)}, Accent ${this.formatColor(brand.accent_color)}, Background ${this.formatColor(brand.background_color)}
IMPORTANT: In your gemini_image_prompt, use the DESCRIPTIVE color names above — NEVER the hex codes.
${brand.logo_url ? `Brand Logo: PROVIDED as reference image — do NOT describe or recreate it` : ''}
${brand.competitors ? `Competitors: ${brand.competitors}` : ''}

=== PRODUCT ===
Name: ${product.name}
Description: ${product.description}
USPs: ${product.usps?.join(', ') || 'N/A'}
${product.photo_url ? `Product Photo: PROVIDED as reference image — describe WHERE to place it, not WHAT it looks like` : ''}
Price: ${product.price_text || 'N/A'}
Rating: ${product.star_rating ? `${product.star_rating}/5 (${product.review_count || 0} reviews)` : 'N/A'}
${product.offer_text ? `Offer: ${product.offer_text}` : ''}
${product.ingredients_features ? `Features/Ingredients: ${product.ingredients_features}` : ''}
${product.before_description ? `Before: ${product.before_description}` : ''}
${product.after_description ? `After: ${product.after_description}` : ''}

=== CONCEPT STYLE ===
Category: ${concept.category}
Name: ${concept.name}
Description: ${concept.description}
Tags: ${concept.tags?.join(', ') || 'N/A'}
${concept.image_url ? `Reference Image: ${concept.image_url}` : ''}

${importantNotes ? `=== USER NOTES ===\n${importantNotes}` : ''}

Generate the ad creative as JSON.
The gemini_image_prompt must be EXTREMELY detailed and follow the "Visual Style" and "Category Rules" defined above.
It must describe a 1080x1080 static image ad — use DESCRIPTIVE color names (NEVER hex codes), reference "the provided product photo" and "the provided brand logo".
Ensure the layout is robust and does not rely on hardcoded pixel coordinates.`;
	}

	/**
	 * Converts hex color code to a descriptive color name.
	 * Prevents hex codes from leaking into Gemini prompts.
	 */
	private hexToColorName(hex: string): string {
		if (!hex) return 'neutral color';
		const clean = hex.replace('#', '').toLowerCase();

		// Known color map
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

		if (colorMap[clean]) return colorMap[clean];

		// Approximate by RGB values
		if (clean.length < 6) return 'neutral color';
		const r = parseInt(clean.substring(0, 2), 16);
		const g = parseInt(clean.substring(2, 4), 16);
		const b = parseInt(clean.substring(4, 6), 16);
		const brightness = (r * 299 + g * 587 + b * 114) / 1000;

		if (brightness > 240) return 'very light, almost white';
		if (brightness < 30) return 'very dark, almost black';

		if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20) {
			if (brightness > 180) return 'light gray';
			if (brightness > 100) return 'medium gray';
			return 'dark charcoal gray';
		}

		const max = Math.max(r, g, b);
		const base =
			max === r
				? g > 150 ? 'warm yellow-orange' : b > 100 ? 'deep magenta pink' : 'rich red'
				: max === g
					? r > 150 ? 'lime yellow-green' : b > 100 ? 'teal cyan' : 'forest green'
					: r > 100 ? 'deep purple' : g > 100 ? 'ocean teal blue' : 'deep navy blue';

		if (brightness > 180) return `light ${base}`;
		if (brightness < 80) return `dark ${base}`;
		return base;
	}

	/**
	 * Formats brand color as "descriptive name (hex)" for Claude context,
	 * but emphasizes the descriptive name so Claude uses that in prompts.
	 */
	private formatColor(hex: string): string {
		if (!hex) return 'not specified';
		return `${this.hexToColorName(hex)} (original: ${hex})`;
	}

	/**
	 * Sanitizes user-provided notes for prompt injection.
	 * Max 500 chars, common injection patterns olib tashlanadi.
	 */
	private sanitizeImportantNotes(notes: string): string {
		if (!notes || typeof notes !== 'string') return '';

		let sanitized = notes.slice(0, 500);

		const injectionPatterns = [
			/ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|context)/gi,
			/forget\s+(everything|all|your|the)\s+(instructions?|prompts?|context)/gi,
			/you\s+are\s+now\s+a/gi,
			/system\s*:/gi,
			/\[INST\]/gi,
			/<<SYS>>/gi,
			/###\s*(instruction|system|override)/gi,
			/<\/?(?:system|user|assistant|s)\b/gi,
			/begin\s+new\s+(prompt|instructions?|context)/gi,
			/disregard\s+(all\s+)?(previous|prior|above)/gi,
		];

		for (const pattern of injectionPatterns) {
			sanitized = sanitized.replace(pattern, '[removed]');
		}

		return sanitized.trim();
	}

	/**
	 * If concept image URL present — returns vision content array.
	 * Otherwise — returns plain string.
	 */
	private buildUserMessageContent(
		textPrompt: string,
		conceptImageUrl?: string,
	): Anthropic.MessageParam['content'] {
		if (conceptImageUrl && conceptImageUrl.startsWith('http')) {
			return [
				{
					type: 'image',
					source: { type: 'url', url: conceptImageUrl },
				} as Anthropic.ImageBlockParam,
				{
					type: 'text',
					text: textPrompt,
				} as Anthropic.TextBlockParam,
			];
		}
		return textPrompt;
	}

	/**
	 * Parses the 6-variation response.
	 */
	private parse6VariationsResponse(text: string): Claude6VariationsResponse {
		let jsonStr = text.trim();

		// Extract JSON from code block
		const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
		if (codeBlockMatch) {
			jsonStr = codeBlockMatch[1].trim();
		}

		const parsed = JSON.parse(jsonStr);

		// Check that "variations" array exists
		if (!parsed.variations || !Array.isArray(parsed.variations)) {
			throw new Error('Claude response missing "variations" array');
		}

		if (parsed.variations.length < 1) {
			throw new Error('Claude response has empty variations array');
		}

		// Validate each variation
		const required = ['headline', 'subheadline', 'body_text', 'callout_texts', 'cta_text', 'gemini_image_prompt'];
		const validVariations: ClaudeResponseJson[] = [];

		for (let i = 0; i < parsed.variations.length; i++) {
			const v = parsed.variations[i];
			for (const field of required) {
				if (!v[field]) {
					this.logger.warn(`Variation ${i} missing field: ${field}, skipping...`);
					continue;
				}
			}

			validVariations.push({
				headline: v.headline,
				subheadline: v.subheadline,
				body_text: v.body_text,
				callout_texts: v.callout_texts,
				cta_text: v.cta_text,
				gemini_image_prompt: v.gemini_image_prompt,
			});
		}

		if (validVariations.length === 0) {
			throw new Error('No valid variations found in Claude response');
		}

		// If fewer than 6 — log (but do not throw)
		if (validVariations.length < 6) {
			this.logger.warn(`Claude returned ${validVariations.length} variations instead of 6. Proceeding with available variations.`);
		}

		this.logger.log(`Parsed ${validVariations.length} valid variations from Claude response`);
		return { variations: validVariations };
	}

	/**
	 * Parse single ad response (fixErrors, regenerateSingle).
	 */
	private parseResponse(text: string): ClaudeResponseJson {
		let jsonStr = text.trim();

		const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
		if (codeBlockMatch) {
			jsonStr = codeBlockMatch[1].trim();
		}

		const parsed = JSON.parse(jsonStr);

		const required = ['headline', 'subheadline', 'body_text', 'callout_texts', 'cta_text', 'gemini_image_prompt'];
		for (const field of required) {
			if (!parsed[field]) {
				throw new Error(`Claude response missing required field: ${field}`);
			}
		}

		return {
			headline: parsed.headline,
			subheadline: parsed.subheadline,
			body_text: parsed.body_text,
			callout_texts: parsed.callout_texts,
			cta_text: parsed.cta_text,
			gemini_image_prompt: parsed.gemini_image_prompt,
		};
	}
}
