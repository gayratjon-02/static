import { useState, useEffect, useRef } from "react";

const C = {
  bg: "#0B0E1A", bgCard: "#111528", bgHover: "#181D35", bgInput: "#0D1020",
  border: "#1E2340", text: "#E8EAF0", muted: "#6B7194", dim: "#4A5072",
  accent: "#3ECFCF", g1: "#3B82F6", g2: "#3ECFCF",
  red: "#EF4444", green: "#22C55E", yellow: "#F59E0B",
};

const grad = `linear-gradient(135deg, ${C.g1}, ${C.g2})`;
const gradBg = (o) => `linear-gradient(135deg, ${C.g1}${o}, ${C.g2}${o})`;
const gradText = { background: grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" };

export default function LandingPage() {
  const [annual, setAnnual] = useState(true);
  const [openFaq, setOpenFaq] = useState(null);
  const [email, setEmail] = useState("");
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handler = () => setScrollY(window.scrollY || 0);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const plans = [
    {
      name: "Starter",
      price: annual ? 32 : 39,
      period: annual ? "/mo (billed yearly)" : "/mo",
      credits: "250",
      ads: "~10-12 finished ads/mo",
      features: [
        "1 brand",
        "3 products",
        "All ad concepts",
        "Multi-ratio export (1:1, 9:16, 16:9)",
        "Fix Errors feature",
        "250 credits/month",
      ],
      cta: "Start Free Trial",
      popular: false,
    },
    {
      name: "Pro",
      price: annual ? 82 : 99,
      period: annual ? "/mo (billed yearly)" : "/mo",
      credits: "750",
      ads: "~30-37 finished ads/mo",
      features: [
        "5 brands",
        "10 products per brand",
        "All ad concepts",
        "Multi-ratio export (1:1, 9:16, 16:9)",
        "Fix Errors feature",
        "750 credits/month",
        "Priority generation queue",
        "10% off Canva templates",
      ],
      cta: "Start Free Trial",
      popular: true,
    },
    {
      name: "Growth Engine",
      price: annual ? 165 : 199,
      period: annual ? "/mo (billed yearly)" : "/mo",
      credits: "2,000",
      ads: "~80-100 finished ads/mo",
      features: [
        "Unlimited brands",
        "Unlimited products",
        "All ad concepts",
        "Multi-ratio export (1:1, 9:16, 16:9)",
        "Fix Errors feature",
        "2,000 credits/month",
        "Priority generation queue",
        "20% off Canva templates",
        "Up to 5 team members",
      ],
      cta: "Start Free Trial",
      popular: false,
    },
  ];

  const steps = [
    { num: "01", title: "Set Up Your Brand", desc: "Add your brand colors, logo, voice, and target audience. Takes 2 minutes." },
    { num: "02", title: "Add Your Product", desc: "Upload a product photo, describe what it does, and list key selling points." },
    { num: "03", title: "Pick a Concept", desc: "Choose from feature pointers, testimonials, before/after, us vs them, and more." },
    { num: "04", title: "Generate 6 Variations", desc: "AI creates 6 unique ad images in under 60 seconds. Save your favorites." },
  ];

  const features = [
    { title: "AI-Powered Copy", desc: "Claude writes headlines, callouts, and CTAs that actually convert. Not generic filler.", letter: "Ai" },
    { title: "6 Variations Per Click", desc: "Every generation gives you 6 different angles. More creative volume, less time.", letter: "6x" },
    { title: "Multi-Ratio Export", desc: "One click to get 1:1 (feed), 9:16 (stories), and 16:9 (landscape). No resizing needed.", letter: "R" },
    { title: "Fix Errors", desc: "AI output not perfect? Describe the issue and the AI fixes it. 2 credits instead of 5.", letter: "Fx" },
    { title: "Canva Templates", desc: "Buy editable Canva versions of any ad. Tweak fonts, swap images, make it yours.", letter: "Cv" },
    { title: "Concept Library", desc: "Feature pointers, testimonials, stat callouts, before/after. Proven frameworks that perform.", letter: "Lb" },
  ];

  const faqs = [
    { q: "How does the credit system work?", a: "Each ad generation costs 5 credits and produces 6 image variations. Fix Errors costs 2 credits. Multi-ratio exports are free. Credits reset monthly on your billing date. You can buy add-on packs of 100 credits for $15 anytime." },
    { q: "What is a Canva template?", a: "For any saved ad, you can purchase a fully editable Canva template version. This gives you complete control to customize fonts, colors, images, and text. Templates are delivered within 48 hours and include all ratio versions." },
    { q: "Can I use these ads on Facebook and Instagram?", a: "Yes. Every ad is generated at high resolution specifically for Meta advertising. The multi-ratio export gives you feed (1:1), stories (9:16), and landscape (16:9) versions ready to upload directly to Ads Manager." },
    { q: "What if the AI output doesn't look good?", a: "You get 6 variations per generation, so there's usually at least one strong option. If not, use Fix Errors (2 credits) to describe what's wrong and the AI will regenerate with tighter constraints. You can also regenerate individual slots for 2 credits." },
    { q: "Do I need design skills?", a: "Not at all. You provide your brand info, product details, and pick a concept. The AI handles all the design work. If you want to fine-tune results, you can purchase Canva templates for full editing control." },
    { q: "Can I cancel anytime?", a: "Yes. No contracts, no cancellation fees. Your account stays active until the end of your current billing period. Annual plans can be cancelled anytime and you'll keep access for the remainder of your paid year." },
  ];

  const logos = ["Agency A", "Brand Co", "DTC Labs", "Scale Shop", "Ad Studio", "Growth Inc"];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans', sans-serif", overflowX: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,600&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes float { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-10px) } }
        @keyframes glow { 0%,100% { opacity:0.3 } 50% { opacity:0.6 } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
      `}</style>

      {/* ===== NAV ===== */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "0 48px", height: 72,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: scrollY > 50 ? "rgba(11,14,26,0.92)" : "transparent",
        backdropFilter: scrollY > 50 ? "blur(20px)" : "none",
        borderBottom: scrollY > 50 ? `1px solid ${C.border}` : "1px solid transparent",
        transition: "all 0.3s",
      }}>
        <span style={{
          fontSize: 22, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
          ...gradText,
        }}>Static Engine</span>

        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          {["Features", "How It Works", "Pricing", "FAQ"].map(item => (
            <a key={item} href={`#${item.toLowerCase().replace(/ /g, "-")}`}
              style={{
                fontSize: 14, color: C.muted, textDecoration: "none", fontWeight: 500,
                transition: "color 0.2s", cursor: "pointer",
              }}>{item}</a>
          ))}
          <button style={{
            padding: "10px 24px", borderRadius: 10, border: "none", cursor: "pointer",
            background: grad, color: "#fff", fontSize: 14, fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
          }}>Get Started</button>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", textAlign: "center",
        padding: "120px 24px 80px", position: "relative",
      }}>
        {/* Background glow */}
        <div style={{
          position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)",
          width: 800, height: 500, borderRadius: "50%",
          background: `radial-gradient(ellipse, ${C.g1}12 0%, ${C.g2}08 40%, transparent 70%)`,
          pointerEvents: "none", animation: "glow 6s ease infinite",
        }} />

        <div style={{
          padding: "6px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600,
          background: gradBg("12"), border: `1px solid ${C.accent}33`, color: C.accent,
          marginBottom: 28, letterSpacing: "0.03em",
        }}>
          AI-Powered Facebook Ad Generator
        </div>

        <h1 style={{
          fontSize: 72, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
          lineHeight: 1.05, marginBottom: 24, maxWidth: 800,
          position: "relative",
        }}>
          <span style={{ color: C.text }}>Static Ads</span><br />
          <span style={{ color: C.text }}>Generated </span>
          <span style={{
            ...gradText, fontStyle: "italic",
          }}>Fast</span>
        </h1>

        <p style={{
          fontSize: 20, color: C.muted, maxWidth: 560, lineHeight: 1.6, marginBottom: 40,
        }}>
          High-quality static ads in seconds, not days. Upload your brand, pick a concept, and let AI do the rest.
        </p>

        <div style={{ display: "flex", gap: 14, marginBottom: 48 }}>
          <button style={{
            padding: "16px 40px", borderRadius: 14, border: "none", cursor: "pointer",
            background: grad, color: "#fff", fontSize: 17, fontWeight: 700,
            fontFamily: "'Space Grotesk', sans-serif",
            boxShadow: `0 4px 32px ${C.accent}44`,
            transition: "all 0.2s",
          }}>Start Free Trial</button>
          <button style={{
            padding: "16px 36px", borderRadius: 14, cursor: "pointer",
            border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)",
            color: C.text, fontSize: 16, fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
          }}>See Examples</button>
        </div>

        {/* Mini metrics */}
        <div style={{ display: "flex", gap: 48 }}>
          {[
            { val: "6", label: "variations per click" },
            { val: "60s", label: "average generation time" },
            { val: "3", label: "export ratios included" },
          ].map((m, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", ...gradText }}>{m.val}</div>
              <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* Example ad grid preview */}
        <div style={{
          display: "flex", gap: 16, marginTop: 72, perspective: 1200,
        }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{
              width: i === 2 ? 220 : 180, height: i === 2 ? 280 : 240,
              borderRadius: 16, overflow: "hidden",
              background: `linear-gradient(135deg, ${["#1a3a4a","#2a1a3a","#1a2a3a","#3a2a1a","#1a3a2a"][i]}cc, ${["#2a1a3a","#1a3a4a","#3a2a1a","#1a2a3a","#2a3a1a"][i]}88)`,
              border: `1px solid ${C.border}`,
              transform: `rotateY(${(i - 2) * 5}deg) translateY(${Math.abs(i - 2) * 12}px)`,
              opacity: 1 - Math.abs(i - 2) * 0.15,
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: `float ${3 + i * 0.4}s ease infinite`,
              animationDelay: `${i * 0.3}s`,
            }}>
              <span style={{ fontSize: 18, opacity: 0.1, fontWeight: 700 }}>AD</span>
            </div>
          ))}
        </div>
      </section>

      {/* ===== SOCIAL PROOF BAR ===== */}
      <section style={{
        padding: "40px 48px", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 56,
      }}>
        <span style={{ fontSize: 13, color: C.dim, fontWeight: 500, whiteSpace: "nowrap" }}>Trusted by media buyers at</span>
        {logos.map((l, i) => (
          <span key={i} style={{
            fontSize: 16, fontWeight: 700, color: C.dim, opacity: 0.4,
            fontFamily: "'Space Grotesk', sans-serif", whiteSpace: "nowrap",
          }}>{l}</span>
        ))}
      </section>

      {/* ===== CREATIVE VOLUME = PERFORMANCE ===== */}
      <section style={{
        padding: "100px 48px", textAlign: "center",
      }}>
        <div style={{
          maxWidth: 900, margin: "0 auto",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 24,
        }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#fff", fontFamily: "'Space Grotesk', sans-serif" }}>Creative Volume</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#fff", fontFamily: "'Space Grotesk', sans-serif" }}>Creative Quality</div>
          </div>
          <div style={{ fontSize: 36, fontWeight: 300, color: C.dim }}>=</div>
          <div style={{
            fontSize: 56, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
            ...gradText,
          }}>Performance</div>
        </div>
        <p style={{ fontSize: 16, color: C.muted, maxWidth: 600, margin: "24px auto 0", lineHeight: 1.6 }}>
          The accounts that win on Meta are the ones testing the most creatives. Static Engine lets you produce high-quality static ads at the volume you need to find winners.
        </p>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" style={{ padding: "80px 48px 100px" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Features</div>
          <h2 style={{ fontSize: 42, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>
            Everything you need to <span style={gradText}>scale creative output</span>
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, maxWidth: 1100, margin: "0 auto" }}>
          {features.map((f, i) => (
            <div key={i} style={{
              padding: 28, borderRadius: 16,
              background: C.bgCard, border: `1px solid ${C.border}`,
              transition: "all 0.2s",
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12, marginBottom: 18,
                background: gradBg("15"), border: `1px solid ${C.accent}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, fontWeight: 700, color: C.accent,
                fontFamily: "'Space Grotesk', sans-serif",
              }}>{f.letter}</div>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="how-it-works" style={{
        padding: "80px 48px 100px",
        background: `linear-gradient(180deg, transparent, ${C.bgCard}44, transparent)`,
      }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>How It Works</div>
          <h2 style={{ fontSize: 42, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>
            From brand to ads in <span style={gradText}>4 steps</span>
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, maxWidth: 1100, margin: "0 auto" }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              padding: 28, borderRadius: 16, position: "relative",
              background: C.bgCard, border: `1px solid ${C.border}`,
            }}>
              <div style={{
                fontSize: 48, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
                ...gradText, opacity: 0.3, marginBottom: 12,
              }}>{s.num}</div>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{s.title}</div>
              <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>{s.desc}</div>
              {i < 3 && (
                <div style={{
                  position: "absolute", right: -14, top: "50%", transform: "translateY(-50%)",
                  fontSize: 18, color: C.dim, fontWeight: 300,
                }}>&rarr;</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" style={{ padding: "80px 48px 100px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Pricing</div>
          <h2 style={{ fontSize: 42, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 16 }}>
            Simple, credit-based <span style={gradText}>pricing</span>
          </h2>
          <p style={{ fontSize: 16, color: C.muted, marginBottom: 28 }}>
            Pay for what you use. Every generation = 5 credits = 6 ad variations.
          </p>

          {/* Toggle */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 14,
            padding: "6px 8px", borderRadius: 12,
            background: C.bgCard, border: `1px solid ${C.border}`,
          }}>
            <span style={{ fontSize: 14, color: annual ? C.dim : C.text, fontWeight: annual ? 400 : 600, padding: "0 8px" }}>Monthly</span>
            <div onClick={() => setAnnual(!annual)} style={{
              width: 48, height: 26, borderRadius: 13, cursor: "pointer",
              background: annual ? grad : C.border,
              padding: 3, transition: "background 0.2s",
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 10, background: "#fff",
                transform: annual ? "translateX(22px)" : "translateX(0)",
                transition: "transform 0.2s",
              }} />
            </div>
            <span style={{ fontSize: 14, color: annual ? C.text : C.dim, fontWeight: annual ? 600 : 400, padding: "0 8px" }}>
              Annual
            </span>
            <span style={{
              padding: "3px 10px", borderRadius: 6, fontSize: 11,
              background: `${C.green}18`, color: C.green, fontWeight: 700,
            }}>Save 2 months</span>
          </div>
        </div>

        {/* Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, maxWidth: 1100, margin: "0 auto" }}>
          {plans.map((plan, i) => (
            <div key={i} style={{
              padding: 32, borderRadius: 20, position: "relative",
              background: plan.popular ? gradBg("08") : C.bgCard,
              border: plan.popular ? `2px solid ${C.accent}44` : `1px solid ${C.border}`,
              transform: plan.popular ? "scale(1.03)" : "none",
              boxShadow: plan.popular ? `0 8px 40px ${C.accent}22` : "none",
            }}>
              {plan.popular && (
                <div style={{
                  position: "absolute", top: -1, left: "50%", transform: "translateX(-50%) translateY(-50%)",
                  padding: "5px 20px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                  background: grad, color: "#fff", letterSpacing: "0.05em",
                }}>MOST POPULAR</div>
              )}

              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{plan.name}</div>
              <div style={{ fontSize: 13, color: C.accent, fontWeight: 600, marginBottom: 20 }}>
                {plan.credits} credits/mo ~ {plan.ads}
              </div>

              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 24 }}>
                <span style={{ fontSize: 48, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>${plan.price}</span>
                <span style={{ fontSize: 15, color: C.dim }}>{plan.period}</span>
              </div>

              <button style={{
                width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
                cursor: "pointer", fontSize: 15, fontWeight: 700,
                fontFamily: "'DM Sans', sans-serif",
                background: plan.popular ? grad : "transparent",
                color: plan.popular ? "#fff" : C.accent,
                border: plan.popular ? "none" : `1px solid ${C.accent}44`,
                boxShadow: plan.popular ? `0 4px 20px ${C.accent}33` : "none",
                marginBottom: 28,
              }}>{plan.cta}</button>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {plan.features.map((f, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
                      background: `${C.accent}15`, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, color: C.accent, fontWeight: 700,
                    }}>+</div>
                    <span style={{ fontSize: 14, color: C.muted, lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Add-on note */}
        <div style={{
          textAlign: "center", marginTop: 32,
          padding: "16px 24px", borderRadius: 12,
          background: C.bgCard, border: `1px solid ${C.border}`,
          maxWidth: 500, margin: "32px auto 0",
        }}>
          <span style={{ fontSize: 14, color: C.muted }}>Need more credits? </span>
          <span style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>Add 100 credits anytime for $15</span>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" style={{
        padding: "80px 48px 100px", maxWidth: 780, margin: "0 auto",
      }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>FAQ</div>
          <h2 style={{ fontSize: 42, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>
            Common questions
          </h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {faqs.map((faq, i) => (
            <div key={i} style={{
              borderRadius: 14, overflow: "hidden",
              background: C.bgCard, border: `1px solid ${openFaq === i ? C.accent + "44" : C.border}`,
              transition: "all 0.2s",
            }}>
              <div onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  padding: "18px 24px", cursor: "pointer",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: openFaq === i ? C.text : C.muted }}>{faq.q}</span>
                <span style={{
                  fontSize: 20, color: C.dim, transition: "transform 0.2s",
                  transform: openFaq === i ? "rotate(45deg)" : "rotate(0)",
                  fontWeight: 300,
                }}>+</span>
              </div>
              {openFaq === i && (
                <div style={{
                  padding: "0 24px 20px",
                  fontSize: 14, color: C.muted, lineHeight: 1.7,
                  animation: "fadeUp 0.2s ease",
                }}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section style={{
        padding: "100px 48px", textAlign: "center", position: "relative",
      }}>
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          width: 600, height: 400, borderRadius: "50%",
          background: `radial-gradient(ellipse, ${C.g1}10 0%, ${C.g2}06 40%, transparent 70%)`,
          pointerEvents: "none",
        }} />

        <h2 style={{
          fontSize: 48, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
          marginBottom: 16, position: "relative",
        }}>
          Ready to <span style={gradText}>scale your creative</span>?
        </h2>
        <p style={{ fontSize: 18, color: C.muted, marginBottom: 36, position: "relative" }}>
          Start generating high-quality static ads in minutes. No design skills required.
        </p>

        <div style={{
          display: "inline-flex", gap: 0, borderRadius: 14, overflow: "hidden",
          border: `1px solid ${C.border}`, position: "relative",
        }}>
          <input
            style={{
              padding: "16px 20px", width: 320, border: "none", outline: "none",
              background: C.bgCard, color: C.text, fontSize: 15,
              fontFamily: "'DM Sans', sans-serif",
            }}
            placeholder="Enter your email"
            value={email} onChange={e => setEmail(e.target.value)} />
          <button style={{
            padding: "16px 32px", border: "none", cursor: "pointer",
            background: grad, color: "#fff", fontSize: 15, fontWeight: 700,
            fontFamily: "'Space Grotesk', sans-serif",
          }}>Get Early Access</button>
        </div>

        <div style={{ fontSize: 13, color: C.dim, marginTop: 14 }}>
          Free trial included. No credit card required.
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer style={{
        padding: "48px", borderTop: `1px solid ${C.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <span style={{
            fontSize: 18, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
            ...gradText,
          }}>Static Engine</span>
          <div style={{ fontSize: 12, color: C.dim, marginTop: 6 }}>AI-powered ad generation for media buyers.</div>
        </div>
        <div style={{ display: "flex", gap: 32 }}>
          {["Privacy", "Terms", "Support", "Twitter"].map(item => (
            <a key={item} href="#" style={{ fontSize: 13, color: C.dim, textDecoration: "none" }}>{item}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}
