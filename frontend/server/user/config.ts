// =============================================
// SERVER — Brand Config API
// =============================================

import API_BASE_URL from "../../libs/config/api.config";

export interface IndustryItem {
    id: string;
    label: string;
}

export interface VoiceItem {
    id: string;
    label: string;
}

export interface BrandConfig {
    industries: IndustryItem[];
    voices: VoiceItem[];
}

/**
 * GET /brand/config
 * Fetch industry & voice config lists for dropdowns.
 * No auth required.
 */
export async function getBrandConfig(): Promise<BrandConfig> {
    const res = await fetch(`${API_BASE_URL}/brand/config`);

    if (!res.ok) {
        throw new Error("Failed to fetch brand config");
    }

    return res.json();
}
