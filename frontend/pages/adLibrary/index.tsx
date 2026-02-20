import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import AuthGuard from "../../libs/auth/AuthGuard";
import {
    getLibraryAdsRequest,
    getLibraryCountsRequest,
    downloadAdImage,
    downloadAdImageByRatio,
    toggleFavoriteRequest,
    renameAdRequest,
    deleteAdsRequest,
    fixErrorRequest,
    getSingleAdRequest,
} from "../../server/user/generation";
import type { AdLibraryItem, LibraryCounts } from "../../libs/types/generation.type";

const BG = ["#1a3a4a", "#2a1a3a", "#1a2a3a", "#3a2a1a", "#1a3a2a", "#2a3a1a"];
const CONCEPTS = ["All", "⭐ Favorites", "Feature Pointers", "Testimonial", "Before & After", "Us vs Them", "Social Proof", "Stat Callout"];

function timeAgo(dateStr: string) {
    if (!dateStr) return "";
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return "just now";
}

function LibraryPage() {
    const router = useRouter();
    const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [conceptFilter, setConceptFilter] = useState("All");
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState("newest");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [detailId, setDetailId] = useState<string | null>(null);

    // Inline rename state
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const renameInputRef = useRef<HTMLInputElement>(null);

    // Bulk action state
    const [bulkLoading, setBulkLoading] = useState<string | null>(null);

    // Data State
    const [ads, setAds] = useState<AdLibraryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [canvaLoading, setCanvaLoading] = useState(false);
    const [zipDownloading, setZipDownloading] = useState(false);

    // Fix Errors States
    const [fixModalOpen, setFixModalOpen] = useState(false);
    const [fixDescription, setFixDescription] = useState("");
    const [isFixing, setIsFixing] = useState(false);
    const [fixedAdId, setFixedAdId] = useState<string | null>(null);
    const [fixedAdOutput, setFixedAdOutput] = useState<any | null>(null);
    const [isCompareOpen, setIsCompareOpen] = useState(false);

    const handleBuyCanva = async () => {
        if (!detailAd || canvaLoading) return;
        setCanvaLoading(true);
        try {
            const { createCanvaCheckoutRequest } = await import("../../server/user/billing");
            const data = await createCanvaCheckoutRequest(detailAd._id);
            if (data.checkout_url) window.location.href = data.checkout_url;
        } catch (e: any) {
            alert(e.message || "Failed to start Canva checkout");
        } finally {
            setCanvaLoading(false);
        }
    };
    const [counts, setCounts] = useState<LibraryCounts>({ brands: [], products: [], total_ads: 0 });

    useEffect(() => {
        getLibraryCountsRequest().then(setCounts).catch(console.error);
    }, []);

    useEffect(() => {
        setLoading(true);
        const query: any = { limit: 50, sort_by: sortBy };
        if (selectedBrand) query.brand_id = selectedBrand;
        if (selectedFolder) query.product_id = selectedFolder;
        if (search) query.search = search;

        getLibraryAdsRequest(query)
            .then((res) => {
                let filtered = res.list as AdLibraryItem[];
                if (conceptFilter === "⭐ Favorites") {
                    filtered = filtered.filter((a) => a.is_favorite);
                } else if (conceptFilter !== "All") {
                    filtered = filtered.filter((a) => a.concept_name === conceptFilter);
                }
                setAds(filtered);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [selectedBrand, selectedFolder, conceptFilter, search, sortBy]);

    // Focus rename input when it appears
    useEffect(() => {
        if (renamingId && renameInputRef.current) renameInputRef.current.focus();
    }, [renamingId]);

    const toggleSelect = (id: string) =>
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

    // ⭐ Toggle favorite — optimistic update
    const handleToggleFavorite = async (e: React.MouseEvent, adId: string) => {
        e.stopPropagation();
        setAds((prev) =>
            prev.map((a) => (a._id === adId ? { ...a, is_favorite: !a.is_favorite } : a))
        );
        try {
            await toggleFavoriteRequest(adId);
        } catch {
            // Revert on failure
            setAds((prev) =>
                prev.map((a) => (a._id === adId ? { ...a, is_favorite: !a.is_favorite } : a))
            );
        }
    };

    // ✏️ Rename — double-click to start
    const startRename = (e: React.MouseEvent, ad: AdLibraryItem) => {
        e.stopPropagation();
        setRenamingId(ad._id);
        setRenameValue(ad.name);
    };

    const commitRename = async (adId: string) => {
        if (!renameValue.trim()) { setRenamingId(null); return; }
        setAds((prev) =>
            prev.map((a) => (a._id === adId ? { ...a, name: renameValue.trim() } : a))
        );
        setRenamingId(null);
        try {
            await renameAdRequest(adId, renameValue.trim());
        } catch {
            console.error("Rename failed");
        }
    };

    // 🗑️ Bulk delete
    const handleBulkDelete = async () => {
        if (!selectedIds.length) return;
        if (!confirm(`Delete ${selectedIds.length} ad(s)? This cannot be undone.`)) return;
        setBulkLoading("delete");
        try {
            await deleteAdsRequest(selectedIds);
            setAds((prev) => prev.filter((a) => !selectedIds.includes(a._id)));
            setSelectedIds([]);
        } catch (e: any) {
            alert(e.message || "Delete failed");
        } finally {
            setBulkLoading(null);
        }
    };

    // ⤓ Bulk download — sequential
    const handleBulkDownload = async () => {
        if (!selectedIds.length) return;
        setBulkLoading("download");
        for (const id of selectedIds) {
            const ad = ads.find((a) => a._id === id);
            try {
                await downloadAdImage(id, `${ad?.name || id}_1x1.png`);
                await new Promise((r) => setTimeout(r, 600)); // small delay between downloads
            } catch { /* skip */ }
        }
        setBulkLoading(null);
    };

    const fetchRatioBlob = async (adId: string, ratio: string): Promise<Blob | null> => {
        const token = localStorage.getItem("se_access_token");
        try {
            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3007";
            const res = await fetch(`${API_BASE_URL}/generation/download/${adId}/${ratio}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return null;
            return await res.blob();
        } catch {
            return null;
        }
    };

    const downloadAllAsZip = async () => {
        if (!detailAd || zipDownloading) return;
        setZipDownloading(true);
        try {
            const JSZip = (await import("jszip")).default;
            const zip = new JSZip();
            const adName = (detailAd.name || "ad").replace(/[^a-zA-Z0-9_-]/g, "_");
            const ratios = ["1:1", "9:16", "16:9"];

            for (const ratio of ratios) {
                const blob = await fetchRatioBlob(detailAd._id, ratio);
                if (blob) zip.file(`${adName}_${ratio.replace(":", "x")}.png`, blob);
            }
            const zipBlob = await zip.generateAsync({ type: "blob" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(zipBlob);
            a.download = `${adName}_all_ratios.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (e) {
            console.error("ZIP download failed", e);
            alert("Failed to create ZIP");
        } finally {
            setZipDownloading(false);
        }
    };

    const detailAd = detailId ? ads.find((a) => a._id === detailId) : null;

    // 🔥 Fix Errors logic & polling
    useEffect(() => {
        if (!fixedAdId) return;
        const interval = setInterval(async () => {
            try {
                const data = await getSingleAdRequest(fixedAdId);
                if (data && data.generation_status === "completed") {
                    setFixedAdOutput(data);
                    setIsFixing(false);
                    setFixModalOpen(false);
                    setIsCompareOpen(true);
                    setFixedAdId(null);
                } else if (data && data.generation_status === "failed") {
                    alert("Fix job failed.");
                    setIsFixing(false);
                    setFixModalOpen(false);
                    setFixedAdId(null);
                }
            } catch (e) { }
        }, 5000);
        return () => clearInterval(interval);
    }, [fixedAdId]);

    const handleStartFix = async () => {
        if (!detailAd || !fixDescription.trim() || isFixing) return;
        setIsFixing(true);
        try {
            const data = await fixErrorRequest(detailAd._id, fixDescription.trim());
            setFixedAdId(data._id);
            setFixDescription("");
        } catch (e: any) {
            alert(e.message || "Failed to start fix");
            setIsFixing(false);
        }
    };

    const handleAcceptFix = async () => {
        if (!detailAd) return;
        try {
            await deleteAdsRequest([detailAd._id]);
            setAds((prev) => prev.filter((a) => a._id !== detailAd?._id));
            if (fixedAdOutput) setAds((prev) => [fixedAdOutput, ...prev]);
        } catch { }
        setIsCompareOpen(false);
        setFixedAdOutput(null);
        setDetailId(null);
    };

    const handleRejectFix = async () => {
        try {
            if (fixedAdOutput) await deleteAdsRequest([fixedAdOutput._id]);
        } catch { }
        setIsCompareOpen(false);
        setFixedAdOutput(null);
    };

    return (
        <div className="library-page">
            <div className="lib-main lib-main--full">

                {/* Top Bar */}
                <div className="lib-topbar">
                    <div className="lib-topbar__title-area">
                        <button
                            onClick={() => router.push("/dashboard")}
                            style={{
                                padding: "6px 14px", fontSize: 13, fontWeight: 500,
                                color: "var(--muted)", background: "rgba(255,255,255,0.06)",
                                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                                cursor: "pointer", marginBottom: 8, transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "var(--text)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "var(--muted)"; }}
                        >← Dashboard</button>
                        <div className="lib-topbar__title">
                            {selectedBrand ? counts.brands.find((b) => b._id === selectedBrand)?.name : "All"} Ads
                        </div>
                        <div className="lib-topbar__path">
                            Library {selectedBrand ? ` / ${counts.brands.find((b) => b._id === selectedBrand)?.name}` : ""}
                            {selectedFolder ? ` / ${counts.products.find((f) => f._id === selectedFolder)?.name}` : ""}
                        </div>
                    </div>
                    <div className="lib-topbar-actions">
                        <input
                            className="lib-search"
                            placeholder="Search ads..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <select
                            className="lib-btn"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            style={{ cursor: "pointer" }}
                        >
                            <option value="newest">Newest</option>
                            <option value="oldest">Oldest</option>
                            <option value="brand">Brand</option>
                        </select>
                        <button className={`lib-btn ${viewMode === "grid" ? "lib-btn--active" : ""}`} onClick={() => setViewMode("grid")}>⊞ Grid</button>
                        <button className={`lib-btn ${viewMode === "list" ? "lib-btn--active" : ""}`} onClick={() => setViewMode("list")}>☰ List</button>
                    </div>
                </div>

                {/* Brand Filter Chips */}
                <div className="lib-filters">
                    <div
                        className={`lib-filter-btn ${!selectedBrand ? "lib-filter-btn--active" : ""}`}
                        onClick={() => { setSelectedBrand(null); setSelectedFolder(null); }}
                        style={{ cursor: "pointer" }}
                    >All Brands ({counts.total_ads})</div>
                    {counts.brands.map((b) => (
                        <div
                            key={b._id}
                            className={`lib-filter-btn ${selectedBrand === b._id ? "lib-filter-btn--active" : ""}`}
                            onClick={() => { setSelectedBrand(selectedBrand === b._id ? null : b._id); setSelectedFolder(null); }}
                            style={{ cursor: "pointer" }}
                        >
                            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: b.color, marginRight: 6 }} />
                            {b.name} ({b.count})
                        </div>
                    ))}
                </div>

                {/* Product Filter */}
                {counts.products.filter((p) => !selectedBrand || p.brand_id === selectedBrand).length > 0 && (
                    <div className="lib-filters" style={{ marginTop: -8 }}>
                        <div
                            className={`lib-filter-btn ${!selectedFolder ? "lib-filter-btn--active" : ""}`}
                            onClick={() => setSelectedFolder(null)}
                            style={{ cursor: "pointer", fontSize: 12 }}
                        >All Products</div>
                        {counts.products
                            .filter((p) => !selectedBrand || p.brand_id === selectedBrand)
                            .map((f) => (
                                <div
                                    key={f._id}
                                    className={`lib-filter-btn ${selectedFolder === f._id ? "lib-filter-btn--active" : ""}`}
                                    onClick={() => setSelectedFolder(selectedFolder === f._id ? null : f._id)}
                                    style={{ cursor: "pointer", fontSize: 12 }}
                                >📁 {f.name} ({f.count})</div>
                            ))}
                    </div>
                )}

                {/* Concept / Favorites Filter */}
                <div className="lib-filters">
                    {CONCEPTS.map((cat) => (
                        <button
                            key={cat}
                            className={`lib-filter-btn ${conceptFilter === cat ? "lib-filter-btn--active" : ""}`}
                            onClick={() => setConceptFilter(cat)}
                            style={cat === "⭐ Favorites" ? {
                                borderColor: conceptFilter === cat ? "rgba(251,191,36,0.6)" : "rgba(251,191,36,0.2)",
                                color: conceptFilter === cat ? "#FBBF24" : "rgba(251,191,36,0.7)",
                                background: conceptFilter === cat ? "rgba(251,191,36,0.12)" : undefined,
                            } : {}}
                        >{cat}</button>
                    ))}
                </div>

                {/* Bulk Actions */}
                {selectedIds.length > 0 && (
                    <div className="lib-bulk">
                        <span className="lib-bulk__count">{selectedIds.length} selected</span>
                        <button
                            className="lib-bulk__btn"
                            onClick={handleBulkDownload}
                            disabled={bulkLoading === "download"}
                            style={{ opacity: bulkLoading === "download" ? 0.6 : 1 }}
                        >
                            {bulkLoading === "download" ? "Downloading..." : "⤓ Download All"}
                        </button>
                        <button
                            className="lib-bulk__btn"
                            onClick={handleBulkDelete}
                            disabled={bulkLoading === "delete"}
                            style={{ color: "#EF4444", borderColor: "rgba(239,68,68,0.4)", opacity: bulkLoading === "delete" ? 0.6 : 1 }}
                        >
                            {bulkLoading === "delete" ? "Deleting..." : "🗑 Delete"}
                        </button>
                        <button className="lib-bulk__clear" onClick={() => setSelectedIds([])}>Clear</button>
                    </div>
                )}

                {/* ===== GRID VIEW ===== */}
                {viewMode === "grid" && (
                    <div className="lib-ads-grid">
                        {ads.map((ad, i) => (
                            <div
                                key={ad._id}
                                className={`lib-ad-card ${selectedIds.includes(ad._id) ? "lib-ad-card--selected" : ""}`}
                                onClick={() => setDetailId(ad._id)}
                            >
                                <div
                                    className="lib-ad-card__image"
                                    style={{
                                        background: ad.image
                                            ? `url(${ad.image}) center/cover`
                                            : `linear-gradient(135deg, ${BG[i % 6]}dd, ${BG[(i + 3) % 6]}aa)`,
                                        position: "relative",
                                    }}
                                >
                                    {!ad.image && <span className="lib-ad-card__placeholder">AD</span>}

                                    {/* Select checkbox */}
                                    <div
                                        className={`lib-ad-card__select ${selectedIds.includes(ad._id) ? "lib-ad-card__select--checked" : ""}`}
                                        onClick={(e) => { e.stopPropagation(); toggleSelect(ad._id); }}
                                    >{selectedIds.includes(ad._id) ? "✓" : ""}</div>

                                    {/* ⭐ Favorite button */}
                                    <button
                                        onClick={(e) => handleToggleFavorite(e, ad._id)}
                                        style={{
                                            position: "absolute", bottom: 8, right: 8,
                                            background: ad.is_favorite ? "rgba(251,191,36,0.9)" : "rgba(0,0,0,0.5)",
                                            border: "none", borderRadius: "50%",
                                            width: 30, height: 30, cursor: "pointer",
                                            fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
                                            transition: "all 0.2s",
                                            transform: ad.is_favorite ? "scale(1.1)" : "scale(1)",
                                        }}
                                        title={ad.is_favorite ? "Remove from favorites" : "Add to favorites"}
                                    >{ad.is_favorite ? "⭐" : "☆"}</button>
                                </div>

                                <div className="lib-ad-card__info">
                                    {/* Inline rename on double-click */}
                                    {renamingId === ad._id ? (
                                        <input
                                            ref={renameInputRef}
                                            value={renameValue}
                                            onChange={(e) => setRenameValue(e.target.value)}
                                            onBlur={() => commitRename(ad._id)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") commitRename(ad._id);
                                                if (e.key === "Escape") setRenamingId(null);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                                width: "100%", background: "rgba(255,255,255,0.08)",
                                                border: "1px solid var(--accent)", borderRadius: 6,
                                                color: "var(--text)", fontSize: 13, padding: "3px 8px",
                                                outline: "none",
                                            }}
                                        />
                                    ) : (
                                        <div
                                            className="lib-ad-card__name"
                                            onDoubleClick={(e) => startRename(e, ad)}
                                            title="Double-click to rename"
                                            style={{ cursor: "text" }}
                                        >{ad.name}</div>
                                    )}
                                    <div className="lib-ad-card__meta">
                                        <span className="lib-ad-card__date">{timeAgo(ad.created_at)}</span>
                                        <span
                                            className="lib-ad-card__brand"
                                            style={{ background: `${ad.brand_color}18`, color: ad.brand_color }}
                                        >{ad.brand_name}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ===== LIST VIEW ===== */}
                {viewMode === "list" && (
                    <div className="lib-ads-list">
                        {ads.map((ad, i) => (
                            <div
                                key={ad._id}
                                className={`lib-list-item ${selectedIds.includes(ad._id) ? "lib-list-item--selected" : ""}`}
                                onClick={() => setDetailId(ad._id)}
                            >
                                <div
                                    className={`lib-list-item__select ${selectedIds.includes(ad._id) ? "lib-list-item__select--checked" : ""}`}
                                    onClick={(e) => { e.stopPropagation(); toggleSelect(ad._id); }}
                                >{selectedIds.includes(ad._id) ? "✓" : ""}</div>

                                <div
                                    className="lib-list-item__thumb"
                                    style={{
                                        background: ad.image
                                            ? `url(${ad.image}) center/cover`
                                            : `linear-gradient(135deg, ${BG[i % 6]}cc, ${BG[(i + 3) % 6]}88)`,
                                    }}
                                >{!ad.image && <span>AD</span>}</div>

                                <div className="lib-list-item__info">
                                    {renamingId === ad._id ? (
                                        <input
                                            ref={renameInputRef}
                                            value={renameValue}
                                            onChange={(e) => setRenameValue(e.target.value)}
                                            onBlur={() => commitRename(ad._id)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") commitRename(ad._id);
                                                if (e.key === "Escape") setRenamingId(null);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                                background: "rgba(255,255,255,0.08)",
                                                border: "1px solid var(--accent)", borderRadius: 6,
                                                color: "var(--text)", fontSize: 13, padding: "3px 8px", outline: "none",
                                            }}
                                        />
                                    ) : (
                                        <div
                                            className="lib-list-item__name"
                                            onDoubleClick={(e) => startRename(e, ad)}
                                            title="Double-click to rename"
                                            style={{ cursor: "text" }}
                                        >{ad.name}</div>
                                    )}
                                    <div className="lib-list-item__concept">{ad.concept_name}</div>
                                </div>

                                <span className="lib-list-item__brand" style={{ background: `${ad.brand_color}18`, color: ad.brand_color }}>
                                    {ad.brand_name}
                                </span>
                                <span className="lib-list-item__date">{timeAgo(ad.created_at)}</span>

                                <div className="lib-list-item__actions">
                                    <button
                                        className="lib-list-item__action-btn"
                                        onClick={(e) => { e.stopPropagation(); handleToggleFavorite(e, ad._id); }}
                                        style={{ color: ad.is_favorite ? "#FBBF24" : undefined }}
                                    >{ad.is_favorite ? "⭐" : "☆"}</button>
                                    <button
                                        className="lib-list-item__action-btn"
                                        onClick={(e) => { e.stopPropagation(); setDetailId(ad._id); }}
                                    >View</button>
                                    <button
                                        className="lib-list-item__action-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            downloadAdImage(ad._id, `${ad.name || "ad"}_1x1.png`).catch(() => {
                                                if (ad.image) window.open(ad.image, "_blank");
                                            });
                                        }}
                                    >⤓</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Empty / Loading states */}
                {!loading && ads.length === 0 && (
                    <div className="lib-empty">
                        <div className="lib-empty__icon">{conceptFilter === "⭐ Favorites" ? "⭐" : "🔍"}</div>
                        <div className="lib-empty__title">{conceptFilter === "⭐ Favorites" ? "No favorites yet" : "No ads found"}</div>
                        <div className="lib-empty__desc">
                            {conceptFilter === "⭐ Favorites"
                                ? "Star any ad to add it to your favorites."
                                : "Try adjusting your filters or search query."}
                        </div>
                    </div>
                )}
                {loading && (
                    <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading ads...</div>
                )}
            </div>

            {/* ===== DETAIL PANEL ===== */}
            {detailAd && (
                <div className="modal-backdrop" onClick={() => setDetailId(null)} style={{ zIndex: 999 }}>
                    <div
                        className="modal-content"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: 1200, width: "95%", height: "85vh", display: "flex", flexDirection: "column", padding: 0 }}
                    >
                        {/* Header */}
                        <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h2 style={{ margin: 0, fontSize: 20, color: "var(--text)" }}>{detailAd.name}</h2>
                            <button onClick={() => setDetailId(null)} style={{ background: "transparent", border: "none", color: "var(--muted)", fontSize: 24, cursor: "pointer" }}>×</button>
                        </div>

                        {/* Body */}
                        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                            {/* Left: Images */}
                            <div style={{ flex: 1, padding: 24, overflowY: "auto", borderRight: "1px solid rgba(255,255,255,0.1)" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
                                    {[
                                        { ratio: "1:1", url: detailAd.image_url_1x1 || detailAd.image },
                                        { ratio: "9:16", url: detailAd.image_url_9x16 },
                                        { ratio: "16:9", url: detailAd.image_url_16x9 }
                                    ].filter(x => x.url).map((img, i) => (
                                        <div key={i} style={{ background: "rgba(0,0,0,0.2)", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
                                            <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.03)", fontSize: 13, fontWeight: 600, color: "var(--text)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                                {img.ratio}
                                            </div>
                                            <img src={img.url} alt={img.ratio} style={{ width: "100%", height: "auto", display: "block", objectFit: "contain", maxHeight: "60vh" }} />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right: Meta & Actions */}
                            <div style={{ width: 350, padding: 24, overflowY: "auto", background: "rgba(255,255,255,0.01)" }}>
                                <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "var(--text)" }}>Metadata</h3>
                                <div style={{ marginBottom: 30, padding: 20, background: "rgba(0,0,0,0.2)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.03)" }}>
                                    {[
                                        { label: "Brand", value: detailAd.brand_name },
                                        { label: "Product", value: detailAd.product_name },
                                        { label: "Concept", value: detailAd.concept_name },
                                        { label: "Created", value: timeAgo(detailAd.created_at) }
                                    ].map((m) => (
                                        <div key={m.label} style={{ marginBottom: 14, fontSize: 13 }}>
                                            <div style={{ color: "var(--muted)", marginBottom: 4 }}>{m.label}</div>
                                            <div style={{ color: "var(--text)", fontWeight: 500 }}>{m.value}</div>
                                        </div>
                                    ))}
                                </div>

                                <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "var(--text)" }}>Actions</h3>
                                {/* Same actions block as before */}
                                <div className="detail-actions">
                                    <button onClick={(e) => handleToggleFavorite(e, detailAd._id)} style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: `1px solid ${detailAd.is_favorite ? "rgba(251,191,36,0.5)" : "rgba(255,255,255,0.1)"}`, background: detailAd.is_favorite ? "rgba(251,191,36,0.1)" : "transparent", color: detailAd.is_favorite ? "#FBBF24" : "var(--muted)", fontWeight: 600, fontSize: 13, cursor: "pointer", marginBottom: 16 }}>{detailAd.is_favorite ? "⭐ Remove from Favorites" : "☆ Add to Favorites"}</button>

                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                                        {(["1:1", "9:16", "16:9"] as const).map((ratio) => (
                                            <button key={ratio} className="detail-actions__btn detail-actions__btn--primary" onClick={() => { downloadAdImageByRatio(detailAd._id, ratio, `${detailAd.name}_${ratio.replace(":", "x")}.png`).catch(() => { if (detailAd.image) window.open(detailAd.image, "_blank"); }); }} style={{ padding: "10px 0", fontSize: 12 }}>⤓ {ratio}</button>
                                        ))}
                                    </div>

                                    <button className="detail-actions__btn detail-actions__btn--primary" onClick={downloadAllAsZip} disabled={zipDownloading} style={{ width: "100%", padding: "12px 0", marginBottom: 20, background: "linear-gradient(135deg, rgba(34,211,238,0.1), rgba(59,130,246,0.1))", border: "1px solid rgba(34,211,238,0.3)", color: "#38bdf8", fontWeight: 600, fontSize: 13, opacity: zipDownloading ? 0.7 : 1 }}>{zipDownloading ? "Packing ZIP..." : "⤓ Download All Ratios (ZIP)"}</button>

                                    <div className="detail-actions__row">
                                        <button className="detail-actions__btn detail-actions__btn--secondary" style={{ borderColor: "rgba(16,185,129,0.3)", color: "#10B981" }} onClick={() => setFixModalOpen(true)}>🛠 Fix Errors</button>
                                        <button className="detail-actions__btn detail-actions__btn--secondary">↻ Regenerate</button>
                                        <button className="detail-actions__btn detail-actions__btn--secondary" style={{ borderColor: "rgba(239,68,68,0.3)", color: "#EF4444" }} onClick={async () => { if (!confirm("Delete this ad?")) return; try { await deleteAdsRequest([detailAd._id]); setAds((prev) => prev.filter((a) => a._id !== detailAd._id)); setDetailId(null); } catch { alert("Delete failed"); } }}>🗑 Delete</button>
                                    </div>

                                    <div className="detail-actions__row">
                                        {detailAd.canva_status === 'fulfilled' && detailAd.canva_link ? (
                                            <button className="detail-actions__btn detail-actions__btn--secondary" style={{ borderColor: "rgba(16,185,129,0.3)", color: "#10B981" }} onClick={() => window.open(detailAd.canva_link!, "_blank")}>Open Canva Template</button>
                                        ) : detailAd.canva_status === 'pending' ? (
                                            <button className="detail-actions__btn detail-actions__btn--secondary" style={{ borderColor: "rgba(245,158,11,0.27)", color: "var(--yellow)", opacity: 0.7, cursor: "not-allowed" }} disabled>Canva Template Pending...</button>
                                        ) : (
                                            <button className="detail-actions__btn detail-actions__btn--secondary" style={{ borderColor: "rgba(245,158,11,0.27)", color: "var(--yellow)" }} onClick={handleBuyCanva} disabled={canvaLoading}>{canvaLoading ? "Redirecting..." : "Buy Canva Template"}</button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* MODALS BELOW */}

            {/* Fix Description Modal */}
            {fixModalOpen && (
                <div className="modal-backdrop" onClick={() => !isFixing && setFixModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450, padding: 30 }}>
                        <h2 style={{ margin: "0 0 10px", fontSize: 20, color: "var(--text)" }}>Describe the fix</h2>
                        <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--muted)" }}>Tell us what needs to be changed in this ad (e.g., "remove the dog", "make the logo larger").</p>

                        <textarea
                            disabled={isFixing}
                            value={fixDescription}
                            onChange={(e) => setFixDescription(e.target.value)}
                            placeholder="Describe your fix here..."
                            style={{
                                width: "100%", minHeight: 120, background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 12,
                                color: "var(--text)", fontSize: 14, outline: "none", resize: "none", marginBottom: 20
                            }}
                        />

                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                            <button
                                onClick={() => setFixModalOpen(false)}
                                disabled={isFixing}
                                style={{ padding: "10px 16px", background: "transparent", color: "var(--muted)", border: "none", cursor: "pointer", fontWeight: 500 }}
                            >Cancel</button>
                            <button
                                onClick={handleStartFix}
                                disabled={isFixing || !fixDescription.trim()}
                                style={{
                                    padding: "10px 20px", background: "var(--primary)", color: "#fff", border: "none",
                                    borderRadius: 8, cursor: "pointer", fontWeight: 600, opacity: (isFixing || !fixDescription.trim()) ? 0.6 : 1
                                }}
                            >{isFixing ? "Fixing image..." : "Start Fix"}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Comparison Modal */}
            {isCompareOpen && detailAd && fixedAdOutput && (
                <div className="modal-backdrop" style={{ zIndex: 9999 }}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 1000, padding: 30, background: "var(--bg-layer1)" }}>
                        <h2 style={{ margin: "0 0 20px", fontSize: 22, color: "var(--text)", textAlign: "center" }}>Review Fixes</h2>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 30 }}>
                            {/* Original */}
                            <div style={{ textAlign: "center" }}>
                                <h3 style={{ margin: "0 0 10px", color: "var(--muted)", fontSize: 16 }}>Original</h3>
                                <div style={{ border: "2px solid rgba(255,255,255,0.1)", borderRadius: 12, overflow: "hidden", aspectRatio: "1/1" }}>
                                    <img src={detailAd.image_url_1x1 || detailAd.image} alt="Original" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                </div>
                            </div>

                            {/* Fixed */}
                            <div style={{ textAlign: "center" }}>
                                <h3 style={{ margin: "0 0 10px", color: "#10B981", fontSize: 16 }}>Fixed Version</h3>
                                <div style={{ border: "2px solid #10B981", borderRadius: 12, overflow: "hidden", aspectRatio: "1/1" }}>
                                    <img src={fixedAdOutput.image_url_1x1 || fixedAdOutput.image} alt="Fixed" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
                            <button
                                onClick={handleRejectFix}
                                style={{ padding: "12px 24px", background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 15 }}
                            >✕ Reject Fix</button>
                            <button
                                onClick={handleAcceptFix}
                                style={{ padding: "12px 24px", background: "#10B981", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 15 }}
                            >✓ Accept Fix</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

export default function Library() {
    return (
        <AuthGuard>
            <LibraryPage />
        </AuthGuard>
    );
}
