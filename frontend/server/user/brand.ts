// =============================================
// SERVER — Brand API (user endpoints)
// =============================================

import API_BASE_URL from "../../libs/config/api.config";
import type { Brand, CreateBrandInput, UpdateBrandInput } from "../../libs/types/brand.type";

const BRAND_API = `${API_BASE_URL}/brand`;

/** Helper: get auth headers */
function authHeaders(): Record<string, string> {
    const token = localStorage.getItem("se_access_token");
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };
}

// ---- UPLOAD ----

/**
 * POST /brand/uploadLogo
 * Upload a brand logo image (PNG, JPG, JPEG, WEBP). Max 5MB.
 * Returns { logo_url: string } — the relative path to the uploaded file.
 */
export async function uploadBrandLogo(file: File): Promise<{ logo_url: string }> {
    const token = localStorage.getItem("se_access_token");
    const formData = new FormData();
    formData.append("logo", file);

    console.log('\n━━━ uploadBrandLogo ━━━');
    console.log('  file.name:', file.name);
    console.log('  file.size:', file.size, 'bytes', `(${(file.size / 1024).toFixed(1)} KB)`);
    console.log('  file.type:', file.type);
    console.log('  API URL:', `${BRAND_API}/uploadLogo`);
    console.log('  token exists:', !!token);

    const res = await fetch(`${BRAND_API}/uploadLogo`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            // Note: Do NOT set Content-Type for FormData — browser sets it with boundary
        },
        body: formData,
    });

    console.log('  response status:', res.status, res.statusText);
    console.log('  response headers:', Object.fromEntries(res.headers.entries()));

    if (!res.ok) {
        let errorMsg = `Upload failed (${res.status})`;
        try {
            const errorBody = await res.text();
            console.error('  ❌ Error body:', errorBody);
            const parsed = JSON.parse(errorBody);
            errorMsg = parsed.message || errorMsg;
        } catch {
            console.error('  ❌ Could not parse error body');
        }
        throw new Error(errorMsg);
    }

    const result = await res.json();
    console.log('  ✅ Upload result:', result);
    return result;
}

// ---- CREATE ----

/**
 * POST /brand/createBrand
 * Create a new brand for the authenticated user.
 */
export async function createBrand(input: CreateBrandInput): Promise<Brand> {
    const res = await fetch(`${BRAND_API}/createBrand`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(input),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to create brand" }));
        throw new Error(error.message || `Create brand failed (${res.status})`);
    }

    return res.json();
}

// ---- READ ----

/**
 * GET /brand/getBrands?page=1&limit=10
 * Get all brands for the authenticated user (paginated).
 */
export async function getBrands(page: number = 1, limit: number = 10): Promise<{ list: Brand[]; total: number }> {
    const res = await fetch(`${BRAND_API}/getBrands?page=${page}&limit=${limit}`, {
        method: "GET",
        headers: authHeaders(),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to fetch brands" }));
        throw new Error(error.message || `Get brands failed (${res.status})`);
    }

    return res.json();
}

/**
 * GET /brand/getBrandById/:id
 * Get a single brand by ID.
 */
export async function getBrandById(id: string): Promise<Brand> {
    const res = await fetch(`${BRAND_API}/getBrandById/${id}`, {
        method: "GET",
        headers: authHeaders(),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to fetch brand" }));
        throw new Error(error.message || `Get brand failed (${res.status})`);
    }

    return res.json();
}

// ---- UPDATE ----

/**
 * POST /brand/updateBrandById/:id
 * Update a brand by ID.
 */
export async function updateBrand(id: string, input: UpdateBrandInput): Promise<Brand> {
    const res = await fetch(`${BRAND_API}/updateBrandById/${id}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(input),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to update brand" }));
        throw new Error(error.message || `Update brand failed (${res.status})`);
    }

    return res.json();
}

// ---- DELETE ----

/**
 * POST /brand/deleteBrandById/:id
 * Delete a brand by ID.
 */
export async function deleteBrand(id: string): Promise<{ message: string }> {
    const res = await fetch(`${BRAND_API}/deleteBrandById/${id}`, {
        method: "POST",
        headers: authHeaders(),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to delete brand" }));
        throw new Error(error.message || `Delete brand failed (${res.status})`);
    }

    return res.json();
}

// ---- IMPORT FROM URL ----

/**
 * POST /brand/importFromUrl
 * Scrapes a website URL and returns pre-filled brand data.
 * Returns: { name, description, website_url, industry, logo_url, primary_color, secondary_color, accent_color, background_color }
 */
export async function importBrandFromUrl(url: string): Promise<{
    name: string;
    description: string;
    website_url: string;
    industry: string;
    logo_url: string;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    background_color: string;
}> {
    const res = await fetch(`${BRAND_API}/importFromUrl`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ url }),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to import brand" }));
        throw new Error(error.message || `Import failed (${res.status})`);
    }

    return res.json();
}
