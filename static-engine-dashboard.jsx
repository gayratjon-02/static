import { useState } from "react";

const C = {
  bg: "#0B0E1A", bgCard: "#111528", bgHover: "#181D35", bgInput: "#0D1020",
  border: "#1E2340", text: "#E8EAF0", muted: "#6B7194", dim: "#4A5072",
  accent: "#3ECFCF", g1: "#3B82F6", g2: "#3ECFCF",
  red: "#EF4444", green: "#22C55E", yellow: "#F59E0B",
};

const grad = `linear-gradient(135deg, ${C.g1}, ${C.g2})`;
const gradBg = (o) => `linear-gradient(135deg, ${C.g1}${o}, ${C.g2}${o})`;
const BG = ["#1a3a4a", "#2a1a3a", "#1a2a3a", "#3a2a1a", "#1a3a2a", "#2a3a1a"];

const ADS = [
  { id: 1, name: "Bron Deodorant - Feature Pointers", brand: "Bron", date: "2 hours ago", ratios: ["1:1"] },
  { id: 2, name: "Bron Deodorant - Testimonial", brand: "Bron", date: "Yesterday", ratios: ["1:1", "9:16", "16:9"] },
  { id: 3, name: "Fairway Fuel - Social Proof", brand: "Fairway Fuel", date: "2 days ago", ratios: ["1:1", "9:16"] },
  { id: 4, name: "Bron Makeup - Before & After", brand: "Bron", date: "3 days ago", ratios: ["1:1"] },
  { id: 5, name: "Fairway Fuel - Stat Callout", brand: "Fairway Fuel", date: "4 days ago", ratios: ["1:1", "16:9"] },
  { id: 6, name: "Bron Deodorant - Us vs Them", brand: "Bron", date: "5 days ago", ratios: ["1:1"] },
];

const ACTIVITY = [
  { action: "Generated 6 ads", detail: "Bron Deodorant - Feature Pointers", time: "2h ago", letter: "G" },
  { action: "Saved variation #3", detail: "Bron Deodorant - Testimonial", time: "1d ago", letter: "S" },
  { action: "Exported all ratios", detail: "Fairway Fuel - Social Proof", time: "2d ago", letter: "E" },
  { action: "Bought Canva template", detail: "Bron Makeup - Before & After", time: "3d ago", letter: "C" },
  { action: "Created new product", detail: "Fairway Fuel Pre-Round Chews", time: "4d ago", letter: "P" },
];

