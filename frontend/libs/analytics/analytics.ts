/**
 * analytics.ts — Unified analytics module
 * Wraps PostHog, GA4 (gtag), and Meta Pixel behind a single clean API.
 *
 * Environment variables required in .env.local:
 *   NEXT_PUBLIC_POSTHOG_KEY       — PostHog project API key
 *   NEXT_PUBLIC_POSTHOG_HOST      — PostHog host (default: https://app.posthog.com)
 *   NEXT_PUBLIC_GA4_ID            — GA4 Measurement ID (G-XXXXXXXXXX)
 *   NEXT_PUBLIC_META_PIXEL_ID     — Meta Pixel ID
 */

// ─── Type helpers ─────────────────────────────────────────────────────────────
declare global {
    interface Window {
        gtag?: (...args: any[]) => void;
        fbq?: (...args: any[]) => void;
        posthog?: any;
    }
}

// ─── Funnel event names ───────────────────────────────────────────────────────
export const EVENTS = {
    // Acquisition
    PAGE_VIEW: "page_view",
    SIGNUP_STARTED: "signup_started",
    SIGNUP_COMPLETED: "signup_completed",
    LOGIN: "login",

    // Activation
    PLAN_SELECTED: "plan_selected",
    CHECKOUT_STARTED: "checkout_started",
    CHECKOUT_COMPLETED: "checkout_completed",     // subscription activated
    FIRST_GENERATION: "first_generation",
    GENERATION_STARTED: "generation_started",
    GENERATION_COMPLETED: "generation_completed",
    GENERATION_FAILED: "generation_failed",

    // Engagement
    AD_DOWNLOADED: "ad_downloaded",
    AD_FAVORITED: "ad_favorited",
    AD_RENAMED: "ad_renamed",
    AD_DELETED: "ad_deleted",
    BRAND_CREATED: "brand_created",
    PRODUCT_CREATED: "product_created",
    CONCEPT_CREATED: "concept_created",

    // Retention
    PORTAL_OPENED: "billing_portal_opened",
    ADDON_PURCHASED: "addon_purchased",
    LIBRARY_VIEWED: "library_viewed",
} as const;

export type AnalyticsEvent = typeof EVENTS[keyof typeof EVENTS];

// ─── UTM capture ──────────────────────────────────────────────────────────────
export function captureUTM(): Record<string, string> {
    if (typeof window === "undefined") return {};
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((key) => {
        const val = params.get(key);
        if (val) {
            utm[key] = val;
            // Persist across pages so signup page gets the attribution
            sessionStorage.setItem(key, val);
        }
    });
    return utm;
}

export function getStoredUTM(): Record<string, string> {
    if (typeof window === "undefined") return {};
    const utm: Record<string, string> = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((key) => {
        const val = sessionStorage.getItem(key);
        if (val) utm[key] = val;
    });
    return utm;
}

// ─── Core track function ──────────────────────────────────────────────────────
export function track(event: AnalyticsEvent, properties?: Record<string, any>) {
    const props = { ...properties, ...getStoredUTM() };

    // PostHog
    if (typeof window !== "undefined" && window.posthog) {
        try { window.posthog.capture(event, props); } catch { /* no-op */ }
    }

    // GA4
    if (typeof window !== "undefined" && window.gtag) {
        try { window.gtag("event", event, props); } catch { /* no-op */ }
    }

    // Meta Pixel — map to standard events where possible
    if (typeof window !== "undefined" && window.fbq) {
        try {
            const metaEventMap: Record<string, string> = {
                [EVENTS.SIGNUP_COMPLETED]: "CompleteRegistration",
                [EVENTS.CHECKOUT_STARTED]: "InitiateCheckout",
                [EVENTS.CHECKOUT_COMPLETED]: "Purchase",
                [EVENTS.GENERATION_COMPLETED]: "Lead",
            };
            const metaEvent = metaEventMap[event];
            if (metaEvent) {
                window.fbq("track", metaEvent, props);
            } else {
                window.fbq("trackCustom", event, props);
            }
        } catch { /* no-op */ }
    }
}

// ─── Identify user (call after login/signup) ──────────────────────────────────
export function identifyUser(userId: string, traits?: Record<string, any>) {
    if (typeof window === "undefined") return;

    if (window.posthog) {
        try {
            window.posthog.identify(userId, traits);
        } catch { /* no-op */ }
    }

    if (window.gtag) {
        try { window.gtag("config", process.env.NEXT_PUBLIC_GA4_ID || "", { user_id: userId }); } catch { /* no-op */ }
    }
}

// ─── Page view (call on router events) ───────────────────────────────────────
export function trackPageView(url: string) {
    const props = { url, ...getStoredUTM() };

    if (typeof window !== "undefined" && window.posthog) {
        try { window.posthog.capture("$pageview", props); } catch { /* no-op */ }
    }

    if (typeof window !== "undefined" && window.gtag) {
        try {
            window.gtag("config", process.env.NEXT_PUBLIC_GA4_ID || "", {
                page_path: url,
            });
        } catch { /* no-op */ }
    }

    if (typeof window !== "undefined" && window.fbq) {
        try { window.fbq("track", "PageView"); } catch { /* no-op */ }
    }
}
