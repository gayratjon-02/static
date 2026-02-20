// =============================================
// SERVER — Generation API
// =============================================

import API_BASE_URL from "../../libs/config/api.config";
import type {
    CreateGenerationInput,
    GenerationResponse,
    GetGenerationsQuery,
    LibraryCounts,
    AdLibraryItem,
    GenerationBatchResponse
} from "../../libs/types/generation.type";

const GENERATION_API = `${API_BASE_URL}/generation`;

/** Helper: get auth headers */
function authHeaders(): Record<string, string> {
    const token = localStorage.getItem("se_access_token");
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };
}

/**
 * POST /generation/createGeneration
 * Start a new ad generation job.
 * Returns { job_id, status, message }
 */
export async function createGeneration(input: CreateGenerationInput): Promise<GenerationResponse> {
    const res = await fetch(`${GENERATION_API}/createGeneration`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(input),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Generation failed" }));
        throw new Error(error.message || `Generation failed (${res.status})`);
    }

    return res.json();
}

/**
 * GET /generation/getStatus/:jobId
 * Poll for generation status + image URLs.
 */
export async function getGenerationStatus(jobId: string): Promise<{
    _id: string;
    generation_status: string;
    image_url_1x1: string | null;
    image_url_9x16: string | null;
    image_url_16x9: string | null;
    ad_copy_json: any;
    ad_name: string | null;
    created_at: string;
}> {
    const res = await fetch(`${GENERATION_API}/getStatus/${jobId}`, {
        method: "GET",
        headers: authHeaders(),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Status check failed" }));
        throw new Error(error.message || `Status check failed (${res.status})`);
    }

    return res.json();
}

/**
 * GET /generation/getRecent
 * Fetch the authenticated user's recent generations.
 */
export async function getRecentGenerationsRequest(limit = 6): Promise<any[]> {
    const res = await fetch(`${GENERATION_API}/getRecent?limit=${limit}`, {
        method: "GET",
        headers: authHeaders(),
    });

    if (!res.ok) {
        throw new Error("Failed to fetch recent generations");
    }

    return res.json();
}

/**
 * GET /generation/list
 * Fetch filtered ads for the library.
 */
export async function getLibraryAdsRequest(query: GetGenerationsQuery): Promise<{ list: AdLibraryItem[], total: number }> {
    const params = new URLSearchParams();
    if (query.page) params.append("page", query.page.toString());
    if (query.limit) params.append("limit", query.limit.toString());
    if (query.search) params.append("search", query.search);
    if (query.brand_id) params.append("brand_id", query.brand_id);
    if (query.product_id) params.append("product_id", query.product_id);
    if (query.concept_id) params.append("concept_id", query.concept_id);
    if (query.sort_by) params.append("sort_by", query.sort_by);

    const res = await fetch(`${GENERATION_API}/list?${params.toString()}`, {
        headers: authHeaders(),
    });

    if (!res.ok) throw new Error("Failed to fetch library ads");
    return res.json();
}

/**
 * GET /generation/counts
 * Fetch counts for sidebar (brands, products).
 */
export async function getLibraryCountsRequest(): Promise<LibraryCounts> {
    const res = await fetch(`${GENERATION_API}/counts`, {
        headers: authHeaders(),
    });

    if (!res.ok) throw new Error("Failed to fetch library counts");
    return res.json();
}

/**
 * POST /generation/cancelBatch/:batchId
 * Cancel all pending/processing ads in a batch (user left the page).
 * Uses keepalive so the request survives page unload.
 */
export function cancelBatchRequest(batchId: string): void {
    const token = localStorage.getItem("se_access_token");
    fetch(`${GENERATION_API}/cancelBatch/${batchId}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        keepalive: true, // survives beforeunload
    }).catch(() => { /* silent — best effort */ });
}

/**
 * POST /generation/exportRatios/:adId
 * Get all 3 ratio URLs for a completed ad.
 */
export async function exportRatiosRequest(adId: string): Promise<{
    _id: string;
    ad_name: string | null;
    image_url_1x1: string | null;
    image_url_9x16: string | null;
    image_url_16x9: string | null;
}> {
    const res = await fetch(`${GENERATION_API}/exportRatios/${adId}`, {
        method: "POST",
        headers: authHeaders(),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Export failed" }));
        throw new Error(error.message || `Export failed (${res.status})`);
    }

    const data = await res.json();

    // Backend returns { ratios: [{ratio, label, image_url}] } — map to flat fields
    const findUrl = (ratio: string): string | null =>
        data.ratios?.find((r: any) => r.ratio === ratio)?.image_url ?? data[`image_url_${ratio.replace(":", "x")}`] ?? null;

    return {
        _id: data._id,
        ad_name: data.ad_name ?? null,
        image_url_1x1: findUrl("1:1"),
        image_url_9x16: findUrl("9:16"),
        image_url_16x9: findUrl("16:9"),
    };
}

/**
 * GET /generation/getBatchStatus/:batchId
 * Poll for batch generation status + image URLs.
 */
export async function getGenerationBatchStatus(batchId: string): Promise<GenerationBatchResponse> {
    const res = await fetch(`${GENERATION_API}/getBatchStatus/${batchId}`, {
        method: "GET",
        headers: authHeaders(),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Status check failed" }));
        throw new Error(error.message || `Status check failed (${res.status})`);
    }

    return res.json();
}

/**
 * GET /generation/download/:adId
 * Download the generated ad image via backend proxy.
 * The backend streams the S3 image with Content-Disposition: attachment.
 */
export async function downloadAdImage(adId: string, filename?: string): Promise<void> {
    const res = await fetch(`${GENERATION_API}/download/${adId}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${localStorage.getItem("se_access_token")}`,
        },
    });

    if (!res.ok) {
        throw new Error("Download failed");
    }

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename || `${adId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
}

/** POST /generation/toggleFavorite/:adId */
export async function toggleFavoriteRequest(adId: string): Promise<{ is_favorite: boolean }> {
    const res = await fetch(`${GENERATION_API}/toggleFavorite/${adId}`, {
        method: "POST",
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to toggle favorite");
    return res.json();
}

/** POST /generation/rename/:adId */
export async function renameAdRequest(adId: string, name: string): Promise<{ ad_name: string }> {
    const res = await fetch(`${GENERATION_API}/rename/${adId}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("Failed to rename ad");
    return res.json();
}

/** POST /generation/deleteMany */
export async function deleteAdsRequest(ids: string[]): Promise<{ deleted: number }> {
    const res = await fetch(`${GENERATION_API}/deleteMany`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error("Failed to delete ads");
    return res.json();
}

/** GET /generation/download/:adId/:ratio — proxy download for a specific ratio */
export async function downloadAdImageByRatio(adId: string, ratio: string, filename?: string): Promise<void> {
    const safeRatio = ratio.replace(":", "x");
    const res = await fetch(`${GENERATION_API}/download/${adId}/${ratio}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${localStorage.getItem("se_access_token")}` },
    });
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename || `${adId}_${safeRatio}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
}
