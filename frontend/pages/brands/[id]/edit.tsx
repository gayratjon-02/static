import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import AuthGuard from "../../../libs/auth/AuthGuard";
import {
    getBrandById,
    updateBrand,
    uploadBrandLogo,
    importBrandFromUrl,
} from "../../../server/user/brand";
import { getBrandConfig, type IndustryItem, type VoiceItem } from "../../../server/user/config";
import type { Brand } from "../../../libs/types/brand.type";

const resolveImageUrl = (url: string | null | undefined): string => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return url;
};

function BrandEditContent() {
    const router = useRouter();
    const { id } = router.query as { id: string };
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [importLoading, setImportLoading] = useState(false);
    const [logoUploading, setLogoUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [industries, setIndustries] = useState<IndustryItem[]>([]);
    const [voiceOptions, setVoiceOptions] = useState<VoiceItem[]>([]);

    // URL import
    const [importUrl, setImportUrl] = useState("");
    const [importError, setImportError] = useState<string | null>(null);

    // Brand form state
    const [form, setForm] = useState({
        name: "",
        description: "",
        website_url: "",
        industry: "",
        logo_url: "",
        primary_color: "#3ECFCF",
        secondary_color: "#3B82F6",
        accent_color: "#E94560",
        background_color: "#FFFFFF",
        voice_tags: [] as string[],
        target_audience: "",
        competitors: "",
    });

    const [logoPreview, setLogoPreview] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        Promise.all([
            getBrandById(id),
            getBrandConfig(),
        ])
            .then(([brand, cfg]) => {
                setForm({
                    name: brand.name || "",
                    description: brand.description || "",
                    website_url: brand.website_url || "",
                    industry: brand.industry || "",
                    logo_url: brand.logo_url || "",
                    primary_color: brand.primary_color || "#3ECFCF",
                    secondary_color: brand.secondary_color || "#3B82F6",
                    accent_color: (brand as any).accent_color || "#E94560",
                    background_color: (brand as any).background_color || "#FFFFFF",
                    voice_tags: brand.voice_tags || [],
                    target_audience: brand.target_audience || "",
                    competitors: brand.competitors || "",
                });
                setLogoPreview(resolveImageUrl(brand.logo_url));
                setIndustries(cfg.industries);
                setVoiceOptions(cfg.voices);
            })
            .catch(() => setError("Brand topilmadi"))
            .finally(() => setLoading(false));
    }, [id]);

    const handleImportUrl = async () => {
        if (!importUrl.trim()) return;
        setImportLoading(true);
        setImportError(null);
        try {
            const data = await importBrandFromUrl(importUrl.trim());
            setForm((prev) => ({
                ...prev,
                name: data.name || prev.name,
                description: data.description || prev.description,
                website_url: data.website_url || prev.website_url,
                industry: data.industry || prev.industry,
                logo_url: data.logo_url || prev.logo_url,
                primary_color: data.primary_color || prev.primary_color,
                secondary_color: data.secondary_color || prev.secondary_color,
                accent_color: data.accent_color || prev.accent_color,
                background_color: data.background_color || prev.background_color,
            }));
            if (data.logo_url) setLogoPreview(data.logo_url);
        } catch (err: any) {
            setImportError(err.message || "Import muvaffaqiyatsiz");
        } finally {
            setImportLoading(false);
        }
    };

    const handleLogoUpload = async (file: File) => {
        setLogoUploading(true);
        try {
            const { logo_url } = await uploadBrandLogo(file);
            setForm((prev) => ({ ...prev, logo_url }));
            setLogoPreview(resolveImageUrl(logo_url));
        } catch (err: any) {
            setError(err.message || "Logo upload failed");
        } finally {
            setLogoUploading(false);
        }
    };

    const toggleVoice = (v: string) => {
        setForm((prev) => ({
            ...prev,
            voice_tags: prev.voice_tags.includes(v)
                ? prev.voice_tags.filter((t) => t !== v)
                : [...prev.voice_tags, v],
        }));
    };

    const handleSave = async () => {
        if (!form.name.trim()) { setError("Brand nomi majburiy"); return; }
        if (!form.primary_color || !form.secondary_color) { setError("Asosiy va ikkinchi ranglar majburiy"); return; }
        setSaving(true);
        setError(null);
        try {
            await updateBrand(id, {
                name: form.name,
                description: form.description,
                website_url: form.website_url,
                industry: form.industry,
                logo_url: form.logo_url,
                primary_color: form.primary_color,
                secondary_color: form.secondary_color,
                accent_color: form.accent_color,
                background_color: form.background_color,
                voice_tags: form.voice_tags,
                target_audience: form.target_audience,
                competitors: form.competitors,
            } as any);
            setSuccess(true);
            setTimeout(() => router.push("/dashboard"), 1200);
        } catch (err: any) {
            setError(err.message || "Saqlashda xato");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ color: "#64ffda", fontSize: 16 }}>Yuklanmoqda...</div>
        </div>
    );

    return (
        <div style={{ minHeight: "100vh", background: "#0d1117", fontFamily: "'Inter', sans-serif" }}>
            {/* Header */}
            <div style={{ background: "#161b22", borderBottom: "1px solid #21262d", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
                <button
                    onClick={() => router.push("/dashboard")}
                    style={{ background: "none", border: "1px solid #30363d", borderRadius: 8, color: "#8b949e", padding: "8px 14px", cursor: "pointer", fontSize: 14 }}
                >
                    ← Orqaga
                </button>
                <h1 style={{ color: "#e6edf3", fontSize: 20, fontWeight: 600, margin: 0 }}>Brand tahrirlash</h1>
            </div>

            <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

                {/* URL Import Section */}
                <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: 20 }}>
                    <div style={{ color: "#e6edf3", fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
                        🔗 Websitedan import qilish
                    </div>
                    <div style={{ color: "#8b949e", fontSize: 13, marginBottom: 12 }}>
                        Brand saytining URL ini kiriting — nom, tavsif, ranglar avtomatik to'ldiriladi
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                        <input
                            value={importUrl}
                            onChange={(e) => setImportUrl(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleImportUrl()}
                            placeholder="https://yourbrand.com"
                            style={{
                                flex: 1, background: "#0d1117", border: "1px solid #30363d", borderRadius: 8,
                                color: "#e6edf3", padding: "10px 14px", fontSize: 14, outline: "none"
                            }}
                        />
                        <button
                            onClick={handleImportUrl}
                            disabled={importLoading || !importUrl.trim()}
                            style={{
                                background: importLoading ? "#21262d" : "#238636", color: "#fff",
                                border: "none", borderRadius: 8, padding: "10px 18px",
                                cursor: importLoading ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600,
                                minWidth: 100, whiteSpace: "nowrap"
                            }}
                        >
                            {importLoading ? "..." : "Import"}
                        </button>
                    </div>
                    {importError && (
                        <div style={{ color: "#f85149", fontSize: 13, marginTop: 8 }}>{importError}</div>
                    )}
                </div>

                {/* Main Form */}
                <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>

                    {/* Logo */}
                    <div>
                        <label style={{ color: "#8b949e", fontSize: 13, fontWeight: 500, display: "block", marginBottom: 10 }}>Brand Logo</label>
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    width: 72, height: 72, borderRadius: 12, border: "2px dashed #30363d",
                                    background: "#0d1117", cursor: "pointer", overflow: "hidden",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }}
                            >
                                {logoPreview ? (
                                    <img src={logoPreview} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : (
                                    <span style={{ color: "#8b949e", fontSize: 24 }}>+</span>
                                )}
                            </div>
                            <div>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={logoUploading}
                                    style={{
                                        background: "#21262d", border: "1px solid #30363d", borderRadius: 8,
                                        color: "#e6edf3", padding: "8px 16px", cursor: "pointer", fontSize: 13
                                    }}
                                >
                                    {logoUploading ? "Yuklanmoqda..." : "Logo yuklash"}
                                </button>
                                <div style={{ color: "#8b949e", fontSize: 12, marginTop: 4 }}>PNG, JPG, WEBP · Max 10MB</div>
                            </div>
                        </div>
                        <input
                            ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.webp"
                            style={{ display: "none" }}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }}
                        />
                    </div>

                    {/* Name */}
                    <div>
                        <label style={{ color: "#8b949e", fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Brand nomi *</label>
                        <input
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            maxLength={100}
                            style={inputStyle}
                            placeholder="Masalan: Nike, Apple"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label style={{ color: "#8b949e", fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Brand tavsifi *</label>
                        <textarea
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            maxLength={500}
                            rows={3}
                            style={{ ...inputStyle, resize: "vertical" }}
                            placeholder="Brand nima qiladi, kimga xizmat qiladi..."
                        />
                        <div style={{ color: "#8b949e", fontSize: 12, textAlign: "right" }}>{form.description.length}/500</div>
                    </div>

                    {/* Website URL */}
                    <div>
                        <label style={{ color: "#8b949e", fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Website URL</label>
                        <input
                            value={form.website_url}
                            onChange={(e) => setForm({ ...form, website_url: e.target.value })}
                            style={inputStyle}
                            placeholder="https://yourbrand.com"
                        />
                    </div>

                    {/* Industry */}
                    <div>
                        <label style={{ color: "#8b949e", fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Soha *</label>
                        <select
                            value={form.industry}
                            onChange={(e) => setForm({ ...form, industry: e.target.value })}
                            style={{ ...inputStyle, cursor: "pointer" }}
                        >
                            <option value="">Tanlang...</option>
                            {industries.map((i) => (
                                <option key={i.id} value={i.id}>{i.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Colors */}
                    <div>
                        <label style={{ color: "#8b949e", fontSize: 13, fontWeight: 500, display: "block", marginBottom: 10 }}>Brand ranglari</label>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            {[
                                { key: "primary_color", label: "Asosiy rang *" },
                                { key: "secondary_color", label: "Ikkinchi rang *" },
                                { key: "accent_color", label: "Accent rang" },
                                { key: "background_color", label: "Fon rangi" },
                            ].map(({ key, label }) => (
                                <div key={key}>
                                    <div style={{ color: "#8b949e", fontSize: 12, marginBottom: 6 }}>{label}</div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: "8px 12px" }}>
                                        <input
                                            type="color"
                                            value={(form as any)[key]}
                                            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                                            style={{ width: 28, height: 28, border: "none", borderRadius: 6, cursor: "pointer", background: "none" }}
                                        />
                                        <input
                                            value={(form as any)[key]}
                                            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                                            maxLength={7}
                                            style={{ background: "none", border: "none", color: "#e6edf3", fontSize: 14, outline: "none", flex: 1 }}
                                            placeholder="#FFFFFF"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Voice Tags */}
                    <div>
                        <label style={{ color: "#8b949e", fontSize: 13, fontWeight: 500, display: "block", marginBottom: 10 }}>Brand ovozi & toni</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {voiceOptions.map((v) => {
                                const selected = form.voice_tags.includes(v.id);
                                return (
                                    <button
                                        key={v.id}
                                        onClick={() => toggleVoice(v.id)}
                                        style={{
                                            padding: "6px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                                            border: selected ? "1px solid #58a6ff" : "1px solid #30363d",
                                            background: selected ? "rgba(88,166,255,0.15)" : "#0d1117",
                                            color: selected ? "#58a6ff" : "#8b949e",
                                            transition: "all 0.15s",
                                        }}
                                    >
                                        {v.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Target Audience */}
                    <div>
                        <label style={{ color: "#8b949e", fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Maqsadli auditoriya</label>
                        <textarea
                            value={form.target_audience}
                            onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
                            maxLength={300}
                            rows={2}
                            style={{ ...inputStyle, resize: "vertical" }}
                            placeholder="Masalan: 25-45 yoshli erkaklar, sport bilan shug'ullanuvchilar"
                        />
                    </div>

                    {/* Competitors */}
                    <div>
                        <label style={{ color: "#8b949e", fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Raqobatchilar (ixtiyoriy)</label>
                        <input
                            value={form.competitors}
                            onChange={(e) => setForm({ ...form, competitors: e.target.value })}
                            style={inputStyle}
                            placeholder="Masalan: Nike, Adidas, Puma"
                        />
                    </div>
                </div>

                {/* Error / Success */}
                {error && (
                    <div style={{ background: "rgba(248,81,73,0.1)", border: "1px solid #f8514940", borderRadius: 8, padding: "12px 16px", color: "#f85149", fontSize: 14 }}>
                        {error}
                    </div>
                )}
                {success && (
                    <div style={{ background: "rgba(35,134,54,0.15)", border: "1px solid #23863640", borderRadius: 8, padding: "12px 16px", color: "#3fb950", fontSize: 14 }}>
                        ✅ Brand muvaffaqiyatli saqlandi! Dashboard ga yo'naltirilmoqda...
                    </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                    <button
                        onClick={() => router.push("/dashboard")}
                        style={{
                            background: "#21262d", border: "1px solid #30363d", borderRadius: 8,
                            color: "#8b949e", padding: "12px 24px", cursor: "pointer", fontSize: 15
                        }}
                    >
                        Bekor qilish
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            background: saving ? "#21262d" : "#238636", border: "none", borderRadius: 8,
                            color: "#fff", padding: "12px 28px", cursor: saving ? "not-allowed" : "pointer",
                            fontSize: 15, fontWeight: 600, minWidth: 140
                        }}
                    >
                        {saving ? "Saqlanmoqda..." : "💾 Saqlash"}
                    </button>
                </div>
            </div>
        </div>
    );
}

const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#0d1117",
    border: "1px solid #30363d",
    borderRadius: 8,
    color: "#e6edf3",
    padding: "10px 14px",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
};

export default function BrandEditPage() {
    return (
        <AuthGuard>
            <BrandEditContent />
        </AuthGuard>
    );
}
