import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAdminAuth } from "../../../libs/hooks/useAdminAuth";
import { adminLogin, adminSignup } from "../../../server/admin/adminPostApis";
import { AdminRole } from "../../../libs/enums/admin.enum";

export default function AdminAuth() {
    const router = useRouter();
    const { isLoading, isAuthenticated } = useAdminAuth();
    const [mode, setMode] = useState<"login" | "signup">("login");

    // If already logged in, redirect to admin homepage
    useEffect(() => {
        if (!isLoading && isAuthenticated) {
            router.replace("/_admin/homepage");
        }
    }, [isLoading, isAuthenticated, router]);

    // ── Login state ──
    const [loginEmail, setLoginEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");

    // ── Signup state ──
    const [signupName, setSignupName] = useState("");
    const [signupEmail, setSignupEmail] = useState("");
    const [signupPassword, setSignupPassword] = useState("");
    const [signupConfirm, setSignupConfirm] = useState("");
    const [signupRole, setSignupRole] = useState<AdminRole>(AdminRole.CONTENT_ADMIN);

    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const res = await adminLogin({ email: loginEmail, password: loginPassword });
            localStorage.setItem("se_admin_token", res.accessToken);
            localStorage.setItem("se_admin_user", JSON.stringify(res.admin));
            router.push("/_admin/homepage");
        } catch (err: any) {
            setError(err.message || "Login failed");
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (signupPassword !== signupConfirm) {
            setError("Passwords do not match");
            return;
        }
        setError("");
        setLoading(true);
        try {
            const res = await adminSignup({
                email: signupEmail,
                password: signupPassword,
                name: signupName,
                role: signupRole,
            });
            localStorage.setItem("se_admin_token", res.accessToken);
            localStorage.setItem("se_admin_user", JSON.stringify(res.admin));
            router.push("/_admin/homepage");
        } catch (err: any) {
            setError(err.message || "Signup failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-auth">
            {/* Background decoration */}
            <div className="admin-auth__bg">
                <div className="admin-auth__orb admin-auth__orb--1" />
                <div className="admin-auth__orb admin-auth__orb--2" />
                <div className="admin-auth__grid-overlay" />
            </div>

            <div className="admin-auth__container">
                {/* Left — branding panel */}
                <div className="admin-auth__brand-panel">
                    <div className="admin-auth__brand-content">
                        <div className="admin-auth__logo">
                            <span className="admin-auth__logo-icon">⚡</span>
                            <span className="admin-auth__logo-text grad-text">Static Engine</span>
                        </div>
                        <div className="admin-auth__brand-tag">Admin Panel</div>
                        <p className="admin-auth__brand-desc">
                            Manage concepts, monitor usage, and control the ad generation platform.
                        </p>

                        <div className="admin-auth__features">
                            {[
                                { icon: "📊", title: "Concept Library", desc: "Create and manage ad concepts" },
                                { icon: "👥", title: "User Management", desc: "Monitor member activity & credits" },
                                { icon: "🎨", title: "Content Control", desc: "Upload images, update templates" },
                                { icon: "🔒", title: "Role-Based Access", desc: "Super Admin & Content Admin roles" },
                            ].map((f, i) => (
                                <div key={i} className="admin-auth__feature">
                                    <span className="admin-auth__feature-icon">{f.icon}</span>
                                    <div>
                                        <div className="admin-auth__feature-title">{f.title}</div>
                                        <div className="admin-auth__feature-desc">{f.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right — form panel */}
                <div className="admin-auth__form-panel">
                    <div className="admin-auth__form-wrapper">
                        {/* Tab switcher */}
                        <div className="admin-auth__tabs">
                            <button
                                className={`admin-auth__tab ${mode === "login" ? "admin-auth__tab--active" : ""}`}
                                onClick={() => setMode("login")}
                            >
                                Login
                            </button>
                            <button
                                className={`admin-auth__tab ${mode === "signup" ? "admin-auth__tab--active" : ""}`}
                                onClick={() => setMode("signup")}
                            >
                                Sign Up
                            </button>
                        </div>

                        <h2 className="admin-auth__title">
                            {mode === "login" ? "Welcome back" : "Create admin account"}
                        </h2>
                        <p className="admin-auth__subtitle">
                            {mode === "login"
                                ? "Sign in to your admin account to continue"
                                : "Register a new administrator for the platform"}
                        </p>

                        {error && (
                            <div
                                style={{
                                    padding: "10px 14px",
                                    borderRadius: 8,
                                    background: "rgba(239,68,68,0.1)",
                                    border: "1px solid rgba(239,68,68,0.3)",
                                    color: "#EF4444",
                                    fontSize: 13,
                                    marginBottom: 8,
                                }}
                            >
                                {error}
                            </div>
                        )}

                        {/* ─── LOGIN FORM ─── */}
                        {mode === "login" && (
                            <form className="admin-auth__form" onSubmit={handleLogin}>
                                <div className="admin-auth__field">
                                    <label className="admin-auth__label">Email</label>
                                    <input
                                        type="email"
                                        className="admin-auth__input"
                                        placeholder="admin@staticengine.com"
                                        value={loginEmail}
                                        onChange={(e) => setLoginEmail(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="admin-auth__field">
                                    <label className="admin-auth__label">Password</label>
                                    <div className="admin-auth__input-wrap">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            className="admin-auth__input"
                                            placeholder="Enter your password"
                                            value={loginPassword}
                                            onChange={(e) => setLoginPassword(e.target.value)}
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="admin-auth__eye"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? "🙈" : "👁"}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="admin-auth__submit"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <span className="admin-auth__spinner" />
                                    ) : (
                                        "Sign In"
                                    )}
                                </button>
                            </form>
                        )}

                        {/* ─── SIGNUP FORM ─── */}
                        {mode === "signup" && (
                            <form className="admin-auth__form" onSubmit={handleSignup}>
                                <div className="admin-auth__field">
                                    <label className="admin-auth__label">Full Name</label>
                                    <input
                                        type="text"
                                        className="admin-auth__input"
                                        placeholder="John Doe"
                                        value={signupName}
                                        onChange={(e) => setSignupName(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="admin-auth__field">
                                    <label className="admin-auth__label">Email</label>
                                    <input
                                        type="email"
                                        className="admin-auth__input"
                                        placeholder="admin@staticengine.com"
                                        value={signupEmail}
                                        onChange={(e) => setSignupEmail(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="admin-auth__field">
                                    <label className="admin-auth__label">Role</label>
                                    <div className="admin-auth__role-group">
                                        <button
                                            type="button"
                                            className={`admin-auth__role-btn ${signupRole === AdminRole.SUPER_ADMIN ? "admin-auth__role-btn--active" : ""}`}
                                            onClick={() => setSignupRole(AdminRole.SUPER_ADMIN)}
                                        >
                                            <span className="admin-auth__role-icon">🛡️</span>
                                            Super Admin
                                        </button>
                                        <button
                                            type="button"
                                            className={`admin-auth__role-btn ${signupRole === AdminRole.CONTENT_ADMIN ? "admin-auth__role-btn--active" : ""}`}
                                            onClick={() => setSignupRole(AdminRole.CONTENT_ADMIN)}
                                        >
                                            <span className="admin-auth__role-icon">✏️</span>
                                            Content Admin
                                        </button>
                                    </div>
                                </div>

                                <div className="admin-auth__field">
                                    <label className="admin-auth__label">Password</label>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        className="admin-auth__input"
                                        placeholder="Min 6 characters"
                                        value={signupPassword}
                                        onChange={(e) => setSignupPassword(e.target.value)}
                                        minLength={6}
                                        required
                                    />
                                </div>

                                <div className="admin-auth__field">
                                    <label className="admin-auth__label">Confirm Password</label>
                                    <div className="admin-auth__input-wrap">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            className="admin-auth__input"
                                            placeholder="Re-enter password"
                                            value={signupConfirm}
                                            onChange={(e) => setSignupConfirm(e.target.value)}
                                            minLength={6}
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="admin-auth__eye"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? "🙈" : "👁"}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="admin-auth__submit"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <span className="admin-auth__spinner" />
                                    ) : (
                                        "Create Account"
                                    )}
                                </button>
                            </form>
                        )}

                        <div className="admin-auth__footer">
                            <span className="admin-auth__footer-lock">🔒</span>
                            Secured admin access only
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
