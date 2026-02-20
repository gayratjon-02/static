import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import SubscriptionGuard from "../../libs/auth/SubscriptionGuard";
import { getMemberRequest, getUsageRequest, getBrandsRequest, getActivityRequest, updateMemberRequest, changePasswordRequest } from "../../server/user/login";
import { createCheckoutRequest, createPortalRequest, purchaseAddonRequest } from "../../server/user/billing";
import { getRecentGenerationsRequest, downloadAdImage } from "../../server/user/generation";
import { getBrands, deleteBrand } from "../../server/user/brand";
import { getBrandConfig, type IndustryItem } from "../../server/user/config";
import API_BASE_URL from "../../libs/config/api.config";
import type { Brand } from "../../libs/types/brand.type";
import type { Member } from "../../libs/types/member.type";
import { track, identifyUser, EVENTS } from "../../libs/analytics/analytics";

const ROUTES: Record<string, string> = {
    dashboard: "/dashboard",
    generate: "/generateAds",
    library: "/adLibrary",
};

const BG = ["#1a3a4a", "#2a1a3a", "#1a2a3a", "#3a2a1a", "#1a3a2a", "#2a3a1a"];

const DEFAULT_ADS: RecentAd[] = [];
const DEFAULT_ACTIVITY: ActivityItem[] = [];

const NAV_ITEMS = [
    { id: "dashboard", label: "Dashboard", letter: "D" },
    { id: "generate", label: "Generate Ads", letter: "+", badge: "NEW" },
    { id: "library", label: "Ad Library", letter: "L" },
    { id: "brands", label: "Brands", letter: "B" },
    { id: "canva", label: "Canva Templates", letter: "C" },
];

const BOTTOM_NAV = [
    { id: "account", label: "Account", letter: "A" },
    { id: "billing", label: "Billing", letter: "$" },
];

interface UsageData {
    subscription_tier: string;
    subscription_status: string;
    credits_used: number;
    credits_limit: number;
    addon_credits_remaining: number;
    billing_cycle_start: string | null;
    billing_cycle_end: string | null;
    stats: {
        ads_generated: number;
        ads_saved: number;
        canva_templates: number;
    };
}

interface BrandItem {
    _id: string;
    name: string;
}

// Industry labels are now fetched from backend via getBrandConfig()

/** Resolve relative /uploads/ paths to absolute backend URLs */
const resolveImageUrl = (url: string | null | undefined): string => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    if (url.startsWith("/uploads/")) return `${API_BASE_URL}${url}`;
    return url;
};

const BRAND_COLORS = ["#3ECFCF", "#22C55E", "#8B5CF6", "#F59E0B", "#EC4899", "#6366F1"];

const planInfo: Record<string, { label: string; monthlyPrice: number; yearlyMonthly: number; yearlyTotal: number; credits: string; features: string[]; highlight?: boolean }> = {
    starter: { label: "Starter", monthlyPrice: 39, yearlyMonthly: 33, yearlyTotal: 390, credits: "250 credits/mo", features: ["250 image generations", "3 brands", "Standard support"] },
    pro: { label: "Pro", monthlyPrice: 99, yearlyMonthly: 83, yearlyTotal: 990, credits: "750 credits/mo", features: ["750 image generations", "10 brands", "Priority support"], highlight: true },
    growth: { label: "Growth", monthlyPrice: 199, yearlyMonthly: 166, yearlyTotal: 1990, credits: "2,000 credits/mo", features: ["2,000 image generations", "Unlimited brands", "Dedicated support"] },
};

interface RecentAd {
    _id: string;
    ad_name: string;
    image_url: string;
    created_at: string;
    brand_name: string;
    concept_name?: string;
}

interface ActivityItem {
    _id: string;
    label: string;
    sub: string;
    icon: string;
    created_at: string;
    amount?: number;
}

function tierLabel(tier: string): string {
    const map: Record<string, string> = { free: "Free", starter: "Starter", pro: "Pro", growth: "Growth" };
    return map[tier?.toLowerCase()] || tier;
}

function daysUntil(dateStr: string | null): number {
    if (!dateStr) return 0;
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
}

