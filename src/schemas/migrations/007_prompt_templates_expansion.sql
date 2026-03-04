-- ============================================
-- 007: Expand prompt_templates for fix_errors + concept layouts
-- Adds new template_type values and seeds concept layout prompts
-- ============================================

-- 1. Extend the enum with new template types
ALTER TYPE prompt_template_type ADD VALUE IF NOT EXISTS 'fix_errors';
ALTER TYPE prompt_template_type ADD VALUE IF NOT EXISTS 'user_template';

-- 2. Seed: Fix Errors system prompt
INSERT INTO prompt_templates (name, template_type, content, is_active, version) VALUES
('fix_errors_system', 'fix_errors',
$$You are a visual quality analyst and ad creative director for Static Engine. The user has generated a Facebook ad image but found errors in it. Your job is to:

1. ANALYZE the current ad image (if provided) to identify visual issues
2. WRITE an improved Gemini image generation prompt that fixes the issues
3. PRESERVE everything that was correct in the original ad

ANALYSIS FRAMEWORK — Check for these common AI generation issues:

TEXT ISSUES:
- Misspelled words (very common: check every single word)
- Words cut off or overlapping
- Text too small to read
- Text color blending into background (poor contrast)
- Gibberish characters or garbled text
- Hex codes appearing as visible text

PRODUCT ISSUES:
- Product distorted, stretched, or wrong proportions
- Product missing entirely
- Wrong product shown (generic AI-generated instead of actual)
- Product photo poorly integrated (floating, no shadow, wrong scale)

LAYOUT ISSUES:
- Elements overlapping
- Unbalanced composition
- Too much empty space or too cluttered
- Key elements cut off at edges

COLOR ISSUES:
- Colors don't match brand palette
- Poor contrast making text unreadable
- Inconsistent color scheme across the ad

LOGO ISSUES:
- Logo distorted, too small, or wrong logo
- Logo placed in wrong position
- Logo colors incorrect

OUTPUT FORMAT — Respond with valid JSON only, no markdown, no code blocks:
{
  "headline": "Short headline (max 6 words, simple common words) — corrected and spell-checked",
  "subheadline": "Supporting text (max 10 words) — corrected",
  "body_text": "Persuasive body copy (max 25 words)",
  "callout_texts": ["Max 3 words", "Simple words", "Easy to spell"],
  "cta_text": "CTA (max 3 words)",
  "gemini_image_prompt": "IMPROVED prompt with specific fix instructions. Colors by NAME only — NEVER hex codes."
}

TEXT LENGTH RULES: Keep all text SHORT — shorter text = fewer spelling errors. Headlines max 6 words, callouts max 3 words each, CTA max 3 words. Use simple common English words only.

CRITICAL RULES:
- NEVER include hex codes in the improved prompt — use color names only
- NEVER include pixel dimensions (e.g. "48px", "115px", "1080x1080") — use descriptive sizes
- Keep testimonials SHORT: max 8 words per sentence to prevent word duplication
- Spell-check every word in corrected copy
- Reference "provided product photo" and "provided brand logo" — don't describe them
- Focus the prompt improvements specifically on the identified issues
- Keep everything that was correct — don't change what's already good$$,
TRUE, 1)
ON CONFLICT DO NOTHING;

-- 3. Seed: Concept layout instructions (one per category)

INSERT INTO prompt_templates (name, template_type, content, is_active, version) VALUES
('concept_layout_feature_pointers', 'concept_modifier',
$$This is a FEATURE POINTER ad layout:
- Product photo centered in the middle of the canvas
- 3-5 circular badges/callouts surrounding the product
- Each circle contains 1-3 words highlighting a key feature
- Thin lines or arrows connect each circle to the relevant part of the product
- Headline text large at the top
- Subheadline smaller below the headline
- Brand logo at the top (above headline or in corner)
- Body text in a solid bar/strip at the bottom
- CTA button in the bottom bar or bottom-right
- Background: gradient using brand colors$$,
TRUE, 1),

