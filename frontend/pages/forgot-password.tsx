import React, { useState } from "react";
import { useRouter } from "next/router";

export default function ForgotPassword() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            setMessage({ text: "Please enter your email", type: "error" });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3007";
            const res = await fetch(`${API_URL}/member/forgot-password-flow`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to request password reset");

            setMessage({ text: "If an account exists, a reset link has been sent to your email.", type: "success" });
            setEmail("");
        } catch (err: any) {
            setMessage({ text: err.message || "Something went wrong", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-auth">
            <div className="admin-auth__bg">
                <div className="admin-auth__orb admin-auth__orb--1" />
                <div className="admin-auth__orb admin-auth__orb--2" />
                <div className="admin-auth__grid-overlay" />
            </div>

            <div className="admin-auth__container" style={{ maxWidth: 500, margin: "auto" }}>
                <div className="admin-auth__form-panel" style={{ width: "100%", padding: "40px" }}>
                    <div className="admin-auth__form-header">
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                            <span style={{ fontSize: 24 }}>⚡</span>
                            <span className="grad-text" style={{ fontSize: 22, fontWeight: 800 }}>Static Engine</span>
                        </div>
                        <h1 className="admin-auth__title">Reset Password</h1>
                        <p className="admin-auth__subtitle">Enter your email and we'll send you a reset link.</p>
                    </div>

                    {message && (
                        <div style={{
                            padding: "12px",
                            borderRadius: "8px",
                            marginBottom: "20px",
                            fontSize: "13px",
                            textAlign: "center",
                            background: message.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                            color: message.type === "success" ? "#22C55E" : "#EF4444",
                            border: `1px solid ${message.type === "success" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`
                        }}>
                            {message.text}
                        </div>
                    )}

                    <form className="admin-auth__form" onSubmit={handleSubmit}>
                        <div className="admin-auth__input-group">
                            <label className="admin-auth__label">Email address</label>
                            <input
                                type="email"
                                className="admin-auth__input"
                                placeholder="you@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="admin-auth__submit"
                            disabled={loading || message?.type === "success"}
                        >
                            {loading ? "Sending link..." : "Send Reset Link"}
                        </button>
                    </form>

                    <div className="admin-auth__divider">
                        <span>OR</span>
                    </div>

                    <div className="admin-auth__switch">
                        Remember your password? <button onClick={() => router.push("/login")}>Sign in</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
