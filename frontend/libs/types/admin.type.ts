// =============================================
// TYPES — Admin (mirrors backend admin types & DTOs)
// =============================================

import { AdminRole } from "../enums/admin.enum";

// ── Admin User ──────────────────────────────────────────────

/** Admin user returned from API (no password_hash) */
export interface AdminUser {
    _id: string;
    email: string;
    name: string;
    role: AdminRole;
    created_at: string;
}

/** Admin login/signup response */
export interface AdminAuthResponse {
    accessToken: string;
    admin: AdminUser;
}

// ── Admin Auth DTOs ─────────────────────────────────────────

/** POST /member/adminSignup */
export interface AdminSignupInput {
    email: string;
    password: string;
    name: string;
    role: AdminRole;
}

/** POST /member/adminLogin */
export interface AdminLoginInput {
    email: string;
    password: string;
}

// ── Admin Concept DTOs ──────────────────────────────────────

/** POST /concept/createConceptByAdmin */
export interface CreateConceptInput {
    category_id: string;
    name: string;
    image_url: string;
    tags: string[];
    description: string;
    source_url?: string;
    is_active?: boolean;
    display_order?: number;
}

/** POST /concept/updateConceptByAdmin/:id */
export interface UpdateConceptInput {
    category_id?: string;
    name?: string;
    image_url?: string;
    tags?: string[];
    description?: string;
    source_url?: string;
    is_active?: boolean;
    display_order?: number;
}

/** POST /concept/createCategoryByAdmin */
export interface CreateCategoryInput {
    name: string;
    slug?: string;
    description?: string;
    display_order?: number;
}

/** POST /concept/reorderConceptsByAdmin */
export interface ReorderConceptsInput {
    category_id: string;
    items: { id: string; display_order: number }[];
}

// ── Admin GET Response Types ────────────────────────────────

/** GET /concept/getConcepts response */
export interface ConceptsResponse {
    list: import("./concept.type").AdConcept[];
    total: number;
}

/** GET /concept/getConcepts query params */
export interface GetConceptsParams {
    category_id?: string;
    search?: string;
    tags?: string;
    page?: number;
    limit?: number;
}
