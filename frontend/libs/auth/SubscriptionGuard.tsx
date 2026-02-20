import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AuthGuard from "./AuthGuard";
import { getMemberRequest } from "../../server/user/login";
import { verifyCheckoutRequest } from "../../server/user/billing";

const PAID_TIERS = ["starter", "pro", "growth"];

function hasPaidSubscription(member: any): boolean {
    const result = (
        member?.subscription_status === "active" &&
        PAID_TIERS.includes(member?.subscription_tier?.toLowerCase())
    );
    console.log("[SubscriptionGuard] hasPaidSubscription check:", {
        tier: member?.subscription_tier,
        status: member?.subscription_status,
        result,
    });
    return result;
}

function SubscriptionCheck({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        // Wait for Next.js router to be ready — during hydration,
        // router.query is {} which would cause a false "no checkout return"
        if (!router.isReady) return;

        const checkSubscription = async () => {
            console.log("\n━━━ SubscriptionGuard CHECK ━━━");
            console.log("  router.isReady:", router.isReady);
            console.log("  router.query:", JSON.stringify(router.query));

            // After Stripe payment, verify subscription via Stripe API directly
            const isCheckoutReturn =
                router.query.checkout === "success" ||
                router.query.checkout === "cancelled";

            if (isCheckoutReturn) {
                console.log("  🔄 Checkout return detected:", router.query.checkout);

                if (router.query.checkout === "cancelled") {
                    console.log("  ❌ Checkout cancelled → redirecting to /subscribe");
                    router.replace("/subscribe");
                    return;
                }

                try {
                    // Step 1: Call verify-checkout endpoint — this directly queries
                    // Stripe API and updates the DB (bypasses webhook dependency)
                    console.log("  📡 Calling verify-checkout (Stripe direct check)...");
                    const verifyResult = await verifyCheckoutRequest();
                    console.log("  📋 Verify result:", JSON.stringify(verifyResult));

                    if (verifyResult.verified) {
                        // Update localStorage with fresh data
                        const member = await getMemberRequest();
                        localStorage.setItem("se_member", JSON.stringify(member));
                        console.log("  ✅ Subscription verified → allowing through");
                        setReady(true);
                        return;
                    }

                    // Step 2: If verify didn't find subscription yet (payment still processing),
                    // wait and retry once more
                    console.log("  ⏳ Not verified yet, waiting 3s and retrying...");
                    await new Promise((resolve) => setTimeout(resolve, 3000));

                    console.log("  📡 Retry verify-checkout...");
                    const retryResult = await verifyCheckoutRequest();
                    console.log("  📋 Retry result:", JSON.stringify(retryResult));

                    if (retryResult.verified) {
                        const member = await getMemberRequest();
                        localStorage.setItem("se_member", JSON.stringify(member));
                        console.log("  ✅ Subscription verified on retry → allowing through");
                        setReady(true);
                        return;
                    }

                    // Step 3: Final attempt after another wait
                    console.log("  ⏳ Still not verified, waiting 5s more...");
                    await new Promise((resolve) => setTimeout(resolve, 5000));

                    console.log("  📡 Final verify-checkout attempt...");
                    const finalResult = await verifyCheckoutRequest();
                    console.log("  📋 Final result:", JSON.stringify(finalResult));

                    if (finalResult.verified) {
                        const member = await getMemberRequest();
                        localStorage.setItem("se_member", JSON.stringify(member));
                        console.log("  ✅ Subscription verified on final attempt → allowing through");
                        setReady(true);
                    } else {
                        console.log("  ❌ Still not verified after 8s → redirecting to /subscribe");
                        router.replace("/subscribe");
                    }
                } catch (err) {
                    console.error("  ❌ Verify error:", err);
                    // API xato — let through, dashboard will handle
                    setReady(true);
                }
                return;
            }

            // Normal check — localStorage'dagi member data
            console.log("  📦 Normal check (no checkout return)");
            try {
                const stored = localStorage.getItem("se_member");
                if (stored) {
                    const member = JSON.parse(stored);
                    console.log("  📋 Stored member:", JSON.stringify({
                        subscription_tier: member?.subscription_tier,
                        subscription_status: member?.subscription_status,
                    }));
                    if (!hasPaidSubscription(member)) {
                        console.log("  ❌ No paid subscription → redirecting to /subscribe");
                        router.replace("/subscribe");
                        return;
                    }
                } else {
                    console.log("  ⚠️ No se_member in localStorage");
                }
            } catch (err) {
                console.error("  ⚠️ Error parsing localStorage:", err);
            }

            console.log("  ✅ Check passed → allowing through");
            setReady(true);
        };

        checkSubscription();
    }, [router.isReady, router.query]);

    if (!ready) {
        return (
            <div
                style={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--bg)",
                    flexDirection: "column",
                    gap: 12,
                }}
            >
                <div
                    style={{
                        width: 28,
                        height: 28,
                        border: "2px solid var(--border)",
                        borderTopColor: "var(--accent)",
                        borderRadius: "50%",
                        animation: "admin-spin 0.6s linear infinite",
                    }}
                />
                {router.query.checkout === "success" && (
                    <div style={{ color: "var(--muted)", fontSize: 13, fontFamily: "var(--font-body)" }}>
                        Verifying your subscription...
                    </div>
                )}
            </div>
        );
    }

    return <>{children}</>;
}

export default function SubscriptionGuard({ children }: { children: React.ReactNode }) {
    return (
        <AuthGuard>
            <SubscriptionCheck>{children}</SubscriptionCheck>
        </AuthGuard>
    );
}
