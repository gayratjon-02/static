// =============================================
// ENUMS — Mirrors backend /src/libs/enums/common.enum.ts
// =============================================

/** User account status */
export enum MemberStatus {
    ACTIVE = "active",
    INACTIVE = "inactive",
    SUSPENDED = "suspended",
    DELETED = "deleted",
}

/** Auth provider type */
export enum MemberAuthType {
    EMAIL = "email",
    GOOGLE = "google",
}

/** Subscription tiers */
export enum SubscriptionTier {
    FREE = "free",
    STARTER = "starter",
    PRO = "pro",
    GROWTH = "growth",
}

/** Subscription status */
export enum SubscriptionStatus {
    ACTIVE = "active",
    INACTIVE = "inactive",
    CANCELED = "canceled",
    PAST_DUE = "past_due",
    TRIALING = "trialing",
}
