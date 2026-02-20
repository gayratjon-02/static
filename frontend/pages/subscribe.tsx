import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import AuthGuard from "../libs/auth/AuthGuard";
import { createCheckoutRequest } from "../server/user/billing";

const PLANS = [
    {
        tier: "starter",
        label: "Starter",
        price: "$39",
        interval: "/mo",
        credits: "250 credits/mo",
        features: ["250 image generations", "Up to 3 brands", "Standard support"],
    },
    {
        tier: "pro",
        label: "Pro",
        price: "$99",
        interval: "/mo",
        credits: "750 credits/mo",
        features: ["750 image generations", "Up to 10 brands", "Priority support"],
        highlight: true,
    },
    {
        tier: "growth",
        label: "Growth",
        price: "$199",
        interval: "/mo",
        credits: "2,000 credits/mo",
        features: ["2,000 image generations", "Unlimited brands", "Dedicated support"],
    },
];

function SubscribePage() {
    const router = useRouter();
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState("");

    // Agar allaqachon aktiv obuna bo'lsa → dashboard
    useEffect(() => {
        try {
            const stored = localStorage.getItem("se_member");
            if (stored) {
                const member = JSON.parse(stored);
                const PAID_TIERS = ["starter", "pro", "growth"];
                if (
                    member?.subscription_status === "active" &&
                    PAID_TIERS.includes(member?.subscription_tier?.toLowerCase())
                ) {
                    router.replace("/dashboard");
                }
            }
        } catch { }
    }, [router]);

    const handleChoosePlan = async (tier: string) => {
        setLoading(tier);
        setError("");
        try {
            const { checkout_url } = await createCheckoutRequest(tier, "monthly");
            window.location.href = checkout_url;
        } catch (err: any) {
            setError(err.message || "Failed to start checkout. Please try again.");
            setLoading(null);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("se_access_token");
        localStorage.removeItem("se_member");
        router.replace("/login");
    };

    return (
        <div
            style={{
                minHeight: "100vh",
                background: "var(--bg)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "40px 20px",
                fontFamily: "var(--font-body)",
            }}
        >
            {/* Background orbs */}
            <div style={{ position: "fixed", inset: 0, overflow: "hidden", zIndex: 0, pointerEvents: "none" }}>
                <div style={{ position: "absolute", top: "-20%", right: "-10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(62,207,207,0.06) 0%, transparent 70%)" }} />
                <div style={{ position: "absolute", bottom: "-20%", left: "-10%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(120,80,255,0.05) 0%, transparent 70%)" }} />
            </div>

            <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 860 }}>
                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: 40 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}>
                        <span style={{ fontSize: 24 }}>⚡</span>
                        <span style={{ fontSize: 22, fontWeight: 800, background: "linear-gradient(90deg, #3ECFCF, #7850FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                            Static Engine
                        </span>
                    </div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", margin: "0 0 10px" }}>
                        Choose your plan to get started
                    </h1>
                    <p style={{ fontSize: 15, color: "var(--muted)", margin: 0 }}>
                        A subscription is required to access Static Engine. Pick a plan and start generating ads.
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <div style={{
                        background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
                        borderRadius: 10, padding: "12px 18px", marginBottom: 24,
                        color: "#EF4444", fontSize: 13, textAlign: "center",
                    }}>
                        ⚠️ {error}
                    </div>
                )}

                {/* Plans grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
                    {PLANS.map((plan) => (
                        <div
                            key={plan.tier}
                            style={{
                                background: plan.highlight
                                    ? "linear-gradient(135deg, rgba(62,207,207,0.1), rgba(120,80,255,0.08))"
                                    : "rgba(255,255,255,0.03)",
                                border: `1px solid ${plan.highlight ? "rgba(62,207,207,0.45)" : "rgba(255,255,255,0.08)"}`,
                                borderRadius: 16,
                                padding: 28,
                                position: "relative",
                            }}
                        >
                            {plan.highlight && (
                                <div style={{
                                    position: "absolute", top: -1, right: 20,
                                    background: "#3ECFCF", color: "#0a0a0f",
                                    fontSize: 10, fontWeight: 800, padding: "4px 12px",
                                    borderRadius: "0 0 10px 10px", letterSpacing: 0.5,
                                }}>
                                    MOST POPULAR
                                </div>
                            )}

                            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
                                {plan.label}
                            </div>
                            <div style={{ marginBottom: 4 }}>
                                <span style={{ fontSize: 32, fontWeight: 800, color: plan.highlight ? "#3ECFCF" : "var(--text)" }}>
                                    {plan.price}
                                </span>
                                <span style={{ fontSize: 14, color: "var(--muted)" }}>{plan.interval}</span>
                            </div>
                            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20 }}>{plan.credits}</div>

                            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 8 }}>
                                {plan.features.map((f) => (
                                    <li key={f} style={{ fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ color: "#22C55E", fontWeight: 700, fontSize: 14 }}>✓</span> {f}
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => handleChoosePlan(plan.tier)}
                                disabled={!!loading}
                                style={{
                                    width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
                                    fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
                                    background: plan.highlight ? "#3ECFCF" : "rgba(255,255,255,0.08)",
                                    color: plan.highlight ? "#0a0a0f" : "var(--text)",
                                    opacity: loading && loading !== plan.tier ? 0.5 : 1,
                                    transition: "opacity 0.15s",
                                }}
                            >
                                {loading === plan.tier ? "Redirecting..." : `Get ${plan.label}`}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Logout link */}
                <div style={{ textAlign: "center", marginTop: 32 }}>
                    <button
                        onClick={handleLogout}
                        style={{ background: "none", border: "none", color: "var(--dim)", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}
                    >
                        Sign out and use a different account
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Subscribe() {
    return (
        <AuthGuard>
            <SubscribePage />
        </AuthGuard>
    );
}
