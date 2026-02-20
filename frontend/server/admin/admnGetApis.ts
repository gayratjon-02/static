// =============================================
// SERVER — Admin GET APIs (admin-only endpoints)
// =============================================

import API_BASE_URL from "../../libs/config/api.config";
import type { AdConcept, ConceptCategoryItem } from "../../libs/types/concept.type";
import type { ConceptsResponse, GetConceptsParams } from "../../libs/types/admin.type";

export type { ConceptsResponse, GetConceptsParams };

// ── Shared Helpers ──────────────────────────────────────────

/** Auth headers with admin Bearer token */
function adminHeaders(): Record<string, string> {
    const token = localStorage.getItem("se_admin_token");
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };
}

/** Generic GET request with error handling */
async function getRequest<T>(url: string): Promise<T> {
    const res = await fetch(url, {
        method: "GET",
        headers: adminHeaders(),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Request failed" }));
        throw new Error(error.message || `GET ${url} failed (${res.status})`);
    }

    return res.json();
}

// =============================================
// CATEGORIES
// =============================================

const CONCEPT_API = `${API_BASE_URL}/concept`;

/**
 * GET /concept/getCategories
 * Returns all concept categories ordered by display_order.
 */
export async function getCategories(): Promise<{ list: ConceptCategoryItem[] }> {
    return getRequest<{ list: ConceptCategoryItem[] }>(`${CONCEPT_API}/getCategories`);
}

// =============================================
// CONCEPTS
// =============================================

/**
 * GET /concept/getConcepts?category_id=...&search=...&tags=...&page=1&limit=20
 * Returns filtered, paginated concept library for admin management.
 */
export async function getConcepts(
    params: GetConceptsParams = {},
): Promise<ConceptsResponse> {
    const query = new URLSearchParams();
    if (params.category_id) query.set("category_id", params.category_id);
    if (params.search) query.set("search", params.search);
    if (params.tags) query.set("tags", params.tags);
    query.set("page", String(params.page ?? 1));
    query.set("limit", String(params.limit ?? 20));
    // Admin sees all concepts including inactive ones
    query.set("include_inactive", "true");

    return getRequest<ConceptsResponse>(
        `${CONCEPT_API}/getConcepts?${query.toString()}`,
    );
}

/**
 * GET /concept/getRecommended
 * Returns top 10 concepts sorted by usage_count.
 */
export async function getRecommendedConcepts(): Promise<{ list: AdConcept[] }> {
    return getRequest<{ list: AdConcept[] }>(`${CONCEPT_API}/getRecommended`);
}

// =============================================
// ADMIN — USER MANAGEMENT & PLATFORM STATS
// =============================================

const MEMBER_API = `${API_BASE_URL}/member`;

export interface AdminUser {
    _id: string;
    email: string;
    full_name: string;
    member_status: string;
    subscription_tier: string;
    subscription_status: string;
    credits_used: number;
    credits_limit: number;
    created_at: string;
}

export interface AdminUsersResponse {
    list: AdminUser[];
    total: number;
    page: number;
    limit: number;
}

export interface AdminPlatformStats {
    users: { total: number; active: number; paid: number };
    generations: { total: number; today: number; this_week: number; completed: number; failed: number };
}

/**
 * GET /member/adminUsers
 * Returns paginated list of all users (admin only).
 */
export async function getAdminUsers(params: {
    search?: string;
    tier?: string;
    status?: string;
    page?: number;
    limit?: number;
} = {}): Promise<AdminUsersResponse> {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.tier) query.set("tier", params.tier);
    if (params.status) query.set("status", params.status);
    query.set("page", String(params.page ?? 1));
    query.set("limit", String(params.limit ?? 20));
    return getRequest<AdminUsersResponse>(`${MEMBER_API}/adminUsers?${query.toString()}`);
}

/**
 * GET /member/adminStats
 * Returns platform-wide statistics (admin only).
 */
export async function getAdminStats(): Promise<AdminPlatformStats> {
    return getRequest<AdminPlatformStats>(`${MEMBER_API}/adminStats`);
}

// =============================================
// ADMIN — CANVA ORDERS
// =============================================

const CANVA_API = `${API_BASE_URL}/canva`;

export interface CanvaOrderAdmin {
    _id: string;
    user_id: string;
    generated_ad_id: string;
    stripe_payment_id: string;
    price_paid_cents: number;
    status: string;
    canva_link: string | null;
    fulfilled_at: string | null;
    fulfilled_by: string | null;
    created_at: string;
    users?: { email?: string; full_name?: string } | null;
    generated_ads?: { ad_name?: string; image_url_1x1?: string; image_url_16x9?: string; image_url_9x16?: string } | null;
}

/**
 * GET /canva/orders/all
 * Returns all Canva orders (admin only).
 */
export async function getCanvaOrdersAdmin(): Promise<CanvaOrderAdmin[]> {
    return getRequest<CanvaOrderAdmin[]>(`${CANVA_API}/orders/all`);
}

// =============================================
// ADMIN — PROMPT TEMPLATES
// =============================================

const PROMPT_TEMPLATES_API = `${API_BASE_URL}/prompt-templates`;

export interface PromptTemplateAdmin {
    _id: string;
    name: string;
    template_type: string;
    content: string;
    version: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

/**
 * GET /prompt-templates
 * Returns all prompt templates (admin only).
 */
export async function getPromptTemplatesAdmin(): Promise<PromptTemplateAdmin[]> {
    return getRequest<PromptTemplateAdmin[]>(`${PROMPT_TEMPLATES_API}`);
}
