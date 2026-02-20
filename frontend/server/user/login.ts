// =============================================
// SERVER — User Auth API (login + signup)
// =============================================

import API_BASE_URL from "../../libs/config/api.config";
import type { AuthResponse, LoginInput, SignupInput } from "../../libs/types/member.type";

const MEMBER_API = `${API_BASE_URL}/member`;

/**
 * POST /member/login
 * Authenticate an existing user with email + password.
 */
export async function loginRequest(input: LoginInput): Promise<AuthResponse> {
    const res = await fetch(`${MEMBER_API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Login failed" }));
        throw new Error(error.message || `Login failed (${res.status})`);
    }

    return res.json();
}

/**
 * POST /member/signup
 * Register a new user account.
 */
export async function signupRequest(input: SignupInput): Promise<AuthResponse> {
    const res = await fetch(`${MEMBER_API}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Signup failed" }));
        throw new Error(error.message || `Signup failed (${res.status})`);
    }

    return res.json();
}

/**
 * GET /member/getMember
 * Fetch the authenticated user's profile using the stored access token.
 */
export async function getMemberRequest(): Promise<AuthResponse["member"]> {
    const token = localStorage.getItem("se_access_token");

    const res = await fetch(`${MEMBER_API}/getMember`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        throw new Error("Failed to fetch member");
    }

    return res.json();
}

/**
 * GET /member/getUsage
 * Fetch the authenticated user's credit & subscription usage.
 */
export async function getUsageRequest() {
    const token = localStorage.getItem("se_access_token");

    const res = await fetch(`${MEMBER_API}/getUsage`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        throw new Error("Failed to fetch usage");
    }

    return res.json();
}

const BRAND_API = `${API_BASE_URL}/brand`;

/**
 * GET /brand/getBrands
 * Fetch the authenticated user's brands.
 */
export async function getBrandsRequest(page = 1, limit = 50) {
    const token = localStorage.getItem("se_access_token");

    const res = await fetch(`${BRAND_API}/getBrands?page=${page}&limit=${limit}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        throw new Error("Failed to fetch brands");
    }

    return res.json();
}

/**
 * GET /member/getActivity
 * Fetch the authenticated user's recent activity.
 */
export async function getActivityRequest(limit = 5): Promise<any[]> {
    const token = localStorage.getItem("se_access_token");

    const res = await fetch(`${MEMBER_API}/getActivity?limit=${limit}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        throw new Error("Failed to fetch activity");
    }

    return res.json();
}

/**
 * POST /member/updateMember
 * Update the authenticated user's profile.
 */
export async function updateMemberRequest(input: { full_name?: string }): Promise<any> {
    const token = localStorage.getItem("se_access_token");
    const res = await fetch(`${MEMBER_API}/updateMember`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(input),
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Update failed" }));
        throw new Error(error.message || `Update failed (${res.status})`);
    }
    return res.json();
}

/**
 * POST /member/forgetPassword
 * Change the authenticated user's password.
 */
export async function changePasswordRequest(input: { old_password: string; new_password: string }): Promise<any> {
    const token = localStorage.getItem("se_access_token");
    const res = await fetch(`${MEMBER_API}/forgetPassword`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(input),
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Password change failed" }));
        throw new Error(error.message || `Password change failed (${res.status})`);
    }
    return res.json();
}
