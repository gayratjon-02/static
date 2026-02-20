// =============================================
// SERVER — Admin POST APIs (admin-only endpoints)
// =============================================

import API_BASE_URL from "../../libs/config/api.config";
import type { AdConcept, ConceptCategoryItem } from "../../libs/types/concept.type";
import type {
    AdminAuthResponse,
    AdminSignupInput,
    AdminLoginInput,
    CreateConceptInput,
    UpdateConceptInput,
    CreateCategoryInput,
    ReorderConceptsInput,
} from "../../libs/types/admin.type";

export type {
    AdminAuthResponse,
    AdminSignupInput,
    AdminLoginInput,
    CreateConceptInput,
    UpdateConceptInput,
    CreateCategoryInput,
    ReorderConceptsInput,
};

// ── Shared Helpers ──────────────────────────────────────────

/** Auth headers with admin Bearer token */
function adminHeaders(): Record<string, string> {
    const token = localStorage.getItem("se_admin_token");
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };
}

/** Generic POST request (JSON body) with error handling */
async function postRequest<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Request failed" }));
        throw new Error(error.message || `POST ${url} failed (${res.status})`);
    }

    return res.json();
}

// =============================================
// 1. AUTH — Admin signup & login
// =============================================

const MEMBER_API = `${API_BASE_URL}/member`;

export async function adminSignup(input: AdminSignupInput): Promise<AdminAuthResponse> {
    return postRequest<AdminAuthResponse>(`${MEMBER_API}/adminSignup`, input);
}

export async function adminLogin(input: AdminLoginInput): Promise<AdminAuthResponse> {
    return postRequest<AdminAuthResponse>(`${MEMBER_API}/adminLogin`, input);
}

// =============================================
// 2. CATEGORIES — Admin category management
// =============================================

const CONCEPT_API = `${API_BASE_URL}/concept`;

/**
 * POST /concept/createCategoryByAdmin
 * Create a new concept category.
 */
export async function createCategory(input: CreateCategoryInput): Promise<ConceptCategoryItem> {
    return postRequest<ConceptCategoryItem>(`${CONCEPT_API}/createCategoryByAdmin`, input);
}

// =============================================
// 3. CONCEPTS — Admin concept management
// =============================================

/**
 * POST /concept/uploadImage
 * Upload a concept preview image (PNG, JPG, JPEG, WEBP). Max 10MB.
 */
export async function uploadConceptImage(file: File): Promise<{ image_url: string }> {
    const token = localStorage.getItem("se_admin_token");
    const formData = new FormData();
    formData.append("image", file);

    const res = await fetch(`${CONCEPT_API}/uploadImage`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
        },
        body: formData,
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to upload image" }));
        throw new Error(error.message || `Upload failed (${res.status})`);
    }

    return res.json();
}

/**
 * POST /concept/createConceptByAdmin
 * Create a new ad concept.
 */
export async function createConcept(input: CreateConceptInput): Promise<AdConcept> {
    return postRequest<AdConcept>(`${CONCEPT_API}/createConceptByAdmin`, input);
}

/**
 * POST /concept/updateConceptByAdmin/:id
 * Update an existing concept.
 */
export async function updateConcept(id: string, input: UpdateConceptInput): Promise<AdConcept> {
    return postRequest<AdConcept>(`${CONCEPT_API}/updateConceptByAdmin/${id}`, input);
}

/**
 * POST /concept/deleteConceptByAdmin/:id
 * Delete a concept. SUPER_ADMIN only.
 */
export async function deleteConcept(id: string): Promise<{ message: string }> {
    return postRequest<{ message: string }>(`${CONCEPT_API}/deleteConceptByAdmin/${id}`, {});
}

/**
 * POST /concept/reorderConceptsByAdmin
 * Batch reorder concepts via display_order.
 */
export async function reorderConcepts(input: ReorderConceptsInput): Promise<{ message: string }> {
    return postRequest<{ message: string }>(`${CONCEPT_API}/reorderConceptsByAdmin`, input);
}

// =============================================
// ADMIN — USER MANAGEMENT
// =============================================

/**
 * POST /member/adminBlock/:id
 * Suspend a user account (admin only).
 */
export async function blockUser(id: string): Promise<{ _id: string; email: string; member_status: string }> {
    return postRequest(`${MEMBER_API}/adminBlock/${id}`, {});
}

/**
 * POST /member/adminUnblock/:id
 * Reactivate a suspended user (admin only).
 */
export async function unblockUser(id: string): Promise<{ _id: string; email: string; member_status: string }> {
    return postRequest(`${MEMBER_API}/adminUnblock/${id}`, {});
}

// =============================================
// ADMIN — CANVA ORDERS (fulfill)
// =============================================

const CANVA_API = `${API_BASE_URL}/canva`;

async function patchRequest<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Request failed" }));
        throw new Error(error.message || `PATCH failed (${res.status})`);
    }

    return res.json();
}

/**
 * PATCH /canva/orders/:id/fulfill
 * Set Canva link and send email to customer (admin only).
 */
export async function fulfillCanvaOrder(orderId: string, canvaLink: string): Promise<{ success: boolean }> {
    return patchRequest<{ success: boolean }>(`${CANVA_API}/orders/${orderId}/fulfill`, { canva_link: canvaLink });
}

// =============================================
// ADMIN — PROMPT TEMPLATES
// =============================================

const PROMPT_TEMPLATES_API = `${API_BASE_URL}/prompt-templates`;

/**
 * PATCH /prompt-templates/:id
 * Update prompt template content or is_active (admin only).
 */
export async function updatePromptTemplateAdmin(
    id: string,
    payload: { content?: string; is_active?: boolean },
): Promise<{ _id: string; name: string; template_type: string; content: string; version: number; is_active: boolean; updated_at: string }> {
    return patchRequest(`${PROMPT_TEMPLATES_API}/${id}`, payload);
}

