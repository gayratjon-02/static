import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAdminAuth } from "../../libs/hooks/useAdminAuth";

/**
 * /_admin/ entry point
 * - Authenticated → redirect to /_admin/homepage
 * - Not authenticated → redirect to /_admin/login
 */
export default function AdminIndex() {
    const router = useRouter();
    const { isLoading, isAuthenticated } = useAdminAuth();

    useEffect(() => {
        if (isLoading) return;
        if (isAuthenticated) {
            router.replace("/_admin/homepage");
        } else {
            router.replace("/_admin/login");
        }
    }, [isLoading, isAuthenticated, router]);

    // Loading screen while checking auth
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
                Redirecting...
            </div>
        </div>
    );
}
