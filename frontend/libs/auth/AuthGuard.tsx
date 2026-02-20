// =============================================
// GUARD — AuthGuard (User)
// =============================================
// Wraps user pages. If not authenticated, redirects to
// /login. Shows a loading screen while checking.
// =============================================

import React from "react";
import { useRouter } from "next/router";
import { useAuth } from "../hooks/useAuth";

interface AuthGuardProps {
    children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
    const router = useRouter();
    const { isAuthenticated } = useAuth();

    // Still checking localStorage
    if (isAuthenticated === null) {
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
                    Loading...
                </div>
            </div>
        );
    }

    // Not authenticated → redirect to login
    if (!isAuthenticated) {
        if (typeof window !== "undefined") {
            router.replace("/login");
        }
        return null;
    }

    // Authenticated → render children
    return <>{children}</>;
}
