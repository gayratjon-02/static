// =============================================
// GUARD — AdminGuard
// =============================================
// Wraps admin pages. If not authenticated, redirects to
// /_admin/login. Shows a loading screen while checking.
// =============================================

import React from "react";
import { useRouter } from "next/router";
import { useAdminAuth } from "../hooks/useAdminAuth";

interface AdminGuardProps {
    children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
    const router = useRouter();
    const { isLoading, isAuthenticated } = useAdminAuth();

    // Still checking localStorage
    if (isLoading) {
        return (
            <div
                style={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--bg)",
                    color: "var(--muted)",
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                }}
            >
                <div style={{ textAlign: "center" }}>
                    <div
                        style={{
                            width: 28,
                            height: 28,
                            border: "2px solid var(--border)",
                            borderTopColor: "var(--accent)",
                            borderRadius: "50%",
                            animation: "admin-spin 0.6s linear infinite",
                            margin: "0 auto 12px",
                        }}
                    />
                    Verifying admin access...
                </div>
            </div>
        );
    }

    // Not authenticated → redirect to login
    if (!isAuthenticated) {
        if (typeof window !== "undefined") {
            router.replace("/_admin/login");
        }
        return null;
    }

    // Authenticated → render children
    return <>{children}</>;
}
