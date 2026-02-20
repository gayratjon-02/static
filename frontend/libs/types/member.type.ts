// =============================================
// TYPES — Member / Auth (mirrors backend member.type.ts)
// =============================================

import {
    MemberAuthType,
    MemberStatus,
    SubscriptionTier,
    SubscriptionStatus,
} from "../enums/member.enum";

/** Full member object from the API */
export interface Member {
    _id: string;

    // Account
    email: string;
    full_name: string;
    avatar_url: string;

    // Auth
    auth_type: MemberAuthType;
    member_type: string;
    member_status: MemberStatus;

    // Stripe
    stripe_customer_id: string;

    // Subscription
    subscription_tier: SubscriptionTier;
    subscription_status: SubscriptionStatus;

    // Credits
    credits_used: number;
    credits_limit: number;
    addon_credits_remaining: number;

    // Billing
    billing_cycle_start: string | null;
    billing_cycle_end: string | null;

    // Timestamps
    created_at: string;
    updated_at: string;
}

/** Login/Signup response from API */
export interface AuthResponse {
    accessToken: string;
    member: Member;
    needs_subscription?: boolean;
}

// ── DTOs ──

/** POST /member/login */
export interface LoginInput {
    email: string;
    password: string;
}

/** POST /member/signup */
export interface SignupInput {
    email: string;
    password: string;
    full_name: string;
    avatar_url?: string;
}
