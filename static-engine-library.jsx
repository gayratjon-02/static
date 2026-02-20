import { useState } from "react";

const C = {
  bg: "#0B0E1A", bgCard: "#111528", bgHover: "#181D35", bgInput: "#0D1020",
  border: "#1E2340", text: "#E8EAF0", muted: "#6B7194", dim: "#4A5072",
  accent: "#3ECFCF", g1: "#3B82F6", g2: "#3ECFCF",
  red: "#EF4444", green: "#22C55E", yellow: "#F59E0B", purple: "#A855F7",
};

const grad = `linear-gradient(135deg, ${C.g1}, ${C.g2})`;
const gradBg = (o) => `linear-gradient(135deg, ${C.g1}${o}, ${C.g2}${o})`;
const BG = ["#1a3a4a", "#2a1a3a", "#1a2a3a", "#3a2a1a", "#1a3a2a", "#2a3a1a", "#1a2a4a", "#3a1a2a"];

const BRANDS = [
  { id: "all", name: "All Brands", color: C.accent, count: 24 },
  { id: "bron", name: "Bron", color: "#3ECFCF", count: 16 },
  { id: "fairway", name: "Fairway Fuel", color: "#22C55E", count: 8 },
];

const FOLDERS = [
  { id: "all", name: "All Ads", icon: "A" },
  { id: "canva", name: "Canva Templates", icon: "C" },
  { id: "q1", name: "Q1 Campaign", icon: "1" },
  { id: "top", name: "Top Performers", icon: "T" },
  { id: "testing", name: "Creative Testing", icon: "X" },
];

const CONCEPTS = ["All", "Feature Pointers", "Testimonial", "Before & After", "Social Proof", "Offer / Promo", "Us vs Them", "Stat Callout", "Lifestyle"];

const MOCK_ADS = [
  { id: 1, name: "48hr Protection - Feature Callouts", brand: "Bron", product: "Bron Deodorant", concept: "Feature Pointers", date: "Feb 10, 2026", ratios: ["1:1"], canva: "available", folder: "q1", favorite: true },
  { id: 2, name: "5-Star Review Highlight", brand: "Bron", product: "Bron Deodorant", concept: "Testimonial", date: "Feb 9, 2026", ratios: ["1:1", "9:16", "16:9"], canva: "available", folder: "top", favorite: true },
  { id: 3, name: "Customer Transformation", brand: "Bron", product: "Bron Makeup", concept: "Before & After", date: "Feb 8, 2026", ratios: ["1:1", "9:16"], canva: "pending", folder: "q1", favorite: false },
  { id: 4, name: "2400+ Reviews Badge", brand: "Fairway Fuel", product: "Pre-Round Chews", concept: "Social Proof", date: "Feb 7, 2026", ratios: ["1:1", "9:16"], canva: "none", folder: "all", favorite: true },
  { id: 5, name: "20% Off First Order", brand: "Bron", product: "Bron Deodorant", concept: "Offer / Promo", date: "Feb 6, 2026", ratios: ["1:1"], canva: "none", folder: "testing", favorite: false },
  { id: 6, name: "Bron vs Competitors", brand: "Bron", product: "Bron Deodorant", concept: "Us vs Them", date: "Feb 5, 2026", ratios: ["1:1", "16:9"], canva: "available", folder: "top", favorite: false },
  { id: 7, name: "Performance Stats", brand: "Fairway Fuel", product: "Pre-Round Chews", concept: "Stat Callout", date: "Feb 4, 2026", ratios: ["1:1"], canva: "none", folder: "all", favorite: false },
  { id: 8, name: "Morning Routine Shot", brand: "Bron", product: "Bron Deodorant", concept: "Lifestyle", date: "Feb 3, 2026", ratios: ["1:1", "9:16", "16:9"], canva: "pending", folder: "q1", favorite: true },
  { id: 9, name: "Natural Ingredients List", brand: "Bron", product: "Bron Deodorant", concept: "Feature Pointers", date: "Feb 2, 2026", ratios: ["1:1"], canva: "none", folder: "testing", favorite: false },
  { id: 10, name: "Golf Course Lifestyle", brand: "Fairway Fuel", product: "Pre-Round Chews", concept: "Lifestyle", date: "Feb 1, 2026", ratios: ["1:1", "9:16"], canva: "none", folder: "all", favorite: false },
  { id: 11, name: "Subscribe & Save Promo", brand: "Fairway Fuel", product: "Pre-Round Chews", concept: "Offer / Promo", date: "Jan 31, 2026", ratios: ["1:1"], canva: "none", folder: "testing", favorite: false },
  { id: 12, name: "Before/After Energy", brand: "Fairway Fuel", product: "Pre-Round Chews", concept: "Before & After", date: "Jan 30, 2026", ratios: ["1:1", "16:9"], canva: "none", folder: "all", favorite: false },
];