export default function Dashboard() {
  const [brand, setBrand] = useState("all");
  const [hovered, setHovered] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [page, setPage] = useState("dashboard");

  const remaining = 565;
  const limit = 750;
  const pct = (remaining / limit) * 100;
  const filtered = brand === "all" ? ADS : ADS.filter(a => a.brand.toLowerCase().includes(brand));
  const sw = collapsed ? 72 : 240;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        * { box-sizing: border-box; }
      `}</style>

      {/* ===== SIDEBAR ===== */}
      <div style={{
        width: sw, minHeight: "100vh", background: C.bgCard,
        borderRight: `1px solid ${C.border}`,
        display: "flex", flexDirection: "column",
        position: "fixed", left: 0, top: 0, zIndex: 50,
        transition: "width 0.25s ease", overflow: "hidden",
      }}>
        {/* Logo */}
        <div style={{
          padding: collapsed ? "20px 12px" : "20px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          height: 68,
        }}>
          {collapsed ? (
            <div onClick={() => setCollapsed(false)} style={{
              width: 34, height: 34, borderRadius: 10, background: grad, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 700, color: "#fff",
            }}>S</div>
          ) : (
            <>
              <span style={{
                fontSize: 20, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
                background: grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>Static Engine</span>
              <div onClick={() => setCollapsed(true)} style={{
                width: 26, height: 26, borderRadius: 7, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: C.bgInput, border: `1px solid ${C.border}`, color: C.dim, fontSize: 13,
              }}>&laquo;</div>
            </>
          )}
        </div>

        {/* Nav */}
        <div style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
          {[
            { id: "dashboard", label: "Dashboard", letter: "D" },
            { id: "generate", label: "Generate Ads", letter: "+", badge: "NEW" },
            { id: "library", label: "Ad Library", letter: "L" },
            { id: "brands", label: "Brands", letter: "B" },
            { id: "canva", label: "Canva Templates", letter: "C" },
          ].map(item => (
            <div key={item.id} onClick={() => setPage(item.id)} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: collapsed ? "11px 0" : "11px 14px",
              justifyContent: collapsed ? "center" : "flex-start",
              borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
              background: page === item.id ? gradBg("18") : "transparent",
              border: page === item.id ? `1px solid ${C.accent}33` : "1px solid transparent",
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, flexShrink: 0,
                background: page === item.id ? grad : C.bgInput,
                color: page === item.id ? "#fff" : C.dim,
                border: page === item.id ? "none" : `1px solid ${C.border}`,
              }}>{item.letter}</div>
              {!collapsed && (
                <span style={{
                  fontSize: 14, flex: 1,
                  fontWeight: page === item.id ? 600 : 400,
                  color: page === item.id ? C.text : C.muted,
                }}>{item.label}</span>
              )}
              {!collapsed && item.badge && (
                <span style={{
                  padding: "2px 8px", borderRadius: 6, fontSize: 10,
                  background: grad, color: "#fff", fontWeight: 700,
                }}>{item.badge}</span>
              )}
            </div>
          ))}

          <div style={{ flex: 1 }} />

          {/* Credits */}
          {!collapsed && (
            <div style={{
              margin: "0 6px 12px", padding: 16, borderRadius: 12,
              background: C.bgInput, border: `1px solid ${C.border}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: C.dim, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>Credits</span>
                <span style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>Pro</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 10 }}>
                <span style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>{remaining}</span>
                <span style={{ fontSize: 13, color: C.dim }}>/ {limit}</span>
              </div>
              <div style={{ width: "100%", height: 6, background: C.border, borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: grad }} />
              </div>
              <div style={{ fontSize: 11, color: C.dim }}>Renews in 18 days</div>
            </div>
          )}

          {/* Bottom nav */}
          {[
            { id: "account", label: "Account", letter: "A" },
            { id: "billing", label: "Billing", letter: "$" },
          ].map(item => (
            <div key={item.id} onClick={() => setPage(item.id)} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: collapsed ? "10px 0" : "10px 14px",
              justifyContent: collapsed ? "center" : "flex-start",
              borderRadius: 10, cursor: "pointer",
            }}>
              <span style={{ fontSize: 13, width: 28, textAlign: "center", color: C.dim, fontWeight: 600 }}>{item.letter}</span>
              {!collapsed && <span style={{ fontSize: 13, color: C.dim }}>{item.label}</span>}
            </div>
          ))}
        </div>

        {/* User */}
        <div style={{
          padding: collapsed ? "16px 0" : "16px",
          borderTop: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", gap: 10,
          justifyContent: collapsed ? "center" : "flex-start",
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, background: grad, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: "#fff",
          }}>B</div>
          {!collapsed && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Ben</div>
              <div style={{ fontSize: 11, color: C.dim }}>Pro Plan</div>
            </div>
          )}
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div style={{ flex: 1, marginLeft: sw, transition: "margin-left 0.25s ease", padding: "0 40px 60px" }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "28px 0", borderBottom: `1px solid ${C.border}`, marginBottom: 32,
        }}>
          <div>
            <div style={{ fontSize: 13, color: C.dim, marginBottom: 4 }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>
              Welcome back, Ben
            </div>
          </div>
          <button style={{
            padding: "14px 32px", borderRadius: 12, border: "none", cursor: "pointer",
            background: grad, color: "#fff", fontSize: 15, fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: `0 4px 24px ${C.accent}33`,
          }}>+ Generate New Ad</button>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32, animation: "fadeUp 0.4s ease" }}>
          {[
            { label: "CREDITS LEFT", val: String(remaining), sub: `of ${limit}`, color: C.accent, bar: pct },
            { label: "ADS GENERATED", val: "37", sub: "this cycle", color: C.g1, trend: "+12 vs last month" },
            { label: "ADS SAVED", val: "24", sub: "across 2 brands", color: C.green, trend: null },
            { label: "CANVA TEMPLATES", val: "3", sub: "1 pending", color: C.yellow, trend: null },
          ].map((s, i) => (
            <div key={i} style={{
              padding: 22, borderRadius: 14, background: C.bgCard, border: `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: 11, color: C.dim, fontWeight: 600, letterSpacing: "0.06em", marginBottom: 12 }}>{s.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 34, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: s.color }}>{s.val}</span>
                <span style={{ fontSize: 12, color: C.dim }}>{s.sub}</span>
              </div>
              {s.bar != null && (
                <div style={{ width: "100%", height: 4, background: C.border, borderRadius: 2, overflow: "hidden", marginTop: 14 }}>
                  <div style={{ width: `${s.bar}%`, height: "100%", borderRadius: 2, background: grad }} />
                </div>
              )}
              {s.trend && <div style={{ fontSize: 12, color: C.green, marginTop: 10, fontWeight: 500 }}>{s.trend}</div>}
            </div>
          ))}
        </div>

        {/* Grid: Ads + Sidebar */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>

          {/* Recent Ads */}
          <div style={{ animation: "fadeUp 0.5s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>Recent Ads</span>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { id: "all", label: "All", color: C.accent },
                  { id: "bron", label: "Bron", color: "#3ECFCF" },
                  { id: "fairway", label: "Fairway Fuel", color: "#22C55E" },
                ].map(b => (
                  <button key={b.id} onClick={() => setBrand(b.id)} style={{
                    padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontSize: 12, fontWeight: 500, fontFamily: "'DM Sans', sans-serif",
                    background: brand === b.id ? `${b.color}22` : C.bgCard,
                    color: brand === b.id ? b.color : C.dim,
                  }}>{b.label}</button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {filtered.slice(0, 6).map((ad, i) => (
                <div key={ad.id}
                  onMouseEnter={() => setHovered(ad.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    borderRadius: 14, overflow: "hidden", cursor: "pointer",
                    background: C.bgCard, border: `1px solid ${C.border}`,
                    transition: "transform 0.2s, box-shadow 0.2s",
                    transform: hovered === ad.id ? "translateY(-3px)" : "none",
                    boxShadow: hovered === ad.id ? "0 8px 30px rgba(0,0,0,0.3)" : "none",
                  }}>
                  <div style={{
                    height: 150, position: "relative",
                    background: `linear-gradient(135deg, ${BG[i % 6]}dd, ${BG[(i + 3) % 6]}aa)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 28, opacity: 0.15, fontWeight: 700 }}>AD</span>
                    <div style={{
                      position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      opacity: hovered === ad.id ? 1 : 0, transition: "opacity 0.2s",
                    }}>
                      <button style={{
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
                    <div style={{ position: "absolute", bottom: 8, left: 8, display: "flex", gap: 4 }}>
                      {ad.ratios.map(r => (
                        <span key={r} style={{
                          padding: "2px 7px", borderRadius: 4, fontSize: 9,
                          background: "rgba(0,0,0,0.5)", color: "rgba(255,255,255,0.7)", fontWeight: 600,
                        }}>{r}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ padding: "12px 14px" }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, marginBottom: 4, lineHeight: 1.3,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{ad.name}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: C.dim }}>{ad.date}</span>
                      <span style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 6, fontWeight: 600,
                        background: ad.brand === "Bron" ? "#3ECFCF18" : "#22C55E18",
                        color: ad.brand === "Bron" ? "#3ECFCF" : "#22C55E",
                      }}>{ad.brand}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              width: "100%", padding: "12px 0", marginTop: 14, borderRadius: 10,
              border: `1px dashed ${C.border}`, background: "transparent",
              color: C.muted, textAlign: "center", cursor: "pointer",
              fontSize: 13, fontWeight: 500,
            }}>View all ads in library</div>
          </div>

          {/* Right sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18, animation: "fadeUp 0.6s ease" }}>

            {/* Quick Actions */}
            <div style={{ padding: 20, borderRadius: 14, background: C.bgCard, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.dim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
                Quick Actions
              </div>
              {[
                { label: "Generate New Ad", desc: "5 credits per generation", letter: "+", primary: true },
                { label: "Create New Brand", desc: "Set up a brand profile", letter: "B", primary: false },
                { label: "Buy More Credits", desc: "100 credits for $15", letter: "$", primary: false },
              ].map((a, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                  marginBottom: i < 2 ? 6 : 0,
                  background: a.primary ? gradBg("12") : "transparent",
                  border: a.primary ? `1px solid ${C.accent}33` : "1px solid transparent",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: a.primary ? grad : C.bgInput,
                    border: a.primary ? "none" : `1px solid ${C.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, fontWeight: 700, color: a.primary ? "#fff" : C.muted,
                  }}>{a.letter}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: a.primary ? C.text : C.muted }}>{a.label}</div>
                    <div style={{ fontSize: 11, color: C.dim }}>{a.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Activity */}
            <div style={{ padding: 20, borderRadius: 14, background: C.bgCard, border: `1px solid ${C.border}`, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.dim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
                Recent Activity
              </div>
              {ACTIVITY.map((item, i) => (
                <div key={i} style={{
                  display: "flex", gap: 12, padding: "10px 0",
                  borderBottom: i < ACTIVITY.length - 1 ? `1px solid ${C.border}` : "none",
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: C.bgInput, border: `1px solid ${C.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, color: C.dim,
                  }}>{item.letter}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{item.action}</div>
                    <div style={{ fontSize: 11, color: C.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.detail}</div>
                  </div>
                  <span style={{ fontSize: 10, color: C.dim, whiteSpace: "nowrap", paddingTop: 3 }}>{item.time}</span>
                </div>
              ))}
            </div>

            {/* Tip */}
            <div style={{ padding: 20, borderRadius: 14, background: gradBg("10"), border: `1px solid ${C.accent}22` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                Tip of the day
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, lineHeight: 1.4 }}>
                Try "Feature Pointers" for supplements
              </div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginBottom: 14 }}>
                Brands in your space see 2.3x higher CTR with feature pointer ads that highlight specific product benefits.
              </div>
              <button style={{
                padding: "8px 18px", borderRadius: 8, border: `1px solid ${C.accent}44`,
                background: "transparent", color: C.accent, cursor: "pointer",
                fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
              }}>Try this concept</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