('concept_layout_social_proof', 'concept_modifier',
$$This is a SOCIAL PROOF ad layout:
- Star rating displayed prominently (use bright yellow/gold stars + number)
- Review count shown (e.g. "1,132+ Reviews")
- Product photo centered or slightly off-center
- Testimonial-style headline (in quotes or as a claim)
- Trust badges or callout circles around the product
- Brand logo at top
- Body text strip at bottom with CTA
- Background: clean, professional, brand-colored gradient$$,
TRUE, 1),

('concept_layout_before_after', 'concept_modifier',
$$This is a BEFORE and AFTER ad layout:
- Split layout: left side shows "before" state, right side shows "after" state
- Clear "BEFORE" and "AFTER" labels
- Product photo positioned at the dividing line or below the comparison
- Headline emphasizing transformation
- Minimal callout circles — focus is on the visual comparison
- Brand logo at top
- CTA at bottom$$,
TRUE, 1),

('concept_layout_listicle', 'concept_modifier',
$$This is a LISTICLE ad layout:
- Numbered list of 3-5 benefits or features
- Each list item is short (3-8 words)
- Numbers in large bold font, text beside each
- Product photo to the right side or bottom
- Headline at top (e.g. "5 Reasons to Try..." or "Why Pet Parents Love...")
- Brand logo at top
- CTA at bottom bar$$,
TRUE, 1),

('concept_layout_comparison', 'concept_modifier',
$$This is a COMPARISON ad layout:
- Two-column or split layout: "Them" vs "Us" (or competitor vs brand)
- Checkmarks for brand features, X marks for competitor shortcomings
- Brand name prominently on the winning side
- Product photo on the brand side
- Headline: competitive angle ("Why Switch?" or "Not All X Are Equal")
- Brand logo at top
- CTA at bottom$$,
TRUE, 1),

('concept_layout_bold_offer', 'concept_modifier',
$$This is a BOLD OFFER ad layout:
- Large price or discount displayed prominently (e.g. "50% OFF" or "$29.99")
- Strike-through original price if available
- Urgency element ("Limited Time" or "While Supplies Last")
- Product photo centered
- Fewer feature callouts — focus on the deal
- Brand logo at top
- Strong CTA ("Claim Your Offer", "Shop The Sale")$$,
TRUE, 1),

('concept_layout_testimonial', 'concept_modifier',
$$This is a TESTIMONIAL ad layout:
- Large quote from a customer (use review data if available)
- Star rating displayed
- Customer-style attribution (first name + initial, or "Verified Buyer")
- Product photo below or beside the quote
- Brand logo at top
- Minimal design — let the words speak
- CTA at bottom$$,
TRUE, 1),

('concept_layout_minimalist', 'concept_modifier',
$$This is a MINIMALIST ad layout:
- Clean white or single-color background
- Product photo with lots of negative space
- Short, impactful headline (2-4 words)
- No callout circles — just headline + product + CTA
- Brand logo subtly placed
- Premium, luxury feel
- Minimal text — let the product shine$$,
TRUE, 1),

('concept_layout_ugc_style', 'concept_modifier',
$$This is a UGC (User Generated Content) STYLE ad layout:
- Made to look like organic social media content
- Casual, authentic tone
- Product shown in lifestyle context (not studio)
- Text overlays like Instagram stories
- Informal headline ("This changed everything" or "POV: You found...")
- Less corporate, more personal
- CTA subtle or text-based$$,
TRUE, 1),

('concept_layout_ingredient_spotlight', 'concept_modifier',
$$This is an INGREDIENT SPOTLIGHT ad layout:
- One key ingredient or feature highlighted with magnification
- Circular callout or badge showing the ingredient
- Surrounding text explains what it does
- Product photo showing the ingredient list or label
- Scientific or trust-building tone
- Brand logo at top
- CTA at bottom$$,
TRUE, 1)

ON CONFLICT DO NOTHING;
