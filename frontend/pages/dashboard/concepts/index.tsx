import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AuthGuard from "../../../libs/auth/AuthGuard";
import { getConcepts, getCategories, getRecommendedConcepts, getConceptConfig } from "../../../server/user/concept";
import type { AdConcept, ConceptCategoryItem, ConceptConfig } from "../../../libs/types/concept.type";
import API_BASE_URL from "../../../libs/config/api.config";

/** Prepend API base URL to relative image paths */
function resolveImageUrl(url?: string): string {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `${API_BASE_URL}${url}`;
}

function ConceptLibraryPage() {
    const router = useRouter();

    // ── State ──
    const [concepts, setConcepts] = useState<AdConcept[]>([]);
    const [categories, setCategories] = useState<ConceptCategoryItem[]>([]);
    const [recommended, setRecommended] = useState<AdConcept[]>([]);
    const [config, setConfig] = useState<ConceptConfig | null>(null);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [tagFilter, setTagFilter] = useState("");
    const [page, setPage] = useState(1);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const limit = 20;

    // ── Dynamic popular threshold (from backend config, fallback 50) ──
    const popularThreshold = config?.popular_threshold ?? 50;

    // ── Fetch config (once) ──
    useEffect(() => {
        getConceptConfig()
            .then((res) => setConfig(res))
            .catch(() => { /* use fallback */ });
    }, []);

    // ── Fetch categories ──
    const fetchCategories = useCallback(async () => {
        try {
            const res = await getCategories();
            setCategories(res.list || []);
        } catch {
            setCategories([]);
        }
    }, []);

    // ── Fetch concepts ──
    const fetchConcepts = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await getConcepts(
                categoryFilter || undefined,
                search || undefined,
                tagFilter || undefined,
                page,
                limit,
            );
            setConcepts(res.list || []);
            setTotal(res.total || 0);
        } catch (err: any) {
            setError(err.message || "Failed to load concepts");
            setConcepts([]);
        } finally {
            setLoading(false);
        }
    }, [categoryFilter, search, tagFilter, page]);

    // ── Fetch recommended ──
    const fetchRecommended = useCallback(async () => {
        try {
            const res = await getRecommendedConcepts();
            setRecommended(res.list || []);
        } catch {
            setRecommended([]);
        }
    }, []);

    useEffect(() => {
        fetchCategories();
        fetchRecommended();
    }, [fetchCategories, fetchRecommended]);

    useEffect(() => {
        fetchConcepts();
    }, [fetchConcepts]);

    // ── Clear selection when filters/page change ──
    useEffect(() => {
        setSelectedId(null);
    }, [categoryFilter, search, tagFilter, page]);

    // ── Select concept (single-select, NO usage increment here) ──
    const handleSelect = (concept: AdConcept) => {
        setSelectedId((prev) => (prev === concept._id ? null : concept._id));
    };

    // ── Use selected concept (navigate to generate page) ──
    const handleUseSelected = () => {
        if (!selectedId) return;
        router.push({
            pathname: "/generateAds",
            query: { concept: selectedId },
        });
    };

    // ── Category name helper ──
    const getCategoryName = (categoryId?: string, categoryName?: string) => {
        if (categoryName) return categoryName;
        if (!categoryId) return "";
        const cat = categories.find((c) => c._id === categoryId);
        return cat ? cat.name : "";
    };

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="concept-lib">
            {/* ── Header ── */}
            <div className="concept-lib__header">
                <div className="concept-lib__back" onClick={() => router.back()}>
                    ← Back to Dashboard
                </div>
                <h1 className="concept-lib__title">Ad Concept Library</h1>
                <p className="concept-lib__subtitle">
                    Browse proven ad styles and templates. Select a concept to use in your next generation.
                </p>
            </div>

            {/* ── Recommended ── */}
            {recommended.length > 0 && (
                <div className="concept-lib__rec-bar">
                    <div className="concept-lib__rec-title">
                        🔥 Popular Concepts
                    </div>
                    <div className="concept-lib__rec-scroll">
                        {recommended.map((c) => (
                            <div
                                key={c._id}
                                className="concept-lib__rec-card"
                                onClick={() => handleSelect(c)}
                            >
                                <img
                                    src={resolveImageUrl(c.image_url)}
                                    alt={c.name}
                                    className="concept-lib__rec-img"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                    }}
                                />
                                <div className="concept-lib__rec-info">
                                    <div className="concept-lib__rec-name">{c.name}</div>
                                    <div className="concept-lib__rec-usage">
                                        {c.usage_count} uses
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Controls ── */}
            <div className="concept-lib__controls">
                <div className="concept-lib__search-row">
                    <input
                        className="concept-lib__search"
                        placeholder="Search concepts by name or description..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                    />
                    {selectedId && (
                        <button
                            className="concept-lib__filter-btn concept-lib__filter-btn--active"
                            style={{
                                background: "var(--gradient)",
                                border: "none",
                                color: "#fff",
                                fontWeight: 600,
                                padding: "10px 24px",
                            }}
                            onClick={handleUseSelected}
                        >
                            Use Selected →
                        </button>
                    )}
                    <span className="concept-lib__result-count">
                        {total} concept{total !== 1 ? "s" : ""}
                    </span>
                </div>
                <div className="concept-lib__filters">
                    <button
                        className={`concept-lib__filter-btn ${categoryFilter === "" ? "concept-lib__filter-btn--active" : ""}`}
                        onClick={() => { setCategoryFilter(""); setPage(1); }}
                    >
                        All
                    </button>
                    {categories.map((cat) => (
                        <button
                            key={cat._id}
                            className={`concept-lib__filter-btn ${categoryFilter === cat._id ? "concept-lib__filter-btn--active" : ""}`}
                            onClick={() => { setCategoryFilter(cat._id); setPage(1); }}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
                {/* Active tag filter indicator */}
                {tagFilter && (
                    <div className="concept-lib__active-tag">
                        Filtering by tag: <strong>{tagFilter}</strong>
                        <button
                            onClick={() => { setTagFilter(""); setPage(1); }}
                            style={{ marginLeft: 8, cursor: "pointer", background: "none", border: "none", color: "var(--accent)", fontSize: 14 }}
                        >
                            ✕ Clear
                        </button>
                    </div>
                )}
            </div>

            {/* ── Error ── */}
            {error && <div className="concept-lib__error">⚠️ {error}</div>}

            {/* ── Loading ── */}
            {loading && (
                <div className="concept-lib__loading">
                    <div className="concept-lib__spinner" />
                    Loading concepts...
                </div>
            )}

            {/* ── Empty ── */}
            {!loading && !error && concepts.length === 0 && (
                <div className="concept-lib__empty">
                    <div className="concept-lib__empty-icon">🎨</div>
                    <div className="concept-lib__empty-text">No concepts found</div>
                    <div className="concept-lib__empty-hint">
                        {search || categoryFilter || tagFilter
                            ? "Try adjusting your search or filters"
                            : "Check back soon — concepts are being added!"}
                    </div>
                </div>
            )}

            {/* ── Grid ── */}
            {!loading && concepts.length > 0 && (
                <div className="concept-lib__grid">
                    {concepts.map((concept) => (
                        <div
                            key={concept._id}
                            className={`concept-lib__card ${selectedId === concept._id ? "concept-lib__card--selected" : ""}`}
                            onClick={() => handleSelect(concept)}
                        >
                            <div className="concept-lib__card-img-wrap">
                                <img
                                    src={resolveImageUrl(concept.image_url)}
                                    alt={concept.name}
                                    className="concept-lib__card-img"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                    }}
                                />
                                {concept.usage_count >= popularThreshold && (
                                    <div className="concept-lib__card-popular">🔥 POPULAR</div>
                                )}
                                {selectedId === concept._id && (
                                    <div className="concept-lib__card-check">✓</div>
                                )}
                            </div>
                            <div className="concept-lib__card-body">
                                <div className="concept-lib__card-category">
                                    {getCategoryName(concept.category_id, concept.category_name)}
                                </div>
                                <div className="concept-lib__card-name">{concept.name}</div>
                                {concept.description && (
                                    <div className="concept-lib__card-desc">{concept.description}</div>
                                )}
                                <div className="concept-lib__card-meta">
                                    <span className="concept-lib__card-usage">
                                        {concept.usage_count} uses
                                    </span>
                                </div>
                                {concept.tags?.length > 0 && (
                                    <div className="concept-lib__card-tags">
                                        {concept.tags.slice(0, 4).map((tag) => (
                                            <span
                                                key={tag}
                                                className="concept-lib__card-tag"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setTagFilter(tag);
                                                    setPage(1);
                                                }}
                                                style={{ cursor: "pointer" }}
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Pagination ── */}
            {totalPages > 1 && (
                <div className="concept-lib__pagination">
                    <button
                        className="concept-lib__page-btn"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                        ← Previous
                    </button>
                    <span className="concept-lib__page-info">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        className="concept-lib__page-btn"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
}

export default function ConceptLibrary() {
    return (
        <AuthGuard>
            <ConceptLibraryPage />
        </AuthGuard>
    );
}
