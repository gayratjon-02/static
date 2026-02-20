/**
 * PostHogProvider.tsx
 * Wraps the app with PostHog client-side initialization.
 * Place this high in the component tree (_app.tsx).
 */
import { useEffect } from "react";
import { useRouter } from "next/router";
import posthog from "posthog-js";
import { captureUTM, trackPageView } from "../analytics/analytics";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || "";
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();

    useEffect(() => {
        if (!POSTHOG_KEY) return;

        posthog.init(POSTHOG_KEY, {
            api_host: POSTHOG_HOST,
            capture_pageview: false,      // we handle manually
            capture_pageleave: true,
            autocapture: false,           // manual events only — keeps data clean
            persistence: "localStorage",
            loaded: (ph) => {
                if (process.env.NODE_ENV === "development") ph.opt_out_capturing();
            },
        });

        // Assign posthog to window so analytics.ts can access it
        (window as any).posthog = posthog;

        // Capture UTMs on first load
        captureUTM();

        // Track initial page view
        trackPageView(router.asPath);
    }, []);

    useEffect(() => {
        const handleRouteChange = (url: string) => {
            captureUTM();          // re-capture in case URL changed
            trackPageView(url);
        };
        router.events.on("routeChangeComplete", handleRouteChange);
        return () => router.events.off("routeChangeComplete", handleRouteChange);
    }, [router.events]);

    return <>{children}</>;
}
