// =============================================
// SERVER — Product API (user endpoints)
// =============================================

import API_BASE_URL from "../../libs/config/api.config";
import type { Product, CreateProductInput, UpdateProductInput } from "../../libs/types/product.type";

const PRODUCT_API = `${API_BASE_URL}/product`;

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
 * POST /product/uploadPhoto
 * Upload a product photo (PNG, JPG, JPEG, WEBP). Max 10MB.
 * Returns { photo_url: string }
 */
export async function uploadProductPhoto(file: File): Promise<{ photo_url: string }> {
    const token = localStorage.getItem("se_access_token");
    const formData = new FormData();
    formData.append("photo", file);

    const res = await fetch(`${PRODUCT_API}/uploadPhoto`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
        },
        body: formData,
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to upload photo" }));
        throw new Error(error.message || `Upload failed (${res.status})`);
    }

    return res.json();
}

// ---- CREATE ----

/**
 * POST /product/createProduct
 * Create a new product under a brand.
 */
export async function createProduct(input: CreateProductInput): Promise<Product> {
    const res = await fetch(`${PRODUCT_API}/createProduct`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(input),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to create product" }));
        throw new Error(error.message || `Create product failed (${res.status})`);
    }

    return res.json();
}

// ---- READ ----

/**
 * GET /product/getProducts/:brandId?page=1&limit=10
 * Get all products for a specific brand (paginated).
 */
export async function getProducts(
    brandId: string,
    page: number = 1,
    limit: number = 10
): Promise<{ list: Product[]; total: number }> {
    const res = await fetch(
        `${PRODUCT_API}/getProducts/${brandId}?page=${page}&limit=${limit}`,
        {
            method: "GET",
            headers: authHeaders(),
        }
    );

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to fetch products" }));
        throw new Error(error.message || `Get products failed (${res.status})`);
    }

    return res.json();
}

/**
 * GET /product/getProductById/:id
 * Get a single product by ID.
 */
export async function getProductById(id: string): Promise<Product> {
    const res = await fetch(`${PRODUCT_API}/getProductById/${id}`, {
        method: "GET",
        headers: authHeaders(),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to fetch product" }));
        throw new Error(error.message || `Get product failed (${res.status})`);
    }

    return res.json();
}

// ---- UPDATE ----

/**
 * POST /product/updateProductById/:id
 * Update a product by ID.
 */
export async function updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
    const res = await fetch(`${PRODUCT_API}/updateProductById/${id}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(input),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to update product" }));
        throw new Error(error.message || `Update product failed (${res.status})`);
    }

    return res.json();
}

// ---- DELETE ----

/**
 * POST /product/deleteProductById/:id
 * Delete a product by ID.
 */
export async function deleteProduct(id: string): Promise<{ message: string }> {
    const res = await fetch(`${PRODUCT_API}/deleteProductById/${id}`, {
        method: "POST",
        headers: authHeaders(),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to delete product" }));
        throw new Error(error.message || `Delete product failed (${res.status})`);
    }

    return res.json();
}

/**
 * POST /product/importFromUrl
 * Scrapes a website URL and returns pre-filled product data.
 */
export async function importProductFromUrl(url: string): Promise<{
    name: string;
    description: string;
    product_url: string;
    photo_url: string;
    price_text: string;
}> {
    const res = await fetch(`${PRODUCT_API}/importFromUrl`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ url }),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to import product" }));
        throw new Error(error.message || `Import failed (${res.status})`);
    }

    return res.json();
}

/**
 * POST /product/removeBackground/:id
 * Removes background from product photo via API.
 */
export async function removeProductBackground(id: string): Promise<{ photo_url: string }> {
    const res = await fetch(`${PRODUCT_API}/removeBackground/${id}`, {
        method: "POST",
        headers: authHeaders(),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to remove background" }));
        throw new Error(error.message || `Background removal failed (${res.status})`);
    }

    return res.json();
}
