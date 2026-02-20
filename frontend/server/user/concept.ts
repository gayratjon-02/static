// =============================================
// SERVER — Concept API (user endpoints)
// =============================================

import API_BASE_URL from "../../libs/config/api.config";
import type { AdConcept, ConceptCategoryItem, ConceptConfig } from "../../libs/types/concept.type";

const CONCEPT_API = `${API_BASE_URL}/concept`;

/** Helper: get auth headers */
function authHeaders(): Record<string, string> {
    const token = localStorage.getItem("se_access_token");
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };
}

// ---- CONFIG ----

/**
 * GET /concept/config
 * Get public concept config (popular threshold, recommended limit, etc.)
 */
export async function getConceptConfig(): Promise<ConceptConfig> {
    const res = await fetch(`${CONCEPT_API}/config`, {
        method: "GET",
        headers: authHeaders(),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to fetch config" }));
        throw new Error(error.message || `Get config failed (${res.status})`);
    }

    return res.json();
}

// ---- CATEGORIES ----

/**
 * GET /concept/getCategories
 * Get all concept categories ordered by display_order.
 */
export async function getCategories(): Promise<{ list: ConceptCategoryItem[] }> {
    const res = await fetch(`${CONCEPT_API}/getCategories`, {
        method: "GET",
        headers: authHeaders(),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to fetch categories" }));
        throw new Error(error.message || `Get categories failed (${res.status})`);
    }

    return res.json();
}

// ---- CONCEPTS ----

/**
 * GET /concept/getConcepts?category_id=&search=&tags=&page=1&limit=50
 * Get paginated concept library (only active concepts).
 */
export async function getConcepts(
    categoryId?: string,
    search?: string,
    tags?: string,
    page: number = 1,
    limit: number = 50,
): Promise<{ list: AdConcept[]; total: number }> {
    const params = new URLSearchParams();
    if (categoryId) params.set("category_id", categoryId);
    if (search) params.set("search", search);
    if (tags) params.set("tags", tags);
    params.set("page", String(page));
    params.set("limit", String(limit));

    const res = await fetch(`${CONCEPT_API}/getConcepts?${params.toString()}`, {
        method: "GET",
        headers: authHeaders(),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to fetch concepts" }));
        throw new Error(error.message || `Get concepts failed (${res.status})`);
    }

    return res.json();
}

/**
 * GET /concept/getRecommended
 * Get top 10 most used concepts.
 */
export async function getRecommendedConcepts(): Promise<{ list: AdConcept[] }> {
    const res = await fetch(`${CONCEPT_API}/getRecommended`, {
        method: "GET",
        headers: authHeaders(),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to fetch recommended concepts" }));
        throw new Error(error.message || `Get recommended failed (${res.status})`);
    }

    return res.json();
}

/**
 * PATCH /concept/incrementUsage/:id
 * Increment usage_count for a concept (called when user selects a concept for generation).
 */
export async function incrementUsage(id: string): Promise<{ usage_count: number }> {
    const res = await fetch(`${CONCEPT_API}/incrementUsage/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to increment usage" }));
        throw new Error(error.message || `Increment usage failed (${res.status})`);
    }

    return res.json();
}
