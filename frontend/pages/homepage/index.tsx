import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";

export default function LandingPage() {
    const router = useRouter();
    const [annual, setAnnual] = useState(true);
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [email, setEmail] = useState("");
    const [scrollY, setScrollY] = useState(0);

    /** Scroll to pricing section */
    const scrollToPricing = () => {
        const token = typeof window !== "undefined" ? localStorage.getItem("se_access_token") : null;
        if (token) {
            router.push("/dashboard");
            return;
        }
        const el = document.getElementById("pricing");
        if (el) el.scrollIntoView({ behavior: "smooth" });
    };

    /** Plan selected → go to login with plan query param */
    const handlePlanSelect = (planName: string) => {
        const token = typeof window !== "undefined" ? localStorage.getItem("se_access_token") : null;
        if (token) {
            router.push("/dashboard");
            return;
        }
        const slug = planName.toLowerCase().replace(/\s+/g, "_");
        router.push(`/login?plan=${slug}`);
    };

    useEffect(() => {
        const handler = () => setScrollY(window.scrollY || 0);
        window.addEventListener("scroll", handler, { passive: true });
        return () => window.removeEventListener("scroll", handler);
    }, []);

    const plans = [
        {
            name: "Starter", price: annual ? 32 : 39,
            period: annual ? "/mo (billed yearly)" : "/mo",
            credits: "250", ads: "~10-12 finished ads/mo",
            features: ["1 brand", "3 products", "All ad concepts", "Multi-ratio export (1:1, 9:16, 16:9)", "Fix Errors feature", "250 credits/month"],
            cta: "Start Free Trial", popular: false,
        },
        {
            name: "Pro", price: annual ? 82 : 99,
            period: annual ? "/mo (billed yearly)" : "/mo",
            credits: "750", ads: "~30-37 finished ads/mo",
            features: ["5 brands", "10 products per brand", "All ad concepts", "Multi-ratio export (1:1, 9:16, 16:9)", "Fix Errors feature", "750 credits/month", "Priority generation queue", "10% off Canva templates"],
            cta: "Start Free Trial", popular: true,
        },
        {
            name: "Growth Engine", price: annual ? 165 : 199,
            period: annual ? "/mo (billed yearly)" : "/mo",
            credits: "2,000", ads: "~80-100 finished ads/mo",
            features: ["Unlimited brands", "Unlimited products", "All ad concepts", "Multi-ratio export (1:1, 9:16, 16:9)", "Fix Errors feature", "2,000 credits/month", "Priority generation queue", "20% off Canva templates", "Up to 5 team members"],
            cta: "Start Free Trial", popular: false,
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

    const previewColors = [
        ["#1a3a4a", "#2a1a3a"],
        ["#2a1a3a", "#1a3a4a"],
        ["#1a2a3a", "#3a2a1a"],
        ["#3a2a1a", "#1a2a3a"],
        ["#1a3a2a", "#2a3a1a"],
    ];

    return (
        <div className="landing-page">
            {/* ===== NAV ===== */}
            <nav className={`landing-nav ${scrollY > 50 ? "landing-nav--scrolled" : ""}`}>
                <span className="landing-nav__logo grad-text">Static Engine</span>
                <div className="landing-nav__links">
                    {["Features", "How It Works", "Pricing", "FAQ"].map((item) => (
                        <a key={item} href={`#${item.toLowerCase().replace(/ /g, "-")}`} className="landing-nav__link">
                            {item}
                        </a>
                    ))}
                    <button className="landing-nav__cta" onClick={() => scrollToPricing()}>Get Started</button>
                </div>
            </nav>

            {/* ===== HERO ===== */}
            <section className="hero">
                <div className="hero__glow" />
                <div className="hero__badge">AI-Powered Facebook Ad Generator</div>
                <h1 className="hero__title">
                    <span>Static Ads</span><br />
                    <span>Generated </span>
                    <span className="grad-text hero__italic">Fast</span>
                </h1>
                <p className="hero__desc">
                    High-quality static ads in seconds, not days. Upload your brand, pick a concept, and let AI do the rest.
                </p>
                <div className="hero__buttons">
                    <button className="btn-hero-primary" onClick={() => scrollToPricing()}>Start Free Trial</button>
                    <button className="btn-hero-secondary">See Examples</button>
                </div>
                <div className="hero__metrics">
                    {[
                        { val: "6", label: "variations per click" },
                        { val: "60s", label: "average generation time" },
                        { val: "3", label: "export ratios included" },
                    ].map((m, i) => (
                        <div key={i} className="metric">
                            <div className="metric__val grad-text">{m.val}</div>
                            <div className="metric__label">{m.label}</div>
                        </div>
                    ))}
                </div>

                {/* Ad preview */}
                <div className="hero-preview">
                    {previewColors.map((colors, i) => (
                        <div
                            key={i}
                            className="hero-preview-card"
                            style={{
                                width: i === 2 ? 220 : 180,
                                height: i === 2 ? 280 : 240,
                                background: `linear-gradient(135deg, ${colors[0]}cc, ${colors[1]}88)`,
                                transform: `rotateY(${(i - 2) * 5}deg) translateY(${Math.abs(i - 2) * 12}px)`,
                                opacity: 1 - Math.abs(i - 2) * 0.15,
                                animation: `float ${3 + i * 0.4}s ease infinite`,
                                animationDelay: `${i * 0.3}s`,
                            }}
                        >
                            <span>AD</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* ===== SOCIAL PROOF ===== */}
            <section className="social-proof">
                <span className="social-proof__label">Trusted by media buyers at</span>
                {logos.map((l, i) => (
                    <span key={i} className="social-proof__logo">{l}</span>
                ))}
            </section>

            {/* ===== CREATIVE VOLUME ===== */}
            <section className="creative-volume">
                <div className="creative-volume__row">
                    <div className="creative-volume__left">
                        <div className="creative-volume__line">Creative Volume</div>
                        <div className="creative-volume__line">Creative Quality</div>
                    </div>
                    <div className="creative-volume__eq">=</div>
                    <div className="creative-volume__result grad-text">Performance</div>
                </div>
                <p className="creative-volume__desc">
                    The accounts that win on Meta are the ones testing the most creatives. Static Engine lets you produce high-quality static ads at the volume you need to find winners.
                </p>
            </section>

            {/* ===== FEATURES ===== */}
            <section id="features" className="features-section">
                <div className="section-header">
                    <div className="section-header__label">Features</div>
                    <h2 className="section-header__title">
                        Everything you need to <span className="grad-text">scale creative output</span>
                    </h2>
                </div>
                <div className="features-grid">
                    {features.map((f, i) => (
                        <div key={i} className="feature-card">
                            <div className="feature-card__icon">{f.letter}</div>
                            <div className="feature-card__title">{f.title}</div>
                            <div className="feature-card__desc">{f.desc}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ===== HOW IT WORKS ===== */}
            <section id="how-it-works" className="how-it-works">
                <div className="section-header">
                    <div className="section-header__label">How It Works</div>
                    <h2 className="section-header__title">
                        From brand to ads in <span className="grad-text">4 steps</span>
                    </h2>
                </div>
                <div className="steps-grid">
                    {steps.map((s, i) => (
                        <div key={i} className="step-card">
                            <div className="step-card__num grad-text">{s.num}</div>
                            <div className="step-card__title">{s.title}</div>
                            <div className="step-card__desc">{s.desc}</div>
                            {i < 3 && <div className="step-card__arrow">&rarr;</div>}
                        </div>
                    ))}
                </div>
            </section>

            {/* ===== PRICING ===== */}
            <section id="pricing" className="pricing-section">
                <div className="pricing-header">
                    <div className="section-header__label">Pricing</div>
                    <h2 className="section-header__title" style={{ marginBottom: 16 }}>
                        Simple, credit-based <span className="grad-text">pricing</span>
                    </h2>
                    <p className="pricing-header__desc">
                        Pay for what you use. Every generation = 5 credits = 6 ad variations.
                    </p>

                    <div className="pricing-toggle">
                        <span className="pricing-toggle__label" style={{ color: annual ? "var(--dim)" : "var(--text)", fontWeight: annual ? 400 : 600 }}>
                            Monthly
                        </span>
                        <div
                            className="pricing-toggle__switch"
                            onClick={() => setAnnual(!annual)}
                            style={{ background: annual ? "var(--gradient)" : "var(--border)" }}
                        >
                            <div className="pricing-toggle__knob" style={{ transform: annual ? "translateX(22px)" : "translateX(0)" }} />
                        </div>
                        <span className="pricing-toggle__label" style={{ color: annual ? "var(--text)" : "var(--dim)", fontWeight: annual ? 600 : 400 }}>
                            Annual
                        </span>
                        <span className="pricing-toggle__save">Save 2 months</span>
                    </div>
                </div>

                <div className="pricing-grid">
                    {plans.map((plan, i) => (
                        <div key={i} className={`plan-card ${plan.popular ? "plan-card--popular" : ""}`}>
                            {plan.popular && <div className="plan-card__badge">MOST POPULAR</div>}
                            <div className="plan-card__name">{plan.name}</div>
                            <div className="plan-card__credits">{plan.credits} credits/mo ~ {plan.ads}</div>
                            <div className="plan-card__price-row">
                                <span className="plan-card__price">${plan.price}</span>
                                <span className="plan-card__period">{plan.period}</span>
                            </div>
                            <button className={`plan-card__cta ${plan.popular ? "plan-card__cta--primary" : "plan-card__cta--secondary"}`} onClick={() => handlePlanSelect(plan.name)}>
                                {plan.cta}
                            </button>
                            <div className="plan-card__features">
                                {plan.features.map((f, j) => (
                                    <div key={j} className="feature-row">
                                        <div className="feature-row__check">+</div>
                                        <span className="feature-row__text">{f}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="addon-note">
                    <span className="addon-note__muted">Need more credits? </span>
                    <span className="addon-note__bold">Add 100 credits anytime for $15</span>
                </div>
            </section>

            {/* ===== FAQ ===== */}
            <section id="faq" className="faq-section">
                <div className="section-header">
                    <div className="section-header__label">FAQ</div>
                    <h2 className="section-header__title">Common questions</h2>
                </div>
                <div className="faq-list">
                    {faqs.map((faq, i) => (
                        <div key={i} className={`faq-item ${openFaq === i ? "faq-item--open" : ""}`}>
                            <div className="faq-item__q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                                <span className="faq-item__question">{faq.q}</span>
                                <span className="faq-item__toggle">+</span>
                            </div>
                            {openFaq === i && <div className="faq-item__a">{faq.a}</div>}
                        </div>
                    ))}
                </div>
            </section>

            {/* ===== CTA ===== */}
            <section className="cta-section">
                <div className="cta-section__glow" />
                <h2 className="cta-section__title">
                    Ready to <span className="grad-text">scale your creative</span>?
                </h2>
                <p className="cta-section__desc">
                    Start generating high-quality static ads in minutes. No design skills required.
                </p>
                <div className="cta-section__form">
                    <input
                        className="cta-section__input"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <button className="cta-section__submit" onClick={() => scrollToPricing()}>Get Early Access</button>
                </div>
                <div className="cta-section__note">Free trial included. No credit card required.</div>
            </section>

            {/* ===== FOOTER ===== */}
            <footer className="landing-footer">
                <div>
                    <span className="landing-footer__brand grad-text">Static Engine</span>
                    <div className="landing-footer__tagline">AI-powered ad generation for media buyers.</div>
                </div>
                <div className="landing-footer__links">
                    {["Privacy", "Terms", "Support", "Twitter"].map((item) => (
                        <a key={item} href="#" className="landing-footer__link">{item}</a>
                    ))}
                </div>
            </footer>
        </div>
    );
}