function DashboardPage() {
    const router = useRouter();
    const [brandFilter, setBrandFilter] = useState("all");
    const [collapsed, setCollapsed] = useState(false);
    const [page, setPage] = useState("dashboard");
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [checkoutBanner, setCheckoutBanner] = useState<"success" | "cancelled" | null>(null);
    const [billingLoading, setBillingLoading] = useState<string | null>(null);
    const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");

    // API state
    const [member, setMember] = useState<Member | null>(null);
    const [usage, setUsage] = useState<UsageData | null>(null);
    const [brands, setBrands] = useState<BrandItem[]>([]);
    const [recentAds, setRecentAds] = useState<RecentAd[]>([]);
    const [activity, setActivity] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Brands page state
    const [fullBrands, setFullBrands] = useState<Brand[]>([]);
    const [brandsLoading, setBrandsLoading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [industryList, setIndustryList] = useState<IndustryItem[]>([]);

    // Account page state
    const [acctName, setAcctName] = useState("");
    const [acctSaving, setAcctSaving] = useState(false);
    const [acctMsg, setAcctMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
    const [pwOld, setPwOld] = useState("");
    const [pwNew, setPwNew] = useState("");
    const [pwConfirm, setPwConfirm] = useState("");
    const [pwSaving, setPwSaving] = useState(false);
    const [pwMsg, setPwMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

    /** Get label for industry ID from fetched config */
    const getIndustryLabel = (id: string) =>
        industryList.find((i) => i.id === id)?.label || id;

    useEffect(() => {
        async function fetchData() {
            try {
                // Try localStorage first for instant display
                const stored = localStorage.getItem("se_member");
                if (stored) setMember(JSON.parse(stored));

                // Fetch fresh data in parallel
                // Fetch fresh data in parallel
                const [memberData, usageData, brandsData, adsData, activityData] = await Promise.allSettled([
                    getMemberRequest(),
                    getUsageRequest(),
                    getBrandsRequest(),
                    getRecentGenerationsRequest(),
                    getActivityRequest(),
                ]);

                if (memberData.status === "fulfilled") {
                    const freshMember = memberData.value as Member;
                    setMember(freshMember);
                    localStorage.setItem("se_member", JSON.stringify(freshMember));

                    // Identify for analytics
                    identifyUser(freshMember._id || "", {
                        email: freshMember.email,
                        name: freshMember.full_name,
                        plan: freshMember.subscription_tier,
                    });

                    // Post-fetch subscription guard (catches stale localStorage)
                    const isCheckoutReturn = window.location.search.includes("checkout=success");
                    const paidTiers = ["starter", "pro", "growth"];
                    const hasActiveSub =
                        freshMember.subscription_status === "active" &&
                        paidTiers.includes(freshMember.subscription_tier?.toLowerCase());
                    if (!hasActiveSub && !isCheckoutReturn) {
                        router.replace("/subscribe");
                        return;
                    }
                }
                if (usageData.status === "fulfilled") setUsage(usageData.value as UsageData);
                if (brandsData.status === "fulfilled") {
                    const list = Array.isArray(brandsData.value) ? brandsData.value : (brandsData.value as any)?.list || [];
                    setBrands(list);
                }
                if (adsData.status === "fulfilled") setRecentAds(adsData.value);
                if (activityData.status === "fulfilled") setActivity(activityData.value);
            } catch (err) {
                console.error("Dashboard fetch error:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
        // Fetch brand config (industry labels)
        getBrandConfig()
            .then((cfg) => setIndustryList(cfg.industries))
            .catch(console.error);
    }, []);

    // Handle Stripe checkout success/cancel query params
    useEffect(() => {
        const { checkout } = router.query;
        if (checkout === "success") {
            setCheckoutBanner("success");
            // Remove query param from URL without reload
            router.replace("/dashboard", undefined, { shallow: true });
        } else if (checkout === "cancelled") {
            setCheckoutBanner("cancelled");
            router.replace("/dashboard", undefined, { shallow: true });
        }
    }, [router.query]);

    // When switching to Brands page — load full brand list
    useEffect(() => {
        if (page === "brands") {
            setBrandsLoading(true);
            getBrands(1, 100)
                .then((res) => setFullBrands(res.list))
                .catch(console.error)
                .finally(() => setBrandsLoading(false));
        }
    }, [page]);

    const handleDeleteBrand = async (id: string) => {
        if (!confirm("Do you want to delete this brand?")) return;
        setDeletingId(id);
        try {
            await deleteBrand(id);
            setFullBrands((prev) => prev.filter((b) => b._id !== id));
            setBrands((prev) => prev.filter((b) => b._id !== id));
        } catch (err) {
            console.error("Delete brand error:", err);
            alert("Failed to delete brand");
        } finally {
            setDeletingId(null);
        }
    };

    const handleUpgrade = async (tier: string, interval: "monthly" | "annual" = "monthly") => {
        setBillingLoading(`upgrade-${tier}`);
        try {
            track(EVENTS.CHECKOUT_STARTED, { plan: tier, billing_interval: interval, source: "dashboard" });
            const { checkout_url } = await createCheckoutRequest(tier, interval);
            window.location.href = checkout_url;
        } catch (err: any) {
            alert(err.message || "Failed to start checkout");
        } finally {
            setBillingLoading(null);
        }
    };

    const handlePortal = async () => {
        setBillingLoading("portal");
        try {
            track(EVENTS.PORTAL_OPENED, {});
            const { portal_url } = await createPortalRequest();
            window.location.href = portal_url;
        } catch (err: any) {
            alert(err.message || "Failed to open billing portal");
        } finally {
            setBillingLoading(null);
        }
    };

    const handleAddon = async (addon_key: string) => {
        setBillingLoading(`addon-${addon_key}`);
        try {
            track(EVENTS.ADDON_PURCHASED, { addon: addon_key });
            const { checkout_url } = await purchaseAddonRequest(addon_key);
            window.location.href = checkout_url;
        } catch (err: any) {
            alert(err.message || "Failed to start addon purchase");
        } finally {
            setBillingLoading(null);
        }
    };

    const handleNav = (id: string) => {
        if (ROUTES[id]) {
            router.push(ROUTES[id]);
        } else {
            setPage(id);
            // Reset account messages when navigating
            if (id === "account") {
                setAcctName(member?.full_name || "");
                setAcctMsg(null);
                setPwMsg(null);
                setPwOld(""); setPwNew(""); setPwConfirm("");
            }
        }
    };

    const handleLogout = () => {
        // Clear all auth data
        localStorage.removeItem("se_access_token");
        localStorage.removeItem("se_member");
        // Prevent back button from returning to protected page
        router.replace("/login");
    };

    // Derived values
    const userName = member?.full_name || "User";
    const userInitial = userName.charAt(0).toUpperCase();
    const tier = usage?.subscription_tier || "FREE";
    const remaining = usage ? usage.credits_limit - usage.credits_used : 0;
    const limit = usage?.credits_limit || 0;
    const pct = limit > 0 ? (remaining / limit) * 100 : 0;
    const renewDays = usage ? daysUntil(usage.billing_cycle_end) : 0;
    const filtered = brandFilter === "all" ? recentAds : recentAds.filter((a) => a.brand_name.toLowerCase().includes(brandFilter));
    const sw = collapsed ? 72 : 240;

    return (
        <div className="dashboard-layout">
            {/* ===== SIDEBAR ===== */}
            <div className="dash-sidebar" style={{ width: sw }}>
                {/* Logo */}
                <div
                    className="dash-sidebar__header"
                    style={{
                        padding: collapsed ? "20px 12px" : "20px",
                        justifyContent: collapsed ? "center" : "space-between",
                    }}
                >
                    {collapsed ? (
                        <div className="dash-sidebar__logo-icon" onClick={() => setCollapsed(false)}>
                            S
                        </div>
                    ) : (
                        <>
                            <span className="dash-sidebar__logo grad-text">Static Engine</span>
                            <div className="dash-sidebar__toggle" onClick={() => setCollapsed(true)}>
                                &laquo;
                            </div>
                        </>
                    )}
                </div>

                {/* Nav */}
                <div className="dash-sidebar__nav">
                    {NAV_ITEMS.map((item) => (
                        <div
                            key={item.id}
                            className={`nav-item ${page === item.id ? "nav-item--active" : ""}`}
                            onClick={() => handleNav(item.id)}
                            style={{
                                padding: collapsed ? "11px 0" : "11px 14px",
                                justifyContent: collapsed ? "center" : "flex-start",
                            }}
                        >
                            <div className={`nav-item__icon ${page === item.id ? "nav-item__icon--active" : "nav-item__icon--inactive"}`}>
                                {item.letter}
                            </div>
                            {!collapsed && (
                                <span
                                    className="nav-item__label"
                                    style={{
                                        fontWeight: page === item.id ? 600 : 400,
                                        color: page === item.id ? "var(--text)" : "var(--muted)",
                                    }}
                                >
                                    {item.label}
                                </span>
                            )}
                            {!collapsed && item.badge && <span className="nav-item__badge">{item.badge}</span>}
                        </div>
                    ))}

                    <div className="dash-sidebar__spacer" />

                    {/* Credits */}
                    {!collapsed && (
                        <div className="credits-card">
                            <div className="credits-card__header">
                                <span className="credits-card__label">Credits</span>
                                <span className="credits-card__plan">{tierLabel(tier)}</span>
                            </div>
                            <div className="credits-card__amount">
                                <span className="credits-card__value">{remaining}</span>
                                <span className="credits-card__limit">/ {limit}</span>
                            </div>
                            <div className="credits-card__bar">
                                <div className="credits-card__bar-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="credits-card__renew">Renews in {renewDays} days</div>
                        </div>
                    )}

                    {/* Bottom nav */}
                    {BOTTOM_NAV.map((item) => (
                        <div
                            key={item.id}
                            className="nav-item"
                            onClick={() => setPage(item.id)}
                            style={{
                                padding: collapsed ? "10px 0" : "10px 14px",
                                justifyContent: collapsed ? "center" : "flex-start",
                            }}
                        >
                            <span style={{ fontSize: 13, width: 28, textAlign: "center", color: "var(--dim)", fontWeight: 600 }}>
                                {item.letter}
                            </span>
                            {!collapsed && <span style={{ fontSize: 13, color: "var(--dim)" }}>{item.label}</span>}
                        </div>
                    ))}

                    {/* Logout */}
                    <div
                        className="nav-item"
                        onClick={handleLogout}
                        style={{
                            padding: collapsed ? "10px 0" : "10px 14px",
                            justifyContent: collapsed ? "center" : "flex-start",
                            cursor: "pointer",
                            marginTop: 4,
                        }}
                    >
                        <span style={{ fontSize: 13, width: 28, textAlign: "center", color: "#EF4444", fontWeight: 600 }}>
                            ⏻
                        </span>
                        {!collapsed && <span style={{ fontSize: 13, color: "#EF4444", fontWeight: 500 }}>Logout</span>}
                    </div>
                </div>

                {/* User */}
                <div
                    className="sidebar-user"
                    style={{
                        justifyContent: collapsed ? "center" : "flex-start",
                        padding: collapsed ? "16px 0" : "16px",
                    }}
                >
                    <div className="sidebar-user__avatar">{userInitial}</div>
                    {!collapsed && (
                        <div>
                            <div className="sidebar-user__name">{userName}</div>
                            <div className="sidebar-user__plan">{tierLabel(tier)} Plan</div>
                        </div>
                    )}
                </div>
            </div>

            {/* ===== MAIN CONTENT ===== */}
            <div className="dash-main" style={{ marginLeft: sw }}>

                {/* 80% Credit Usage Warning */}
                {usage && usage.credits_limit > 0 && (usage.credits_used / usage.credits_limit >= 0.8) && (
                    <div style={{
                        background: "rgba(245, 158, 11, 0.1)",
                        border: "1px solid rgba(245, 158, 11, 0.4)",
                        borderRadius: 12, padding: "14px 20px", margin: "16px 24px 0",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ fontSize: 22 }}>⚠️</span>
                            <div>
                                <div style={{ color: "#F59E0B", fontWeight: 700, fontSize: 14 }}>Credits Running Low</div>
                                <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
                                    You have used {Math.round((usage.credits_used / usage.credits_limit) * 100)}% of your monthly credits. Upgrade your plan to avoid interruption.
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setPage("billing")}
                            className="dash-btn dash-btn--primary"
                            style={{ padding: "6px 12px", fontSize: 12 }}>
                            Upgrade Plan
                        </button>
                    </div>
                )}

                {/* Checkout result banners */}
                {checkoutBanner === "success" && (
                    <div style={{
                        background: "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(62,207,207,0.1))",
                        border: "1px solid rgba(34,197,94,0.4)",
                        borderRadius: 12, padding: "14px 20px", margin: "16px 24px 0",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ fontSize: 22 }}>🎉</span>
                            <div>
                                <div style={{ color: "#22C55E", fontWeight: 700, fontSize: 14 }}>Subscription activated!</div>
                                <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
                                    Your plan is now active. Credits will be added shortly.
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setCheckoutBanner(null)}
                            style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 18 }}>
                            ×
                        </button>
                    </div>
                )}
                {checkoutBanner === "cancelled" && (
                    <div style={{
                        background: "rgba(239,68,68,0.08)",
                        border: "1px solid rgba(239,68,68,0.3)",
                        borderRadius: 12, padding: "14px 20px", margin: "16px 24px 0",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ fontSize: 22 }}>ℹ️</span>
                            <div>
                                <div style={{ color: "#EF4444", fontWeight: 700, fontSize: 14 }}>Checkout cancelled</div>
                                <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
                                    No charges were made. You can upgrade anytime from Billing.
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setCheckoutBanner(null)}
                            style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 18 }}>
                            ×
                        </button>
                    </div>
                )}

                {/* Header */}
                <div className="dash-header">
                    <div>
                        <div className="dash-header__date">
                            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                        </div>
                        <div className="dash-header__title">
                            {page === "brands" ? "My Brands" : page === "billing" ? "Billing & Subscription" : page === "account" ? "Account Settings" : `Welcome back, ${userName.split(" ")[0]}`}
                        </div>
                    </div>
                    {page === "brands" ? (
                        <button className="btn-generate" onClick={() => router.push("/generateAds")}>
                            + Create New Brand
                        </button>
                    ) : page === "billing" || page === "account" ? null : (
                        <button className="btn-generate" onClick={() => router.push("/generateAds")}>+ Generate New Ad</button>
                    )}
                </div>

                {/* ===== BRANDS PAGE ===== */}
                {page === "brands" && (
                    <div className="brands-page">
                        {/* Stats Row */}
                        <div className="brands-page__stats">
                            <div className="brands-stat">
                                <span className="brands-stat__value" style={{ color: "var(--accent)" }}>{fullBrands.length}</span>
                                <span className="brands-stat__label">Total Brands</span>
                            </div>
                            <div className="brands-stat">
                                <span className="brands-stat__value" style={{ color: "var(--green)" }}>{usage?.stats?.ads_generated || 0}</span>
                                <span className="brands-stat__label">Ads Generated</span>
                            </div>
                            <div className="brands-stat">
                                <span className="brands-stat__value" style={{ color: "var(--g1)" }}>
                                    {[...new Set(fullBrands.map(b => b.industry))].length}
                                </span>
                                <span className="brands-stat__label">Industries</span>
                            </div>
                        </div>

                        {/* Brands Grid */}
                        {brandsLoading ? (
                            <div className="brands-page__loading">
                                <div className="brands-page__spinner" />
                                <span>Loading brands...</span>
                            </div>
                        ) : fullBrands.length === 0 ? (
                            <div className="brands-page__empty">
                                <div className="brands-page__empty-icon">B</div>
                                <h3>No brands yet</h3>
                                <p>Create your first brand to start generating ads</p>
                                <button className="btn-generate" onClick={() => router.push("/generateAds")}>
                                    + Create First Brand
                                </button>
                            </div>
                        ) : (
                            <div className="brands-grid">
                                {fullBrands.map((brand, i) => (
                                    <div key={brand._id} className="brand-card">
                                        {/* Card Header with gradient */}
                                        <div
                                            className="brand-card__header"
                                            style={{
                                                background: `linear-gradient(135deg, ${brand.primary_color || BRAND_COLORS[i % 6]}cc, ${brand.secondary_color || BRAND_COLORS[(i + 2) % 6]}88)`,
                                            }}
                                        >
                                            <div className="brand-card__logo">
                                                {brand.logo_url ? (
                                                    <img src={resolveImageUrl(brand.logo_url)} alt={brand.name} />
                                                ) : (
                                                    <span>{brand.name.charAt(0).toUpperCase()}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Card Body */}
                                        <div className="brand-card__body">
                                            <h3 className="brand-card__name">{brand.name}</h3>
                                            <span className="brand-card__industry">
                                                {getIndustryLabel(brand.industry)}
                                            </span>
                                            {brand.description && (
                                                <p className="brand-card__desc">
                                                    {brand.description.length > 80
                                                        ? brand.description.slice(0, 80) + "..."
                                                        : brand.description}
                                                </p>
                                            )}

                                            {/* Colors */}
                                            <div className="brand-card__colors">
                                                {[brand.primary_color, brand.secondary_color, brand.accent_color, brand.background_color]
                                                    .filter(Boolean)
                                                    .map((color, ci) => (
                                                        <div
                                                            key={ci}
                                                            className="brand-card__color-dot"
                                                            style={{ backgroundColor: color }}
                                                            title={color}
                                                        />
                                                    ))}
                                            </div>

                                            {/* Voice tags */}
                                            {brand.voice_tags && brand.voice_tags.length > 0 && (
                                                <div className="brand-card__tags">
                                                    {brand.voice_tags.slice(0, 3).map((tag) => (
                                                        <span key={tag} className="brand-card__tag">{tag}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Card Footer */}
                                        <div className="brand-card__footer">
                                            <span className="brand-card__date">
                                                {new Date(brand.created_at).toLocaleDateString()}
                                            </span>
                                            <div className="brand-card__actions">
                                                <button
                                                    className="brand-card__btn"
                                                    style={{ marginRight: 8, background: "rgba(255,255,255,0.1)", border: "1px solid #30363d", fontSize: 13 }}
                                                    onClick={() => router.push(`/brands/${brand._id}/edit`)}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className="brand-card__btn brand-card__btn--delete"
                                                    onClick={() => handleDeleteBrand(brand._id)}
                                                    disabled={deletingId === brand._id}
                                                >
                                                    {deletingId === brand._id ? "..." : "✕"}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ===== ACCOUNT PAGE ===== */}
                {page === "account" && (
                    <div style={{ padding: "0 24px 40px" }}>
                        {/* Profile header card */}
                        <div style={{
                            background: "var(--card)", border: "1px solid var(--border)",
                            borderRadius: 16, padding: 28, marginBottom: 20,
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 28 }}>
                                <div style={{
                                    width: 64, height: 64, borderRadius: "50%",
                                    background: "linear-gradient(135deg, var(--accent), var(--g1))",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 26, fontWeight: 800, color: "#0a0a0f", flexShrink: 0,
                                }}>
                                    {userName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{userName}</div>
                                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{member?.email}</div>
                                    <div style={{
                                        display: "inline-block", marginTop: 6,
                                        fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                                        background: "rgba(62,207,207,0.15)", color: "var(--accent)",
                                    }}>{tierLabel(usage?.subscription_tier || "free")} Plan</div>
                                </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
                                {[
                                    { label: "Ads Generated", val: usage?.stats?.ads_generated || 0, color: "var(--g1)" },
                                    { label: "Credits Left", val: usage ? usage.credits_limit - usage.credits_used : 0, color: "var(--accent)" },
                                    { label: "Brands Created", val: brands.length, color: "#8B5CF6" },
                                ].map((s) => (
                                    <div key={s.label} style={{ textAlign: "center", padding: "12px 0", background: "rgba(255,255,255,0.03)", borderRadius: 10 }}>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
                                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{s.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Two-column: Edit Profile + Change Password */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                            {/* Edit Profile */}
                            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 20 }}>Edit Profile</div>
                                <div style={{ marginBottom: 14 }}>
                                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Full Name</div>
                                    <input
                                        value={acctName !== "" ? acctName : userName}
                                        onChange={(e) => setAcctName(e.target.value)}
                                        style={{
                                            width: "100%", padding: "10px 14px", borderRadius: 10,
                                            background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)",
                                            color: "var(--text)", fontSize: 14, outline: "none", boxSizing: "border-box",
                                        }}
                                    />
                                </div>
                                <div style={{ marginBottom: 20 }}>
                                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Email <span style={{ opacity: 0.5 }}>(cannot be changed)</span></div>
                                    <input
                                        value={member?.email || ""}
                                        disabled
                                        style={{
                                            width: "100%", padding: "10px 14px", borderRadius: 10,
                                            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                                            color: "var(--dim)", fontSize: 14, outline: "none", boxSizing: "border-box",
                                        }}
                                    />
                                </div>
                                {acctMsg && (
                                    <div style={{
                                        padding: "8px 14px", borderRadius: 8, marginBottom: 14, fontSize: 13,
                                        background: acctMsg.type === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                                        color: acctMsg.type === "ok" ? "#22C55E" : "#EF4444",
                                        border: `1px solid ${acctMsg.type === "ok" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                                    }}>{acctMsg.text}</div>
                                )}
                                <button
                                    onClick={async () => {
                                        setAcctSaving(true); setAcctMsg(null);
                                        try {
                                            const updated = await updateMemberRequest({ full_name: acctName || userName });
                                            const newName = updated?.full_name || acctName;
                                            setMember((prev) => prev ? { ...prev, full_name: newName } : prev);
                                            localStorage.setItem("se_member", JSON.stringify({ ...(member || {}), full_name: newName }));
                                            setAcctMsg({ type: "ok", text: "Profile updated successfully!" });
                                        } catch (e: any) {
                                            setAcctMsg({ type: "err", text: e.message || "Update failed" });
                                        } finally { setAcctSaving(false); }
                                    }}
                                    disabled={acctSaving}
                                    style={{
                                        width: "100%", padding: "10px 0", borderRadius: 10, border: "none",
                                        background: "linear-gradient(135deg, var(--accent), var(--g1))",
                                        color: "#0a0a0f", fontWeight: 700, fontSize: 13, cursor: "pointer",
                                        opacity: acctSaving ? 0.6 : 1,
                                    }}
                                >{acctSaving ? "Saving..." : "Save Changes"}</button>
                            </div>

                            {/* Change Password */}
                            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 20 }}>Change Password</div>
                                {(["Current Password", "New Password", "Confirm New Password"] as const).map((label, idx) => (
                                    <div key={label} style={{ marginBottom: idx < 2 ? 14 : 20 }}>
                                        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>{label}</div>
                                        <input
                                            type="password"
                                            value={idx === 0 ? pwOld : idx === 1 ? pwNew : pwConfirm}
                                            onChange={(e) => idx === 0 ? setPwOld(e.target.value) : idx === 1 ? setPwNew(e.target.value) : setPwConfirm(e.target.value)}
                                            placeholder={idx === 0 ? "Current password" : idx === 1 ? "Min 6 characters" : "Repeat new password"}
                                            style={{
                                                width: "100%", padding: "10px 14px", borderRadius: 10,
                                                background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)",
                                                color: "var(--text)", fontSize: 14, outline: "none", boxSizing: "border-box",
                                            }}
                                        />
                                    </div>
                                ))}
                                {pwMsg && (
                                    <div style={{
                                        padding: "8px 14px", borderRadius: 8, marginBottom: 14, fontSize: 13,
                                        background: pwMsg.type === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                                        color: pwMsg.type === "ok" ? "#22C55E" : "#EF4444",
                                        border: `1px solid ${pwMsg.type === "ok" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                                    }}>{pwMsg.text}</div>
                                )}
                                <button
                                    onClick={async () => {
                                        if (pwNew !== pwConfirm) { setPwMsg({ type: "err", text: "Passwords do not match" }); return; }
                                        if (pwNew.length < 6) { setPwMsg({ type: "err", text: "Password must be at least 6 characters" }); return; }
                                        setPwSaving(true); setPwMsg(null);
                                        try {
                                            await changePasswordRequest({ old_password: pwOld, new_password: pwNew });
                                            setPwMsg({ type: "ok", text: "Password changed successfully!" });
                                            setPwOld(""); setPwNew(""); setPwConfirm("");
                                        } catch (e: any) {
                                            setPwMsg({ type: "err", text: e.message || "Failed to change password" });
                                        } finally { setPwSaving(false); }
                                    }}
                                    disabled={pwSaving || !pwOld || !pwNew || !pwConfirm}
                                    style={{
                                        width: "100%", padding: "10px 0", borderRadius: 10, border: "none",
                                        background: "rgba(255,255,255,0.08)", color: "var(--text)",
                                        fontWeight: 700, fontSize: 13, cursor: "pointer",
                                        opacity: (pwSaving || !pwOld || !pwNew || !pwConfirm) ? 0.5 : 1,
                                    }}
                                >{pwSaving ? "Changing..." : "Change Password"}</button>
                            </div>
                        </div>

                        {/* Danger Zone */}
                        <div style={{
                            background: "rgba(239,68,68,0.05)",
                            border: "1px solid rgba(239,68,68,0.2)", borderRadius: 16, padding: 24,
                        }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "#EF4444", marginBottom: 8 }}>Danger Zone</div>
                            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
                                Deleting your account will permanently remove all your data, brands, and generated ads. This action cannot be undone.
                            </div>
                            <button
                                onClick={() => {
                                    if (confirm("Are you sure you want to delete your account? This cannot be undone.")) {
                                        alert("Please contact support to delete your account.");
                                    }
                                }}
                                style={{
                                    padding: "10px 24px", borderRadius: 10,
                                    border: "1px solid rgba(239,68,68,0.4)", background: "transparent",
                                    color: "#EF4444", fontWeight: 700, fontSize: 13, cursor: "pointer",
                                }}
                            >Delete Account</button>
                        </div>
                    </div>
                )}

                {/* ===== BILLING PAGE ===== */}
                {page === "billing" && (
                    <div style={{ padding: "0 24px 40px" }}>
                        {/* Current plan card */}
                        <div style={{
                            background: "var(--card)",
                            border: "1px solid var(--border)",
                            borderRadius: 16, padding: 28, marginBottom: 24,
                        }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                                <div>
                                    <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                                        Current Plan
                                    </div>
                                    <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text)" }}>
                                        {tierLabel(usage?.subscription_tier || "free")}
                                    </div>
                                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{
                                            fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                                            background: usage?.subscription_status === "active" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.12)",
                                            color: usage?.subscription_status === "active" ? "#22C55E" : "#EF4444",
                                        }}>
                                            {usage?.subscription_status?.toUpperCase() || "INACTIVE"}
                                        </span>
                                        {usage?.billing_cycle_end && (
                                            <span style={{ fontSize: 12, color: "var(--muted)" }}>
                                                Renews {new Date(usage.billing_cycle_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: 10 }}>
                                    {usage?.subscription_status === "active" && (
                                        <button
                                            onClick={handlePortal}
                                            disabled={billingLoading === "portal"}
                                            style={{
                                                padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border)",
                                                background: "transparent", color: "var(--text)", fontSize: 13,
                                                fontWeight: 600, cursor: "pointer", opacity: billingLoading === "portal" ? 0.6 : 1,
                                            }}
                                        >
                                            {billingLoading === "portal" ? "Loading..." : "Manage Subscription"}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Credits usage */}
                            <div style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                    <span style={{ fontSize: 13, color: "var(--muted)" }}>Credits used</span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                                        {usage?.credits_used || 0} / {usage?.credits_limit || 0}
                                    </span>
                                </div>
                                <div style={{ height: 8, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                                    <div style={{
                                        height: "100%", borderRadius: 99,
                                        background: "linear-gradient(90deg, var(--accent), var(--g1))",
                                        width: `${usage && usage.credits_limit > 0 ? Math.min(100, (usage.credits_used / usage.credits_limit) * 100) : 0}%`,
                                        transition: "width 0.4s",
                                    }} />
                                </div>
                                {(usage?.addon_credits_remaining || 0) > 0 && (
                                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
                                        + {usage?.addon_credits_remaining} addon credits remaining
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Upgrade plans */}
                        {usage?.subscription_tier === "free" || !usage?.subscription_status || usage?.subscription_status !== "active" ? (
                            <>
                                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>
                                    Upgrade your plan
                                </div>

                                {/* Monthly / Yearly Toggle */}
                                <div style={{ display: "flex", marginBottom: 24 }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        <div
                                            style={{
                                                position: "relative",
                                                display: "flex",
                                                background: "var(--card)",
                                                border: "1px solid var(--border)",
                                                borderRadius: 30,
                                                padding: 4,
                                                cursor: "pointer",
                                                width: 200,
                                            }}
                                        >
                                            <div style={{
                                                position: "absolute",
                                                top: 4,
                                                left: billingInterval === "monthly" ? 4 : "calc(50% + 2px)",
                                                width: "calc(50% - 6px)",
                                                height: "calc(100% - 8px)",
                                                background: "rgba(62,207,207,0.15)",
                                                border: "1px solid rgba(62,207,207,0.3)",
                                                borderRadius: 24,
                                                transition: "left 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                                                pointerEvents: "none",
                                            }} />
                                            <button
                                                type="button"
                                                onClick={() => setBillingInterval("monthly")}
                                                style={{
                                                    flex: 1, padding: "6px 12px", border: "none", background: "transparent",
                                                    fontSize: 13, fontWeight: 600, color: billingInterval === "monthly" ? "#3ECFCF" : "var(--muted)",
                                                    cursor: "pointer", zIndex: 1, borderRadius: 24, transition: "color 0.2s"
                                                }}
                                            >
                                                Monthly
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setBillingInterval("annual")}
                                                style={{
                                                    flex: 1, padding: "6px 12px", border: "none", background: "transparent",
                                                    fontSize: 13, fontWeight: 600, color: billingInterval === "annual" ? "#3ECFCF" : "var(--muted)",
                                                    cursor: "pointer", zIndex: 1, borderRadius: 24, transition: "color 0.2s"
                                                }}
                                            >
                                                Yearly
                                            </button>
                                        </div>
                                        {billingInterval === "annual" && (
                                            <div style={{
                                                background: "rgba(62,207,207,0.1)",
                                                border: "1px solid rgba(62,207,207,0.25)", borderRadius: 16, padding: "4px 10px",
                                                fontSize: 11, fontWeight: 700, color: "#3ECFCF", alignSelf: "flex-start"
                                            }}>
                                                🎉 2 months free — save up to $478/yr
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 32 }}>
                                    {(Object.entries(planInfo) as [string, typeof planInfo[string]][]).map(([tier, plan]) => (
                                        <div key={tier} style={{
                                            background: plan.highlight ? "linear-gradient(135deg, rgba(62,207,207,0.1), rgba(120,80,255,0.08))" : "var(--card)",
                                            border: `1px solid ${plan.highlight ? "rgba(62,207,207,0.4)" : "var(--border)"}`,
                                            borderRadius: 14, padding: 24,
                                            position: "relative",
                                        }}>
                                            {plan.highlight && (
                                                <div style={{
                                                    position: "absolute", top: -1, right: 16,
                                                    background: "var(--accent)", color: "#0a0a0f",
                                                    fontSize: 10, fontWeight: 800, padding: "4px 10px",
                                                    borderRadius: "0 0 8px 8px", letterSpacing: 0.5,
                                                }}>
                                                    POPULAR
                                                </div>
                                            )}
                                            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{plan.label}</div>
                                            <div style={{ marginTop: 4 }}>
                                                <span style={{ fontSize: 28, fontWeight: 800, color: plan.highlight ? "var(--accent)" : "var(--text)" }}>
                                                    ${billingInterval === "annual" ? plan.yearlyMonthly : plan.monthlyPrice}
                                                </span>
                                                <span style={{ fontSize: 13, color: "var(--muted)" }}>/mo</span>
                                            </div>
                                            {billingInterval === "annual" && (
                                                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                                                    ${plan.yearlyTotal} billed yearly
                                                </div>
                                            )}
                                            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, marginBottom: 16 }}>{plan.credits}</div>

                                            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
                                                {plan.features.map(f => (
                                                    <div key={f} style={{ fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8 }}>
                                                        <span style={{ color: "#22C55E", fontWeight: 700 }}>✓</span> {f}
                                                    </div>
                                                ))}
                                            </div>

                                            <button
                                                onClick={() => handleUpgrade(tier, billingInterval)}
                                                disabled={billingLoading === tier}
                                                style={{
                                                    width: "100%", padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer",
                                                    background: plan.highlight ? "var(--accent)" : "var(--border)",
                                                    color: plan.highlight ? "#0a0a0f" : "var(--text)", fontSize: 13, fontWeight: 600,
                                                    opacity: billingLoading === tier ? 0.6 : 1, transition: "background 0.2s"
                                                }}
                                            >
                                                {billingLoading === tier ? "Loading..." : "Subscribe"}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : null}

                        {/* Addon credits */}
                        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>
                            Buy Extra Credits
                        </div>
                        <div style={{
                            background: "var(--card)", border: "1px solid var(--border)",
                            borderRadius: 14, padding: 24,
                            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16,
                        }}>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>100 Credits Pack</div>
                                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                                    One-time purchase · $19 · Never expires
                                </div>
                            </div>
                            <button
                                onClick={() => handleAddon("credits_100")}
                                disabled={!!billingLoading}
                                style={{
                                    padding: "10px 24px", borderRadius: 10, border: "1px solid var(--accent)",
                                    background: "transparent", color: "var(--accent)", fontWeight: 700,
                                    fontSize: 13, cursor: "pointer",
                                    opacity: billingLoading === "addon-credits_100" ? 0.6 : 1,
                                }}
                            >
                                {billingLoading === "addon-credits_100" ? "Redirecting..." : "Buy Credits"}
                            </button>
                        </div>
                    </div>
                )}

                {/* ===== DASHBOARD PAGE ===== */}
                {page === "dashboard" && (
                    <>
                        {/* Stats */}
                        <div className="stats-grid">
                            {[
                                { label: "CREDITS LEFT", val: String(remaining), sub: `of ${limit}`, color: "var(--accent)", bar: pct },
                                { label: "ADS GENERATED", val: String(usage?.stats?.ads_generated || 0), sub: "lifetime", color: "var(--g1)", trend: null },
                                { label: "ADS SAVED", val: String(usage?.stats?.ads_saved || 0), sub: "across brands", color: "var(--green)", trend: null },
                                { label: "CANVA TEMPLATES", val: String(usage?.stats?.canva_templates || 0), sub: "ready to use", color: "var(--yellow)", trend: null },
                            ].map((s: any, i) => (
                                <div key={i} className="stat-card">
                                    <div className="stat-card__label">{s.label}</div>
                                    <div className="stat-card__row">
                                        <span className="stat-card__value" style={{ color: s.color }}>{s.val}</span>
                                        <span className="stat-card__sub">{s.sub}</span>
                                    </div>
                                    {s.bar != null && (
                                        <div className="stat-card__bar">
                                            <div className="stat-card__bar-fill" style={{ width: `${s.bar}%` }} />
                                        </div>
                                    )}
                                    {s.trend && <div className="stat-card__trend">{s.trend}</div>}
                                </div>
                            ))}
                        </div>

                        {/* Grid: Ads + Sidebar */}
                        <div className="dash-grid">
                            {/* Recent Ads */}
                            <div className="recent-ads">
                                <div className="recent-ads__header">
                                    <span className="recent-ads__title">Recent Ads</span>
                                    <div className="recent-ads__filters">
                                        {[
                                            { id: "all", label: "All", color: "var(--accent)" },
                                            ...brands.map((b, i) => ({
                                                id: b.name.toLowerCase(),
                                                label: b.name,
                                                color: ["#3ECFCF", "#22C55E", "#F59E0B", "#8B5CF6", "#EC4899"][i % 5],
                                            })),
                                        ].map((b) => (
                                            <button
                                                key={b.id}
                                                className={`brand-filter-btn ${brandFilter === b.id ? "brand-filter-btn--active" : ""}`}
                                                onClick={() => setBrandFilter(b.id)}
                                                style={{
                                                    background: brandFilter === b.id ? `${b.color}22` : undefined,
                                                    color: brandFilter === b.id ? b.color : undefined,
                                                }}
                                            >
                                                {b.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="ads-grid">
                                    {recentAds.length > 0 ? (
                                        recentAds
                                            .filter(ad => brandFilter === "all" || ad.brand_name.toLowerCase() === brandFilter)
                                            .slice(0, 6)
                                            .map((ad, i) => (
                                                <div key={ad._id} className="ad-card">
                                                    <div
                                                        className="ad-card__image"
                                                        style={{
                                                            background: ad.image_url ? `url(${ad.image_url}) center/cover` : `linear-gradient(135deg, ${BG[i % 6]}dd, ${BG[(i + 3) % 6]}aa)`,
                                                        }}
                                                    >
                                                        {!ad.image_url && <span className="ad-card__placeholder">AD</span>}
                                                        <div className="ad-card__overlay">
                                                            <button className="btn-view-ad" onClick={() => ad.image_url && setLightboxImage(ad.image_url)}>View</button>
                                                            <button className="btn-dl" onClick={async () => {
                                                                if (!ad._id) return;
                                                                try {
                                                                    await downloadAdImage(ad._id, `${ad.ad_name || "ad"}_1x1.png`);
                                                                } catch {
                                                                    if (ad.image_url) window.open(ad.image_url, "_blank");
                                                                }
                                                            }}>DL</button>
                                                        </div>
                                                    </div>
                                                    <div className="ad-card__info">
                                                        <div className="ad-card__name">{ad.ad_name}</div>
                                                        <div className="ad-card__meta">
                                                            <span className="ad-card__date">{timeAgo(ad.created_at)}</span>
                                                            <span
                                                                className="ad-card__brand"
                                                                style={{
                                                                    background: "#3ECFCF18",
                                                                    color: "#3ECFCF",
                                                                }}
                                                            >
                                                                {ad.brand_name}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                    ) : (
                                        <div style={{ color: "var(--muted)", fontStyle: "italic", padding: 20 }}>No ads generated yet.</div>
                                    )}
                                </div>

                                <div className="view-all-link" onClick={() => router.push("/adLibrary")} style={{ cursor: "pointer" }}>View all ads in library</div>
                            </div>

                            {/* Right sidebar */}
                            <div className="dash-right">
                                {/* Quick Actions */}
                                <div className="quick-actions">
                                    <div className="quick-actions__title">Quick Actions</div>
                                    {[
                                        { label: "Generate New Ad", desc: `${remaining} credits remaining`, letter: "+", primary: true, route: "/generateAds" },
                                        { label: "Create New Brand", desc: `${brands.length} brand${brands.length !== 1 ? "s" : ""} created`, letter: "B", primary: false, route: "/generateAds" },
                                        { label: "View Ad Library", desc: `${usage?.stats?.ads_generated || 0} ads generated`, letter: "L", primary: false, route: "/adLibrary" },
                                    ].map((a, i) => (
                                        <div
                                            key={i}
                                            className={`action-item ${a.primary ? "action-item--primary" : ""}`}
                                            style={{ marginBottom: i < 2 ? 6 : 0, cursor: "pointer" }}
                                            onClick={() => router.push(a.route)}
                                        >
                                            <div className={`action-item__icon ${a.primary ? "action-item__icon--primary" : "action-item__icon--default"}`}>
                                                {a.letter}
                                            </div>
                                            <div>
                                                <div className="action-item__label" style={{ color: a.primary ? "var(--text)" : "var(--muted)" }}>
                                                    {a.label}
                                                </div>
                                                <div className="action-item__desc">{a.desc}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Activity */}
                                <div className="activity-card">
                                    <div className="activity-card__title">Recent Activity</div>
                                    {activity.length > 0 ? (
                                        activity.map((item, i) => (
                                            <div key={item._id} className="activity-item">
                                                <div className="activity-item__icon">{item.icon}</div>
                                                <div className="activity-item__body">
                                                    <div className="activity-item__action">{item.label}</div>
                                                    <div className="activity-item__detail">{item.sub}</div>
                                                </div>
                                                <span className="activity-item__time">{timeAgo(item.created_at)}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{ padding: 16, color: "var(--muted)", fontSize: 13 }}>No recent activity.</div>
                                    )}
                                </div>

                                {/* Tip */}
                                <div className="tip-card">
                                    <div className="tip-card__label">Tip of the day</div>
                                    <div className="tip-card__title">Try &quot;Feature Pointers&quot; for supplements</div>
                                    <div className="tip-card__desc">
                                        Brands in your space see 2.3x higher CTR with feature pointer ads that highlight specific product benefits.
                                    </div>
                                    <button className="tip-card__btn">Try this concept</button>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Lightbox */}
                {lightboxImage && (
                    <div
                        style={{
                            position: "fixed", inset: 0, zIndex: 9999,
                            background: "rgba(0,0,0,0.85)", display: "flex",
                            alignItems: "center", justifyContent: "center", cursor: "zoom-out",
                        }}
                        onClick={() => setLightboxImage(null)}
                    >
                        <img
                            src={lightboxImage}
                            alt="Ad preview"
                            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 12, objectFit: "contain" }}
                            onClick={(e) => e.stopPropagation()}
                        />
                        <button
                            onClick={() => setLightboxImage(null)}
                            style={{
                                position: "absolute", top: 24, right: 24,
                                background: "rgba(255,255,255,0.15)", border: "none",
                                color: "#fff", fontSize: 24, width: 44, height: 44,
                                borderRadius: "50%", cursor: "pointer", display: "flex",
                                alignItems: "center", justifyContent: "center",
                            }}
                        >
                            X
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function Dashboard() {
    return (
        <SubscriptionGuard>
            <DashboardPage />
        </SubscriptionGuard>
    );
}
