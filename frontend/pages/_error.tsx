import React from "react";
import Head from "next/head";

interface ErrorProps {
    statusCode?: number;
}

export default function ErrorPage({ statusCode }: ErrorProps) {
    const is404 = statusCode === 404;
    const title = is404 ? "Page not found" : "Something went wrong";
    const message = is404
        ? "The page you're looking for doesn't exist or has been moved."
        : "An error occurred. Please try again later.";

    return (
        <>
            <Head>
                <title>{statusCode ?? "Error"} — Static Engine</title>
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
                    {statusCode ?? "Error"}
                </div>
                <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>{title}</h1>
                <p style={{ fontSize: 14, color: "var(--muted)", maxWidth: 360, marginBottom: 24 }}>{message}</p>
                <a
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
                </a>
            </div>
        </>
    );
}
