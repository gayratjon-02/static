import { useState, useEffect, useRef } from "react";

const COLORS = {
  bg: "#0B0E1A",
  bgCard: "#111528",
  bgHover: "#181D35",
  bgInput: "#0D1020",
  border: "#1E2340",
  borderFocus: "#3ECFCF",
  text: "#E8EAF0",
  textMuted: "#6B7194",
  textDim: "#4A5072",
  accent: "#3ECFCF",
  accentHover: "#5EDDDD",
  gradient1: "#3B82F6",
  gradient2: "#3ECFCF",
  danger: "#EF4444",
  success: "#22C55E",
  warning: "#F59E0B",
};

const CATEGORIES = [
  "All", "Feature Pointers", "Testimonial", "Before & After", "Us vs Them",
  "Lifestyle", "Stat Callout", "Social Proof", "Offer / Promo",
  "Problem → Solution", "Comparison Chart", "Ingredient Spotlight"
];

const INDUSTRIES = [
  "E-commerce", "Supplements", "Apparel", "Beauty", "Food & Beverage",
  "SaaS", "Fitness", "Home Goods", "Pets", "Financial Services", "Education", "Other"
];

const VOICE_TAGS = [
  "Professional", "Playful", "Bold", "Minimalist", "Luxurious",
  "Friendly", "Edgy", "Trustworthy", "Youthful", "Authoritative"
];

// Mock concept images
const MOCK_CONCEPTS = Array.from({ length: 24 }, (_, i) => ({
  id: i + 1,
  category: CATEGORIES[1 + (i % (CATEGORIES.length - 1))],
  name: `Concept ${i + 1}`,
  usageCount: Math.floor(Math.random() * 500) + 50,
  popular: i < 4,
}));

// Simulated generated ad placeholders
const AD_COLORS = ["#1a3a4a", "#2a1a3a", "#1a2a3a", "#3a2a1a", "#1a3a2a", "#2a3a1a"];

