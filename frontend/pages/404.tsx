import React from "react";
import Head from "next/head";
import Link from "next/link";

export default function NotFoundPage() {
    return (
        <>
            <Head>
                <title>404 — Page not found | Static Engine</title>
                <meta name="robots" content="noindex" />
            </Head>
            <div
                style={{
                    minHeight: "100vh",
                    background: "var(--bg)",
                    color: "var(--text)",
                    fontFamily: "var(--font-body)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 24,
                    textAlign: "center",
                }}
            >
                <div style={{ fontSize: 72, fontWeight: 700, color: "var(--muted)", lineHeight: 1, marginBottom: 16 }}>
                    404
                </div>
                <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Page not found</h1>
                <p style={{ fontSize: 14, color: "var(--muted)", maxWidth: 360, marginBottom: 24 }}>
                    The page you’re looking for doesn’t exist or has been moved.
                </p>
                <Link
                    href="/"
                    style={{
                        display: "inline-block",
                        padding: "12px 24px",
                        background: "var(--gradient)",
                        color: "#fff",
                        borderRadius: 10,
                        fontWeight: 600,
                        fontSize: 14,
                        textDecoration: "none",
                    }}
                >
                    Go to homepage
                </Link>
            </div>
        </>
    );
}
