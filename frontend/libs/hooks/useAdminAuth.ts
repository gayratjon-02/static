// =============================================
// HOOKS — useAdminAuth
// =============================================
// Checks if admin is logged in by reading se_admin_token
// from localStorage. Returns auth state + logout helper.
// =============================================

import { useState, useEffect } from "react";

export interface AdminSession {
    token: string;
    admin: {
        _id: string;
        email: string;
        name: string;
        role: string;
    };
}

/**
 * useAdminAuth — checks admin login state
 * @returns { isLoading, isAuthenticated, session, logout }
 */
export function useAdminAuth() {
    const [isLoading, setIsLoading] = useState(true);
    const [session, setSession] = useState<AdminSession | null>(null);

    useEffect(() => {
        try {
            const token = localStorage.getItem("se_admin_token");
            const adminRaw = localStorage.getItem("se_admin_user");

            if (token && adminRaw) {
                const admin = JSON.parse(adminRaw);
                setSession({ token, admin });
            } else {
                setSession(null);
            }
        } catch {
            setSession(null);
        }
        setIsLoading(false);
    }, []);

    const logout = () => {
        localStorage.removeItem("se_admin_token");
        localStorage.removeItem("se_admin_user");
        setSession(null);
    };

    return {
        isLoading,
        isAuthenticated: !!session,
        session,
        logout,
    };
}