export default function StaticEngine() {
  const [step, setStep] = useState(0); // 0=brand, 1=product, 2=concept, 3=notes, 4=generating, 5=results
  const [brand, setBrand] = useState({
    name: "", description: "", url: "", industry: "",
    logo: null, logoPreview: null,
    primaryColor: "#3ECFCF", secondaryColor: "#3B82F6", accentColor: "#E94560",
    voiceTags: [], targetAudience: "", competitors: ""
  });
  const [product, setProduct] = useState({
    name: "", description: "", usps: ["", "", ""],
    photo: null, photoPreview: null,
    noPhysicalProduct: false, price: "", productUrl: "",
    starRating: "", reviewCount: "", offer: ""
  });
  const [selectedConcept, setSelectedConcept] = useState(null);
  const [conceptFilter, setConceptFilter] = useState("All");
  const [notes, setNotes] = useState("");
  const [generatingAds, setGeneratingAds] = useState([false, false, false, false, false, false]);
  const [completedAds, setCompletedAds] = useState([false, false, false, false, false, false]);
  const [savedAds, setSavedAds] = useState([false, false, false, false, false, false]);
  const [existingBrands] = useState([
    { id: 1, name: "Bron", color: "#3ECFCF" },
    { id: 2, name: "Fairway Fuel", color: "#22C55E" },
  ]);
  const [showBrandSelector, setShowBrandSelector] = useState(true);
  const [credits] = useState({ used: 185, limit: 750 });
  const fileInputRef = useRef(null);
  const productFileRef = useRef(null);

  const steps = [
    { label: "Brand", icon: "◆" },
    { label: "Product", icon: "◇" },
    { label: "Concept", icon: "▣" },
    { label: "Notes", icon: "✎" },
    { label: "Generate", icon: "⚡" },
  ];

  // Simulate generation
  const startGeneration = () => {
    setStep(4);
    setGeneratingAds([true, true, true, true, true, true]);
    setCompletedAds([false, false, false, false, false, false]);
    setSavedAds([false, false, false, false, false, false]);

    [1200, 2800, 4200, 5800, 7500, 9000].forEach((delay, i) => {
      setTimeout(() => {
        setGeneratingAds(prev => { const n = [...prev]; n[i] = false; return n; });
        setCompletedAds(prev => { const n = [...prev]; n[i] = true; return n; });
        if (i === 5) setTimeout(() => setStep(5), 300);
      }, delay);
    });
  };

  const toggleVoiceTag = (tag) => {
    setBrand(prev => ({
      ...prev,
      voiceTags: prev.voiceTags.includes(tag)
        ? prev.voiceTags.filter(t => t !== tag)
        : [...prev.voiceTags, tag]
    }));
  };

  const addUsp = () => {
    if (product.usps.length < 5) {
      setProduct(prev => ({ ...prev, usps: [...prev.usps, ""] }));
    }
  };

  const removeUsp = (index) => {
    if (product.usps.length > 1) {
      setProduct(prev => ({ ...prev, usps: prev.usps.filter((_, i) => i !== index) }));
    }
  };

  const updateUsp = (index, value) => {
    setProduct(prev => ({
      ...prev,
      usps: prev.usps.map((u, i) => i === index ? value : u)
    }));
  };

  const filteredConcepts = conceptFilter === "All"
    ? MOCK_CONCEPTS
    : MOCK_CONCEPTS.filter(c => c.category === conceptFilter);

  const inputStyle = {
    width: "100%", padding: "12px 16px", background: COLORS.bgInput,
    border: `1px solid ${COLORS.border}`, borderRadius: 10, color: COLORS.text,
    fontSize: 14, outline: "none", fontFamily: "'DM Sans', sans-serif",
    transition: "border-color 0.2s",
  };

  const labelStyle = {
    display: "block", fontSize: 13, fontWeight: 600, color: COLORS.textMuted,
    marginBottom: 6, letterSpacing: "0.03em", textTransform: "uppercase",
  };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />

      {/* Top Bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 32px", borderBottom: `1px solid ${COLORS.border}`,
        background: "rgba(11,14,26,0.9)", backdropFilter: "blur(20px)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            fontSize: 22, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
            background: `linear-gradient(135deg, ${COLORS.gradient1}, ${COLORS.gradient2})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Static Engine
          </div>
          <div style={{
            fontSize: 10, padding: "3px 8px", borderRadius: 6,
            background: `linear-gradient(135deg, ${COLORS.gradient1}22, ${COLORS.gradient2}22)`,
            color: COLORS.accent, fontWeight: 600, letterSpacing: "0.05em",
          }}>BETA</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>Credits</div>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: COLORS.bgCard, padding: "6px 14px", borderRadius: 8,
              border: `1px solid ${COLORS.border}`,
            }}>
              <div style={{
                width: 80, height: 6, background: COLORS.border, borderRadius: 3, overflow: "hidden",
              }}>
                <div style={{
                  width: `${((credits.limit - credits.used) / credits.limit) * 100}%`,
                  height: "100%", borderRadius: 3,
                  background: `linear-gradient(90deg, ${COLORS.gradient1}, ${COLORS.gradient2})`,
                }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
                {credits.limit - credits.used}
              </span>
              <span style={{ fontSize: 11, color: COLORS.textDim }}>/ {credits.limit}</span>
            </div>
          </div>

          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: `linear-gradient(135deg, ${COLORS.gradient1}, ${COLORS.gradient2})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}>B</div>
        </div>
      </div>

      {/* Step Indicator */}
      {step < 5 && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 0, padding: "28px 32px 20px",
        }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center" }}>
              <div
                onClick={() => { if (i < step) setStep(i); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 18px", borderRadius: 10, cursor: i < step ? "pointer" : "default",
                  background: i === step ? `linear-gradient(135deg, ${COLORS.gradient1}22, ${COLORS.gradient2}22)` :
                    i < step ? "transparent" : "transparent",
                  border: i === step ? `1px solid ${COLORS.accent}44` : "1px solid transparent",
                  transition: "all 0.3s",
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 8, display: "flex",
                  alignItems: "center", justifyContent: "center", fontSize: 12,
                  background: i < step ? COLORS.accent :
                    i === step ? `linear-gradient(135deg, ${COLORS.gradient1}, ${COLORS.gradient2})` : COLORS.bgCard,
                  color: i <= step ? "#fff" : COLORS.textDim,
                  fontWeight: 700, transition: "all 0.3s",
                }}>
                  {i < step ? "✓" : i + 1}
                </div>
                <span style={{
                  fontSize: 13, fontWeight: i === step ? 600 : 400,
                  color: i === step ? COLORS.text : i < step ? COLORS.accent : COLORS.textDim,
                }}>{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div style={{
                  width: 40, height: 1, margin: "0 4px",
                  background: i < step ? COLORS.accent : COLORS.border,
                  transition: "background 0.3s",
                }} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div style={{ maxWidth: step === 2 ? 1100 : step >= 4 ? 1200 : 680, margin: "0 auto", padding: "0 32px 60px" }}>

        {/* ══════ STEP 0: BRAND ══════ */}
        {step === 0 && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>

            {showBrandSelector && (
              <div style={{
                background: COLORS.bgCard, borderRadius: 16, padding: 28,
                border: `1px solid ${COLORS.border}`, marginBottom: 24,
              }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Select an existing brand</div>
                <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                  {existingBrands.map(b => (
                    <div key={b.id} onClick={() => { setBrand(prev => ({ ...prev, name: b.name })); setStep(1); }}
                      style={{
                        padding: "14px 24px", borderRadius: 12, cursor: "pointer",
                        background: COLORS.bgInput, border: `1px solid ${COLORS.border}`,
                        display: "flex", alignItems: "center", gap: 10,
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = b.color; e.currentTarget.style.background = COLORS.bgHover; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.background = COLORS.bgInput; }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: `${b.color}33`, display: "flex",
                        alignItems: "center", justifyContent: "center",
                        fontSize: 14, fontWeight: 700, color: b.color,
                      }}>{b.name[0]}</div>
                      <span style={{ fontWeight: 500 }}>{b.name}</span>
                    </div>
                  ))}
                </div>
                <div
                  onClick={() => setShowBrandSelector(false)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    color: COLORS.textDim, fontSize: 13, cursor: "pointer",
                    padding: "8px 0", marginTop: 4,
                  }}
                  onMouseEnter={e => { e.currentTarget.querySelector('span').style.color = COLORS.accent; }}
                  onMouseLeave={e => { e.currentTarget.querySelector('span').style.color = COLORS.textDim; }}
                >
                  <div style={{ flex: 1, height: 1, background: COLORS.border }} />
                  <span style={{ transition: "color 0.2s" }}>or create new +</span>
                  <div style={{ flex: 1, height: 1, background: COLORS.border }} />
                </div>
              </div>
            )}

            {!showBrandSelector && (
            <div style={{
              background: COLORS.bgCard, borderRadius: 16, padding: 32,
              border: `1px solid ${COLORS.border}`,
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, fontFamily: "'Space Grotesk', sans-serif" }}>
                Create Brand Profile
              </div>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 28 }}>
                Your brand details power the AI to create on-brand ads.
              </div>

              {/* Brand Identity */}
              <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.accent, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ opacity: 0.6 }}>01</span> Brand Identity
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={labelStyle}>Brand Name *</label>
                  <input style={inputStyle} placeholder="e.g., Bron" value={brand.name}
                    onChange={e => setBrand(p => ({ ...p, name: e.target.value }))}
                    onFocus={e => e.target.style.borderColor = COLORS.borderFocus}
                    onBlur={e => e.target.style.borderColor = COLORS.border} />
                </div>
                <div>
                  <label style={labelStyle}>Industry *</label>
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={brand.industry}
                    onChange={e => setBrand(p => ({ ...p, industry: e.target.value }))}>
                    <option value="">Select industry</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Brand Description *</label>
                <textarea style={{ ...inputStyle, height: 80, resize: "vertical" }}
                  placeholder="What does your brand do? Who does it serve?"
                  value={brand.description}
                  onChange={e => setBrand(p => ({ ...p, description: e.target.value }))}
                  onFocus={e => e.target.style.borderColor = COLORS.borderFocus}
                  onBlur={e => e.target.style.borderColor = COLORS.border} />
                <div style={{ textAlign: "right", fontSize: 11, color: COLORS.textDim, marginTop: 4 }}>
                  {brand.description.length}/500
                </div>
              </div>

              <div style={{ marginBottom: 28 }}>
                <label style={labelStyle}>Website URL *</label>
                <input style={inputStyle} placeholder="https://yourbrand.com" value={brand.url}
                  onChange={e => setBrand(p => ({ ...p, url: e.target.value }))}
                  onFocus={e => e.target.style.borderColor = COLORS.borderFocus}
                  onBlur={e => e.target.style.borderColor = COLORS.border} />
              </div>

              {/* Brand Visuals */}
              <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.accent, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ opacity: 0.6 }}>02</span> Brand Visuals
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Logo (PNG) *</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${COLORS.border}`, borderRadius: 12, padding: 32,
                    textAlign: "center", cursor: "pointer", transition: "all 0.2s",
                    background: brand.logoPreview ? `url(${brand.logoPreview}) center/contain no-repeat` : "transparent",
                    minHeight: brand.logoPreview ? 120 : "auto",
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = COLORS.accent}
                  onMouseLeave={e => e.currentTarget.style.borderColor = COLORS.border}
                >
                  {!brand.logoPreview && (
                    <>
                      <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>⬆</div>
                      <div style={{ fontSize: 13, color: COLORS.textMuted }}>Click to upload PNG logo</div>
                      <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 4 }}>Transparent background preferred · Max 5MB</div>
                    </>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept=".png" style={{ display: "none" }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      setBrand(p => ({ ...p, logo: file, logoPreview: url }));
                    }
                  }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 28 }}>
                {[
                  { label: "Primary Color *", key: "primaryColor" },
                  { label: "Secondary Color *", key: "secondaryColor" },
                  { label: "Accent Color", key: "accentColor" },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label style={labelStyle}>{label}</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="color" value={brand[key]}
                        onChange={e => setBrand(p => ({ ...p, [key]: e.target.value }))}
                        style={{ width: 40, height: 40, border: "none", borderRadius: 8, cursor: "pointer", background: "none" }} />
                      <input style={{ ...inputStyle, flex: 1, fontFamily: "monospace", fontSize: 13 }}
                        value={brand[key]}
                        onChange={e => setBrand(p => ({ ...p, [key]: e.target.value }))} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Brand Voice */}
              <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.accent, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ opacity: 0.6 }}>03</span> Brand Voice
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Voice & Tone *</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {VOICE_TAGS.map(tag => (
                    <div key={tag} onClick={() => toggleVoiceTag(tag)}
                      style={{
                        padding: "7px 16px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                        fontWeight: 500, transition: "all 0.2s",
                        background: brand.voiceTags.includes(tag)
                          ? `linear-gradient(135deg, ${COLORS.gradient1}33, ${COLORS.gradient2}33)` : COLORS.bgInput,
                        border: `1px solid ${brand.voiceTags.includes(tag) ? COLORS.accent : COLORS.border}`,
                        color: brand.voiceTags.includes(tag) ? COLORS.accent : COLORS.textMuted,
                      }}>
                      {tag}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Target Audience *</label>
                <textarea style={{ ...inputStyle, height: 60, resize: "vertical" }}
                  placeholder='e.g., "Men 25-40 interested in grooming who want simple, no-fuss products"'
                  value={brand.targetAudience}
                  onChange={e => setBrand(p => ({ ...p, targetAudience: e.target.value }))}
                  onFocus={e => e.target.style.borderColor = COLORS.borderFocus}
                  onBlur={e => e.target.style.borderColor = COLORS.border} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Competitor Brands (Optional)</label>
                <input style={inputStyle} placeholder="e.g., Harry's, Dollar Shave Club, Manscaped"
                  value={brand.competitors}
                  onChange={e => setBrand(p => ({ ...p, competitors: e.target.value }))}
                  onFocus={e => e.target.style.borderColor = COLORS.borderFocus}
                  onBlur={e => e.target.style.borderColor = COLORS.border} />
              </div>
            </div>
            )}

            {!showBrandSelector && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setStep(1)}
                style={{
                  padding: "14px 36px", borderRadius: 12, border: "none", cursor: "pointer",
                  background: `linear-gradient(135deg, ${COLORS.gradient1}, ${COLORS.gradient2})`,
                  color: "#fff", fontSize: 15, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  boxShadow: `0 4px 20px ${COLORS.accent}33`,
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 6px 28px ${COLORS.accent}55`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 4px 20px ${COLORS.accent}33`; }}
              >
                Next: Add Product →
              </button>
            </div>
            )}
          </div>
        )}

        {/* ══════ STEP 1: PRODUCT ══════ */}
        {step === 1 && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>

            <div style={{
              background: COLORS.bgCard, borderRadius: 16, padding: 32,
              border: `1px solid ${COLORS.border}`,
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, fontFamily: "'Space Grotesk', sans-serif" }}>
                Add Your Product
              </div>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 28 }}>
                Tell us about the product you're advertising.
              </div>

              {/* No Physical Product Toggle */}
              <div style={{
                display: "flex", alignItems: "center", gap: 12, marginBottom: 24,
                padding: "12px 16px", borderRadius: 10, background: COLORS.bgInput,
                border: `1px solid ${COLORS.border}`,
              }}>
                <div onClick={() => setProduct(p => ({ ...p, noPhysicalProduct: !p.noPhysicalProduct }))}
                  style={{
                    width: 44, height: 24, borderRadius: 12, cursor: "pointer",
                    background: product.noPhysicalProduct ? COLORS.accent : COLORS.border,
                    padding: 2, transition: "background 0.2s",
                  }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 10, background: "#fff",
                    transform: product.noPhysicalProduct ? "translateX(20px)" : "translateX(0)",
                    transition: "transform 0.2s",
                  }} />
                </div>
                <span style={{ fontSize: 14, color: COLORS.textMuted }}>No physical product (SaaS, service, digital product)</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={labelStyle}>Product Name *</label>
                  <input style={inputStyle} placeholder="e.g., Bron Deodorant" value={product.name}
                    onChange={e => setProduct(p => ({ ...p, name: e.target.value }))}
                    onFocus={e => e.target.style.borderColor = COLORS.borderFocus}
                    onBlur={e => e.target.style.borderColor = COLORS.border} />
                </div>
                <div>
                  <label style={labelStyle}>Price Point</label>
                  <input style={inputStyle} placeholder="e.g., $29.99" value={product.price}
                    onChange={e => setProduct(p => ({ ...p, price: e.target.value }))}
                    onFocus={e => e.target.style.borderColor = COLORS.borderFocus}
                    onBlur={e => e.target.style.borderColor = COLORS.border} />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Product Description *</label>
                <textarea style={{ ...inputStyle, height: 80, resize: "vertical" }}
                  placeholder="What is it, what does it do, who is it for?"
                  value={product.description}
                  onChange={e => setProduct(p => ({ ...p, description: e.target.value }))}
                  onFocus={e => e.target.style.borderColor = COLORS.borderFocus}
                  onBlur={e => e.target.style.borderColor = COLORS.border} />
              </div>

              {/* USPs */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Unique Selling Points *</label>
                {product.usps.map((usp, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <div style={{
                      width: 28, height: 40, display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: 12, color: COLORS.textDim, fontWeight: 600,
                    }}>{i + 1}</div>
                    <input style={{ ...inputStyle, flex: 1 }}
                      placeholder={`USP ${i + 1}, e.g., "48-hour odor protection"`}
                      value={usp} onChange={e => updateUsp(i, e.target.value)}
                      onFocus={e => e.target.style.borderColor = COLORS.borderFocus}
                      onBlur={e => e.target.style.borderColor = COLORS.border} />
                    {product.usps.length > 1 && (
                      <button onClick={() => removeUsp(i)}
                        style={{
                          width: 40, height: 40, borderRadius: 10, border: `1px solid ${COLORS.border}`,
                          background: "transparent", color: COLORS.danger, cursor: "pointer", fontSize: 16,
                        }}>×</button>
                    )}
                  </div>
                ))}
                {product.usps.length < 5 && (
                  <button onClick={addUsp}
                    style={{
                      padding: "8px 16px", borderRadius: 8, border: `1px dashed ${COLORS.border}`,
                      background: "transparent", color: COLORS.textMuted, cursor: "pointer",
                      fontSize: 13, marginTop: 4,
                    }}>+ Add USP</button>
                )}
              </div>

              {/* Product Photo */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>
                  {product.noPhysicalProduct ? "Hero Image (Optional)" : "Product Photo *"}
                </label>
                <div
                  onClick={() => productFileRef.current?.click()}
                  style={{
                    border: `2px dashed ${COLORS.border}`, borderRadius: 12, padding: 28,
                    textAlign: "center", cursor: "pointer", transition: "all 0.2s",
                    background: product.photoPreview ? `url(${product.photoPreview}) center/contain no-repeat` : "transparent",
                    minHeight: product.photoPreview ? 160 : "auto",
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = COLORS.accent}
                  onMouseLeave={e => e.currentTarget.style.borderColor = COLORS.border}
                >
                  {!product.photoPreview && (
                    <>
                      <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>📷</div>
                      <div style={{ fontSize: 13, color: COLORS.textMuted }}>
                        {product.noPhysicalProduct ? "Upload a screenshot, mockup, or lifestyle image" : "Upload product photo with clean/white background"}
                      </div>
                      <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 4 }}>PNG or JPG · Max 10MB</div>
                    </>
                  )}
                </div>
                <input ref={productFileRef} type="file" accept=".png,.jpg,.jpeg" style={{ display: "none" }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      setProduct(p => ({ ...p, photo: file, photoPreview: url }));
                    }
                  }} />
              </div>

              {/* Optional Fields */}
              <div style={{
                fontSize: 13, fontWeight: 600, color: COLORS.textDim, marginBottom: 12,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <div style={{ flex: 1, height: 1, background: COLORS.border }} />
                <span>OPTIONAL ENRICHMENT</span>
                <div style={{ flex: 1, height: 1, background: COLORS.border }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Star Rating</label>
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={product.starRating}
                    onChange={e => setProduct(p => ({ ...p, starRating: e.target.value }))}>
                    <option value="">Select</option>
                    {[5.0, 4.9, 4.8, 4.7, 4.6, 4.5, 4.4, 4.3, 4.2, 4.1, 4.0].map(r =>
                      <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Review Count</label>
                  <input style={inputStyle} placeholder="e.g., 2400" value={product.reviewCount}
                    onChange={e => setProduct(p => ({ ...p, reviewCount: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Offer / Discount</label>
                  <input style={inputStyle} placeholder="e.g., 20% off first order" value={product.offer}
                    onChange={e => setProduct(p => ({ ...p, offer: e.target.value }))} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
              <button onClick={() => setStep(0)}
                style={{
                  padding: "14px 28px", borderRadius: 12, border: `1px solid ${COLORS.border}`,
                  background: "transparent", color: COLORS.textMuted, cursor: "pointer",
                  fontSize: 14, fontFamily: "'DM Sans', sans-serif",
                }}>← Back</button>
              <button onClick={() => setStep(2)}
                style={{
                  padding: "14px 36px", borderRadius: 12, border: "none", cursor: "pointer",
                  background: `linear-gradient(135deg, ${COLORS.gradient1}, ${COLORS.gradient2})`,
                  color: "#fff", fontSize: 15, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                  boxShadow: `0 4px 20px ${COLORS.accent}33`,
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
              >
                Next: Choose Concept →
              </button>
            </div>
          </div>
        )}

        {/* ══════ STEP 2: CONCEPT LIBRARY ══════ */}
        {step === 2 && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>

            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, fontFamily: "'Space Grotesk', sans-serif" }}>
              Choose Your Ad Concept
            </div>
            <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 24 }}>
              Select a template style. The AI will generate your ad in this format.
            </div>

            {/* Category Filter */}
            <div style={{
              display: "flex", gap: 6, marginBottom: 24, overflowX: "auto",
              paddingBottom: 8,
            }}>
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setConceptFilter(cat)}
                  style={{
                    padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: 500, whiteSpace: "nowrap",
                    fontFamily: "'DM Sans', sans-serif",
                    background: conceptFilter === cat
                      ? `linear-gradient(135deg, ${COLORS.gradient1}, ${COLORS.gradient2})` : COLORS.bgCard,
                    color: conceptFilter === cat ? "#fff" : COLORS.textMuted,
                    transition: "all 0.2s",
                  }}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Concept Grid */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14,
              marginBottom: 24,
            }}>
              {filteredConcepts.map(concept => (
                <div key={concept.id}
                  onClick={() => setSelectedConcept(concept.id)}
                  style={{
                    borderRadius: 14, overflow: "hidden", cursor: "pointer",
                    border: selectedConcept === concept.id
                      ? `2px solid ${COLORS.accent}` : `1px solid ${COLORS.border}`,
                    background: COLORS.bgCard, transition: "all 0.2s",
                    transform: selectedConcept === concept.id ? "scale(1.02)" : "scale(1)",
                    boxShadow: selectedConcept === concept.id ? `0 0 24px ${COLORS.accent}33` : "none",
                  }}
                  onMouseEnter={e => { if (selectedConcept !== concept.id) e.currentTarget.style.borderColor = COLORS.accent + "66"; }}
                  onMouseLeave={e => { if (selectedConcept !== concept.id) e.currentTarget.style.borderColor = COLORS.border; }}
                >
                  <div style={{
                    height: 180, background: `linear-gradient(135deg, ${AD_COLORS[concept.id % 6]}ee, ${AD_COLORS[(concept.id + 2) % 6]}aa)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative",
                  }}>
                    <div style={{ fontSize: 32, opacity: 0.3 }}>▣</div>
                    {concept.popular && (
                      <div style={{
                        position: "absolute", top: 8, right: 8,
                        padding: "3px 10px", borderRadius: 6, fontSize: 10,
                        background: `${COLORS.warning}22`, color: COLORS.warning,
                        fontWeight: 700, letterSpacing: "0.05em",
                      }}>POPULAR</div>
                    )}
                    {selectedConcept === concept.id && (
                      <div style={{
                        position: "absolute", top: 8, left: 8,
                        width: 28, height: 28, borderRadius: "50%",
                        background: COLORS.accent, display: "flex",
                        alignItems: "center", justifyContent: "center",
                        fontSize: 14, color: "#fff", fontWeight: 700,
                      }}>✓</div>
                    )}
                  </div>
                  <div style={{ padding: "10px 14px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{concept.category}</div>
                    <div style={{ fontSize: 11, color: COLORS.textDim }}>{concept.usageCount} uses</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button onClick={() => setStep(1)}
                style={{
                  padding: "14px 28px", borderRadius: 12, border: `1px solid ${COLORS.border}`,
                  background: "transparent", color: COLORS.textMuted, cursor: "pointer",
                  fontSize: 14, fontFamily: "'DM Sans', sans-serif",
                }}>← Back</button>
              <button onClick={() => { if (selectedConcept) setStep(3); }}
                disabled={!selectedConcept}
                style={{
                  padding: "14px 36px", borderRadius: 12, border: "none", cursor: selectedConcept ? "pointer" : "not-allowed",
                  background: selectedConcept
                    ? `linear-gradient(135deg, ${COLORS.gradient1}, ${COLORS.gradient2})` : COLORS.border,
                  color: selectedConcept ? "#fff" : COLORS.textDim,
                  fontSize: 15, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                  opacity: selectedConcept ? 1 : 0.5,
                }}>
                Next: Add Notes →
              </button>
            </div>
          </div>
        )}

        {/* ══════ STEP 3: NOTES ══════ */}
        {step === 3 && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>

            <div style={{
              background: COLORS.bgCard, borderRadius: 16, padding: 32,
              border: `1px solid ${COLORS.border}`,
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, fontFamily: "'Space Grotesk', sans-serif" }}>
                Important Notes
              </div>
              <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 24 }}>
                Any special instructions for the AI? This is optional but helps fine-tune your results.
              </div>

              <textarea style={{ ...inputStyle, height: 160, resize: "vertical", fontSize: 15, lineHeight: 1.6 }}
                placeholder={`Examples:\n• "Make sure the ad mentions the color blue"\n• "Use a dark, moody background"\n• "Target audience is men 30-50 who play golf"\n• "Ad should feel premium and luxurious"`}
                value={notes} onChange={e => setNotes(e.target.value)}
                onFocus={e => e.target.style.borderColor = COLORS.borderFocus}
                onBlur={e => e.target.style.borderColor = COLORS.border} />
              <div style={{ textAlign: "right", fontSize: 11, color: COLORS.textDim, marginTop: 4 }}>
                {notes.length}/500
              </div>

              {/* Summary */}
              <div style={{
                marginTop: 28, padding: 20, borderRadius: 12,
                background: COLORS.bgInput, border: `1px solid ${COLORS.border}`,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.accent, marginBottom: 12 }}>GENERATION SUMMARY</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { label: "Brand", value: brand.name || "Not set" },
                    { label: "Product", value: product.name || "Not set" },
                    { label: "Concept", value: selectedConcept ? MOCK_CONCEPTS.find(c => c.id === selectedConcept)?.category : "Not selected" },
                    { label: "Credit Cost", value: "5 credits (6 variations)" },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, color: COLORS.textDim }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
              <button onClick={() => setStep(2)}
                style={{
                  padding: "14px 28px", borderRadius: 12, border: `1px solid ${COLORS.border}`,
                  background: "transparent", color: COLORS.textMuted, cursor: "pointer",
                  fontSize: 14, fontFamily: "'DM Sans', sans-serif",
                }}>← Back</button>
              <button onClick={startGeneration}
                style={{
                  padding: "16px 44px", borderRadius: 12, border: "none", cursor: "pointer",
                  background: `linear-gradient(135deg, ${COLORS.gradient1}, ${COLORS.gradient2})`,
                  color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
                  boxShadow: `0 4px 28px ${COLORS.accent}44`,
                  display: "flex", alignItems: "center", gap: 10,
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 36px ${COLORS.accent}66`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 4px 28px ${COLORS.accent}44`; }}
              >
                ⚡ Generate Ads
              </button>
            </div>
          </div>
        )}

        {/* ══════ STEP 4: GENERATING ══════ */}
        {step === 4 && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <style>{`
              @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
              @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
              @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
            `}</style>

            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 6 }}>
                Generating Your Ads
              </div>
              <div style={{ fontSize: 14, color: COLORS.textMuted }}>
                {completedAds.filter(Boolean).length} of 6 variations complete
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{
                  borderRadius: 14, overflow: "hidden",
                  border: `1px solid ${completedAds[i] ? COLORS.accent + "44" : COLORS.border}`,
                  background: COLORS.bgCard, transition: "all 0.5s",
                }}>
                  <div style={{
                    height: 260, display: "flex", alignItems: "center", justifyContent: "center",
                    background: completedAds[i]
                      ? `linear-gradient(135deg, ${AD_COLORS[i]}dd, ${AD_COLORS[(i + 3) % 6]}aa)`
                      : generatingAds[i]
                        ? `linear-gradient(90deg, ${COLORS.bgInput}, ${COLORS.bgHover}, ${COLORS.bgInput})`
                        : COLORS.bgInput,
                    backgroundSize: generatingAds[i] ? "200% 100%" : "100% 100%",
                    animation: generatingAds[i] ? "shimmer 1.5s infinite linear" : "none",
                    transition: "all 0.5s",
                  }}>
                    {completedAds[i] ? (
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.7 }}>Ad Variation {i + 1}</div>
                        <div style={{ fontSize: 11, opacity: 0.4, marginTop: 4 }}>[Generated Image]</div>
                      </div>
                    ) : generatingAds[i] ? (
                      <div style={{ fontSize: 13, color: COLORS.textDim, animation: "pulse 1.5s infinite" }}>
                        Generating...
                      </div>
                    ) : null}
                  </div>
                  {completedAds[i] && (
                    <div style={{ padding: "10px 14px", display: "flex", gap: 6 }}>
                      <button style={{
                        flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${COLORS.border}`,
                        background: "transparent", color: COLORS.textMuted, cursor: "pointer",
                        fontSize: 11, fontFamily: "'DM Sans', sans-serif",
                      }}>Fix Errors</button>
                      <button style={{
                        flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
                        background: `linear-gradient(135deg, ${COLORS.gradient1}, ${COLORS.gradient2})`,
                        color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600,
                        fontFamily: "'DM Sans', sans-serif",
                      }}>Save Ad</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════ STEP 5: RESULTS ══════ */}
        {step === 5 && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 4 }}>
                  Your Ad Variations
                </div>
                <div style={{ fontSize: 14, color: COLORS.textMuted }}>
                  6 variations generated · 5 credits used
                </div>
              </div>
              <button onClick={() => { setStep(4); startGeneration(); }}
                style={{
                  padding: "10px 24px", borderRadius: 10, border: `1px solid ${COLORS.border}`,
                  background: COLORS.bgCard, color: COLORS.text, cursor: "pointer",
                  fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans', sans-serif",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                🔄 Regenerate All (5 credits)
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{
                  borderRadius: 14, overflow: "hidden",
                  border: `1px solid ${savedAds[i] ? COLORS.success + "66" : COLORS.border}`,
                  background: COLORS.bgCard, transition: "all 0.2s",
                }}>
                  <div style={{
                    height: 280,
                    background: `linear-gradient(135deg, ${AD_COLORS[i]}dd, ${AD_COLORS[(i + 3) % 6]}aa)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative",
                  }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, opacity: 0.7 }}>Variation {i + 1}</div>
                      <div style={{ fontSize: 11, opacity: 0.4, marginTop: 4 }}>[AI Generated Ad]</div>
                    </div>
                    {savedAds[i] && (
                      <div style={{
                        position: "absolute", top: 10, right: 10,
                        padding: "4px 12px", borderRadius: 6, fontSize: 11,
                        background: `${COLORS.success}22`, color: COLORS.success, fontWeight: 700,
                      }}>SAVED</div>
                    )}
                  </div>

                  <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button style={{
                        flex: 1, padding: "9px 0", borderRadius: 8, border: `1px solid ${COLORS.border}`,
                        background: "transparent", color: COLORS.textMuted, cursor: "pointer",
                        fontSize: 12, fontFamily: "'DM Sans', sans-serif",
                      }}>Fix Errors</button>
                      <button style={{
                        flex: 1, padding: "9px 0", borderRadius: 8, border: `1px solid ${COLORS.border}`,
                        background: "transparent", color: COLORS.textMuted, cursor: "pointer",
                        fontSize: 12, fontFamily: "'DM Sans', sans-serif",
                      }}>↻ Redo</button>
                      <button style={{
                        flex: 1, padding: "9px 0", borderRadius: 8, border: `1px solid ${COLORS.border}`,
                        background: "transparent", color: COLORS.textMuted, cursor: "pointer",
                        fontSize: 12, fontFamily: "'DM Sans', sans-serif",
                      }}>⤓ Download</button>
                    </div>

                    {!savedAds[i] ? (
                      <button onClick={() => setSavedAds(prev => { const n = [...prev]; n[i] = true; return n; })}
                        style={{
                          padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer",
                          background: `linear-gradient(135deg, ${COLORS.gradient1}, ${COLORS.gradient2})`,
                          color: "#fff", fontSize: 13, fontWeight: 600,
                          fontFamily: "'DM Sans', sans-serif",
                        }}>
                        Save Ad
                      </button>
                    ) : (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={{
                          flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${COLORS.accent}44`,
                          background: `${COLORS.accent}11`, color: COLORS.accent, cursor: "pointer",
                          fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                        }}>Get All Ratios</button>
                        <button style={{
                          flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${COLORS.warning}44`,
                          background: `${COLORS.warning}11`, color: COLORS.warning, cursor: "pointer",
                          fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                        }}>Buy Canva Template</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 28, padding: 20, borderRadius: 14, textAlign: "center",
              background: COLORS.bgCard, border: `1px solid ${COLORS.border}`,
            }}>
              <span style={{ fontSize: 14, color: COLORS.textMuted }}>Not what you're looking for? </span>
              <button onClick={() => setStep(3)}
                style={{
                  background: "none", border: "none", color: COLORS.accent,
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                Edit notes & regenerate
              </button>
              <span style={{ fontSize: 14, color: COLORS.textMuted }}> or </span>
              <button onClick={() => setStep(2)}
                style={{
                  background: "none", border: "none", color: COLORS.accent,
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                try a different concept
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