const CANVA_LABELS = {
  none: { label: "No Template", color: C.dim, bg: "transparent" },
  pending: { label: "Pending", color: C.yellow, bg: `${C.yellow}15` },
  available: { label: "Canva Ready", color: C.green, bg: `${C.green}15` },
};

export default function AdLibrary() {
  const [activeBrand, setActiveBrand] = useState("all");
  const [activeFolder, setActiveFolder] = useState("all");
  const [activeConcept, setActiveConcept] = useState("All");
  const [canvaFilter, setCanvaFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState("grid");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [hovered, setHovered] = useState(null);
  const [detailAd, setDetailAd] = useState(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  let filtered = [...MOCK_ADS];
  if (activeBrand !== "all") filtered = filtered.filter(a => a.brand.toLowerCase().includes(activeBrand));
  if (activeFolder !== "all" && activeFolder !== "canva") filtered = filtered.filter(a => a.folder === activeFolder);
  if (activeFolder === "canva") filtered = filtered.filter(a => a.canva !== "none");
  if (activeConcept !== "All") filtered = filtered.filter(a => a.concept === activeConcept);
  if (canvaFilter !== "all") filtered = filtered.filter(a => a.canva === canvaFilter);
  if (search) filtered = filtered.filter(a => a.name.toLowerCase().includes(search.toLowerCase()) || a.product.toLowerCase().includes(search.toLowerCase()));
  if (sortBy === "oldest") filtered.reverse();
  if (sortBy === "name") filtered.sort((a, b) => a.name.localeCompare(b.name));

  const toggleSelect = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(a => a.id)));
  };

  const inputStyle = {
    padding: "10px 14px", background: C.bgInput, border: `1px solid ${C.border}`,
    borderRadius: 10, color: C.text, fontSize: 13, outline: "none",
    fontFamily: "'DM Sans', sans-serif",
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        @keyframes slideRight { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }
        * { box-sizing: border-box; }
      `}</style>

      {/* ===== LEFT PANEL: Brands + Folders ===== */}
      <div style={{
        width: 240, minHeight: "100vh", background: C.bgCard,
        borderRight: `1px solid ${C.border}`, padding: "0",
        display: "flex", flexDirection: "column", position: "fixed", left: 0, top: 0, zIndex: 50,
      }}>
        {/* Header */}
        <div style={{
          padding: "20px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", gap: 10, height: 68,
        }}>
          <span style={{
            fontSize: 20, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
            background: grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>Ad Library</span>
        </div>

        {/* Brands */}
        <div style={{ padding: "16px 12px 8px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.dim, textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 8px", marginBottom: 8 }}>
            Brands
          </div>
          {BRANDS.map(b => (
            <div key={b.id} onClick={() => setActiveBrand(b.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 10px", borderRadius: 8, cursor: "pointer",
                background: activeBrand === b.id ? gradBg("15") : "transparent",
                border: activeBrand === b.id ? `1px solid ${C.accent}30` : "1px solid transparent",
                marginBottom: 2, transition: "all 0.15s",
              }}>
              <div style={{
                width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                background: `${b.color}22`, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: b.color,
              }}>{b.id === "all" ? "*" : b.name[0]}</div>
              <span style={{
                fontSize: 13, flex: 1,
                fontWeight: activeBrand === b.id ? 600 : 400,
                color: activeBrand === b.id ? C.text : C.muted,
              }}>{b.name}</span>
              <span style={{ fontSize: 11, color: C.dim, fontWeight: 500 }}>{b.count}</span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: C.border, margin: "8px 20px" }} />

        {/* Folders */}
        <div style={{ padding: "8px 12px", flex: 1 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: C.dim, textTransform: "uppercase",
            letterSpacing: "0.06em", padding: "0 8px", marginBottom: 8,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span>Folders</span>
            <span onClick={() => setShowNewFolder(!showNewFolder)}
              style={{ cursor: "pointer", color: C.accent, fontSize: 16, lineHeight: 1 }}>+</span>
          </div>

          {showNewFolder && (
            <div style={{ display: "flex", gap: 6, padding: "0 4px", marginBottom: 8 }}>
              <input style={{ ...inputStyle, flex: 1, padding: "7px 10px", fontSize: 12 }}
                placeholder="Folder name"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                autoFocus />
              <button onClick={() => { setShowNewFolder(false); setNewFolderName(""); }}
                style={{
                  padding: "7px 12px", borderRadius: 8, border: "none",
                  background: grad, color: "#fff", fontSize: 11, fontWeight: 600,
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                }}>Add</button>
            </div>
          )}

          {FOLDERS.map(f => (
            <div key={f.id} onClick={() => setActiveFolder(f.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 10px", borderRadius: 8, cursor: "pointer",
                background: activeFolder === f.id ? gradBg("15") : "transparent",
                border: activeFolder === f.id ? `1px solid ${C.accent}30` : "1px solid transparent",
                marginBottom: 2, transition: "all 0.15s",
              }}>
              <div style={{
                width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                background: activeFolder === f.id ? `${C.accent}22` : C.bgInput,
                border: `1px solid ${activeFolder === f.id ? C.accent + "44" : C.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700, color: activeFolder === f.id ? C.accent : C.dim,
              }}>{f.icon}</div>
              <span style={{
                fontSize: 13,
                fontWeight: activeFolder === f.id ? 600 : 400,
                color: activeFolder === f.id ? C.text : C.muted,
              }}>{f.name}</span>
            </div>
          ))}
        </div>

        {/* Back to dashboard */}
        <div style={{ padding: "16px 20px", borderTop: `1px solid ${C.border}` }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            fontSize: 13, color: C.dim, cursor: "pointer",
          }}>
            <span style={{ fontSize: 16 }}>&larr;</span>
            <span>Back to Dashboard</span>
          </div>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div style={{ flex: 1, marginLeft: 240, padding: "0 36px 60px" }}>

        {/* Top Bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "24px 0", borderBottom: `1px solid ${C.border}`, marginBottom: 24,
        }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>
              {activeBrand === "all" ? "All Brands" : BRANDS.find(b => b.id === activeBrand)?.name}
              {activeFolder !== "all" && ` / ${FOLDERS.find(f => f.id === activeFolder)?.name}`}
            </div>
            <div style={{ fontSize: 13, color: C.dim, marginTop: 4 }}>
              {filtered.length} ad{filtered.length !== 1 ? "s" : ""}
            </div>
          </div>

          <button style={{
            padding: "12px 28px", borderRadius: 10, border: "none", cursor: "pointer",
            background: grad, color: "#fff", fontSize: 14, fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: `0 4px 20px ${C.accent}33`,
          }}>+ Generate New Ad</button>
        </div>

        {/* Filters Bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
          flexWrap: "wrap", animation: "fadeUp 0.3s ease",
        }}>
          {/* Search */}
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <input style={{ ...inputStyle, width: "100%", paddingLeft: 36 }}
              placeholder="Search ads..."
              value={search} onChange={e => setSearch(e.target.value)} />
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: C.dim }}>
              Q
            </span>
          </div>

          {/* Concept filter */}
          <select style={{ ...inputStyle, cursor: "pointer", minWidth: 160 }}
            value={activeConcept} onChange={e => setActiveConcept(e.target.value)}>
            {CONCEPTS.map(c => <option key={c} value={c}>{c === "All" ? "All Concepts" : c}</option>)}
          </select>

          {/* Canva filter */}
          <select style={{ ...inputStyle, cursor: "pointer", minWidth: 140 }}
            value={canvaFilter} onChange={e => setCanvaFilter(e.target.value)}>
            <option value="all">All Canva Status</option>
            <option value="available">Canva Ready</option>
            <option value="pending">Pending</option>
            <option value="none">No Template</option>
          </select>

          {/* Sort */}
          <select style={{ ...inputStyle, cursor: "pointer", minWidth: 130 }}
            value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Name A-Z</option>
          </select>

          {/* View Toggle */}
          <div style={{ display: "flex", background: C.bgInput, borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            {["grid", "list"].map(v => (
              <div key={v} onClick={() => setViewMode(v)}
                style={{
                  padding: "9px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600,
                  background: viewMode === v ? gradBg("20") : "transparent",
                  color: viewMode === v ? C.accent : C.dim,
                  transition: "all 0.15s",
                }}>
                {v === "grid" ? "Grid" : "List"}
              </div>
            ))}
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selected.size > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 16, padding: "12px 20px",
            background: gradBg("12"), border: `1px solid ${C.accent}33`,
            borderRadius: 12, marginBottom: 16, animation: "fadeUp 0.2s ease",
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.accent }}>
              {selected.size} selected
            </span>
            <div style={{ flex: 1 }} />
            {[
              { label: "Download ZIP", action: "download" },
              { label: "Move to Folder", action: "move" },
              { label: "Delete", action: "delete" },
            ].map(a => (
              <button key={a.action} style={{
                padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                border: a.action === "delete" ? `1px solid ${C.red}44` : `1px solid ${C.border}`,
                background: a.action === "delete" ? `${C.red}12` : "transparent",
                color: a.action === "delete" ? C.red : C.muted,
              }}>{a.label}</button>
            ))}
            <button onClick={() => setSelected(new Set())} style={{
              padding: "7px 12px", borderRadius: 8, border: "none",
              background: "transparent", color: C.dim, cursor: "pointer", fontSize: 12,
              fontFamily: "'DM Sans', sans-serif",
            }}>Clear</button>
          </div>
        )}

        {/* Select All */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
          padding: "0 4px",
        }}>
          <div onClick={selectAll} style={{
            width: 18, height: 18, borderRadius: 4, cursor: "pointer",
            border: selected.size === filtered.length && filtered.length > 0 ? `2px solid ${C.accent}` : `2px solid ${C.border}`,
            background: selected.size === filtered.length && filtered.length > 0 ? C.accent : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, color: "#fff", fontWeight: 700,
          }}>{selected.size === filtered.length && filtered.length > 0 ? "v" : ""}</div>
          <span style={{ fontSize: 12, color: C.dim }}>Select all</span>
        </div>

        {/* ===== GRID VIEW ===== */}
        {viewMode === "grid" && (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14,
            animation: "fadeUp 0.4s ease",
          }}>
            {filtered.map((ad, i) => (
              <div key={ad.id}
                onMouseEnter={() => setHovered(ad.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  borderRadius: 14, overflow: "hidden",
                  background: C.bgCard, border: `1px solid ${selected.has(ad.id) ? C.accent + "66" : C.border}`,
                  transition: "all 0.2s",
                  transform: hovered === ad.id ? "translateY(-3px)" : "none",
                  boxShadow: hovered === ad.id ? "0 8px 24px rgba(0,0,0,0.25)" : "none",
                }}>
                {/* Image */}
                <div style={{
                  height: 170, position: "relative",
                  background: `linear-gradient(135deg, ${BG[i % 8]}dd, ${BG[(i + 4) % 8]}aa)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontSize: 24, opacity: 0.12, fontWeight: 700 }}>AD</span>

                  {/* Select checkbox */}
                  <div onClick={(e) => { e.stopPropagation(); toggleSelect(ad.id); }}
                    style={{
                      position: "absolute", top: 10, left: 10,
                      width: 22, height: 22, borderRadius: 6, cursor: "pointer",
                      border: selected.has(ad.id) ? `2px solid ${C.accent}` : "2px solid rgba(255,255,255,0.3)",
                      background: selected.has(ad.id) ? C.accent : "rgba(0,0,0,0.3)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, color: "#fff", fontWeight: 700,
                      opacity: hovered === ad.id || selected.has(ad.id) ? 1 : 0,
                      transition: "opacity 0.15s",
                    }}>{selected.has(ad.id) ? "v" : ""}</div>

                  {/* Favorite */}
                  {ad.favorite && (
                    <div style={{
                      position: "absolute", top: 10, right: 10,
                      fontSize: 14, color: C.yellow, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
                    }}>*</div>
                  )}

                  {/* Hover overlay */}
                  <div style={{
                    position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    opacity: hovered === ad.id ? 1 : 0, transition: "opacity 0.2s",
                  }}>
                    <button onClick={() => setDetailAd(ad)} style={{
                      padding: "8px 18px", borderRadius: 8, border: "none",
                      background: grad, color: "#fff", fontSize: 12, fontWeight: 600,
                      fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                    }}>View</button>
                    <button style={{
                      padding: "8px 14px", borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.3)",
                      background: "rgba(255,255,255,0.1)", color: "#fff",
                      fontSize: 12, fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                    }}>DL</button>
                  </div>

                  {/* Ratio badges */}
                  <div style={{ position: "absolute", bottom: 8, left: 8, display: "flex", gap: 4 }}>
                    {ad.ratios.map(r => (
                      <span key={r} style={{
                        padding: "2px 7px", borderRadius: 4, fontSize: 9,
                        background: "rgba(0,0,0,0.5)", color: "rgba(255,255,255,0.7)", fontWeight: 600,
                      }}>{r}</span>
                    ))}
                  </div>

                  {/* Canva badge */}
                  {ad.canva !== "none" && (
                    <div style={{
                      position: "absolute", bottom: 8, right: 8,
                      padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 600,
                      background: CANVA_LABELS[ad.canva].bg,
                      color: CANVA_LABELS[ad.canva].color,
                    }}>{CANVA_LABELS[ad.canva].label}</div>
                  )}
                </div>

                {/* Info */}
                <div style={{ padding: "12px 14px" }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, marginBottom: 4, lineHeight: 1.3,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{ad.name}</div>
                  <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>{ad.product}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 5,
                      background: `${C.g1}15`, color: C.g1, fontWeight: 600,
                    }}>{ad.concept}</span>
                    <span style={{ fontSize: 10, color: C.dim }}>{ad.date}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== LIST VIEW ===== */}
        {viewMode === "list" && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            {/* Header row */}
            <div style={{
              display: "grid", gridTemplateColumns: "36px 1fr 140px 120px 100px 90px 80px",
              gap: 12, padding: "10px 14px", marginBottom: 4,
              fontSize: 11, color: C.dim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
            }}>
              <span></span><span>Ad Name</span><span>Concept</span><span>Date</span><span>Ratios</span><span>Canva</span><span></span>
            </div>

            {filtered.map((ad, i) => (
              <div key={ad.id}
                onMouseEnter={() => setHovered(ad.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: "grid", gridTemplateColumns: "36px 1fr 140px 120px 100px 90px 80px",
                  gap: 12, alignItems: "center", padding: "12px 14px",
                  borderRadius: 10, marginBottom: 4, cursor: "pointer",
                  background: selected.has(ad.id) ? gradBg("10") : hovered === ad.id ? C.bgHover : C.bgCard,
                  border: `1px solid ${selected.has(ad.id) ? C.accent + "44" : C.border}`,
                  transition: "all 0.15s",
                }}>
                {/* Checkbox */}
                <div onClick={(e) => { e.stopPropagation(); toggleSelect(ad.id); }}
                  style={{
                    width: 20, height: 20, borderRadius: 5, cursor: "pointer",
                    border: selected.has(ad.id) ? `2px solid ${C.accent}` : `2px solid ${C.border}`,
                    background: selected.has(ad.id) ? C.accent : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, color: "#fff", fontWeight: 700,
                  }}>{selected.has(ad.id) ? "v" : ""}</div>

                {/* Name + product */}
                <div onClick={() => setDetailAd(ad)}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{ad.name}</div>
                  <div style={{ fontSize: 11, color: C.dim }}>{ad.product} - {ad.brand}</div>
                </div>

                {/* Concept */}
                <span style={{
                  fontSize: 11, padding: "3px 10px", borderRadius: 6, fontWeight: 600,
                  background: `${C.g1}15`, color: C.g1, display: "inline-block", width: "fit-content",
                }}>{ad.concept}</span>

                {/* Date */}
                <span style={{ fontSize: 12, color: C.muted }}>{ad.date}</span>

                {/* Ratios */}
                <div style={{ display: "flex", gap: 4 }}>
                  {ad.ratios.map(r => (
                    <span key={r} style={{
                      padding: "2px 6px", borderRadius: 4, fontSize: 9,
                      background: C.bgInput, border: `1px solid ${C.border}`,
                      color: C.muted, fontWeight: 600,
                    }}>{r}</span>
                  ))}
                </div>

                {/* Canva */}
                <span style={{
                  fontSize: 10, padding: "3px 8px", borderRadius: 5, fontWeight: 600,
                  color: CANVA_LABELS[ad.canva].color,
                  background: ad.canva !== "none" ? CANVA_LABELS[ad.canva].bg : "transparent",
                }}>{CANVA_LABELS[ad.canva].label}</span>

                {/* Actions */}
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button style={{
                    padding: "5px 10px", borderRadius: 6, border: `1px solid ${C.border}`,
                    background: "transparent", color: C.muted, cursor: "pointer",
                    fontSize: 11, fontFamily: "'DM Sans', sans-serif",
                  }}>DL</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {filtered.length === 0 && (
          <div style={{
            textAlign: "center", padding: "80px 0",
            animation: "fadeUp 0.4s ease",
          }}>
            <div style={{ fontSize: 40, opacity: 0.15, marginBottom: 16 }}>0</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No ads found</div>
            <div style={{ fontSize: 13, color: C.dim, marginBottom: 24 }}>Try adjusting your filters or generate some new ads.</div>
            <button style={{
              padding: "12px 28px", borderRadius: 10, border: "none", cursor: "pointer",
              background: grad, color: "#fff", fontSize: 14, fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
            }}>Generate New Ad</button>
          </div>
        )}
      </div>

      {/* ===== DETAIL SLIDE-OVER ===== */}
      {detailAd && (
        <div style={{
          position: "fixed", top: 0, right: 0, width: 440, height: "100vh",
          background: C.bgCard, borderLeft: `1px solid ${C.border}`,
          zIndex: 100, overflowY: "auto", padding: 28,
          animation: "slideRight 0.25s ease",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.4)",
        }}>
          {/* Close */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>Ad Details</span>
            <div onClick={() => setDetailAd(null)} style={{
              width: 32, height: 32, borderRadius: 8, cursor: "pointer",
              background: C.bgInput, border: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, color: C.dim,
            }}>x</div>
          </div>

          {/* Preview */}
          <div style={{
            height: 280, borderRadius: 14, marginBottom: 20, overflow: "hidden",
            background: `linear-gradient(135deg, ${BG[detailAd.id % 8]}dd, ${BG[(detailAd.id + 4) % 8]}aa)`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 32, opacity: 0.12, fontWeight: 700 }}>AD</span>
          </div>

          {/* Name */}
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{detailAd.name}</div>
          <div style={{ fontSize: 13, color: C.dim, marginBottom: 20 }}>{detailAd.product} - {detailAd.brand}</div>

          {/* Meta */}
          <div style={{
            padding: 16, borderRadius: 12, background: C.bgInput,
            border: `1px solid ${C.border}`, marginBottom: 20,
          }}>
            {[
              { label: "Concept", value: detailAd.concept },
              { label: "Created", value: detailAd.date },
              { label: "Ratios", value: detailAd.ratios.join(", ") },
              { label: "Canva", value: CANVA_LABELS[detailAd.canva].label },
            ].map(({ label, value }) => (
              <div key={label} style={{
                display: "flex", justifyContent: "space-between", padding: "8px 0",
                borderBottom: `1px solid ${C.border}`,
              }}>
                <span style={{ fontSize: 13, color: C.dim }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button style={{
              padding: "12px 0", borderRadius: 10, border: "none", cursor: "pointer",
              background: grad, color: "#fff", fontSize: 14, fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif", width: "100%",
            }}>Download Ad</button>

            {detailAd.ratios.length < 3 && (
              <button style={{
                padding: "12px 0", borderRadius: 10, cursor: "pointer", width: "100%",
                border: `1px solid ${C.accent}44`, background: `${C.accent}10`,
                color: C.accent, fontSize: 13, fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
              }}>Get All Ratios (1:1, 9:16, 16:9)</button>
            )}

            {detailAd.canva === "none" && (
              <button style={{
                padding: "12px 0", borderRadius: 10, cursor: "pointer", width: "100%",
                border: `1px solid ${C.yellow}44`, background: `${C.yellow}10`,
                color: C.yellow, fontSize: 13, fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
              }}>Buy Canva Template - $15</button>
            )}

            {detailAd.canva === "available" && (
              <button style={{
                padding: "12px 0", borderRadius: 10, cursor: "pointer", width: "100%",
                border: `1px solid ${C.green}44`, background: `${C.green}10`,
                color: C.green, fontSize: 13, fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
              }}>Open Canva Template</button>
            )}

            {detailAd.canva === "pending" && (
              <div style={{
                padding: "12px 0", borderRadius: 10, textAlign: "center",
                border: `1px solid ${C.yellow}33`, background: `${C.yellow}08`,
                color: C.yellow, fontSize: 13, fontWeight: 500,
              }}>Canva template in progress (est. 2 days)</div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button style={{
                flex: 1, padding: "10px 0", borderRadius: 10, cursor: "pointer",
                border: `1px solid ${C.border}`, background: "transparent",
                color: C.muted, fontSize: 12, fontWeight: 500,
                fontFamily: "'DM Sans', sans-serif",
              }}>Regenerate Similar</button>
              <button style={{
                flex: 1, padding: "10px 0", borderRadius: 10, cursor: "pointer",
                border: `1px solid ${C.border}`, background: "transparent",
                color: C.muted, fontSize: 12, fontWeight: 500,
                fontFamily: "'DM Sans', sans-serif",
              }}>Move to Folder</button>
            </div>

            <button style={{
              padding: "10px 0", borderRadius: 10, cursor: "pointer", width: "100%",
              border: `1px solid ${C.red}33`, background: "transparent",
              color: C.red, fontSize: 12, fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif", marginTop: 8,
            }}>Delete Ad</button>
          </div>
        </div>
      )}

      {/* Overlay when detail open */}
      {detailAd && (
        <div onClick={() => setDetailAd(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          zIndex: 99,
        }} />
      )}
    </div>
  );
}
