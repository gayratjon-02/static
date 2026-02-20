import { MemberAuthType, MemberStatus, SubscriptionTier, SubscriptionStatus } from '../../enums/common.enum';

/** users jadvalidan kelgan to'liq member */
export interface Member {
	_id: string;

	// Account Info
	email: string;
	full_name: string;
	password_hash?: string;
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

	// Billing Cycle
	billing_cycle_start: Date | null;
	billing_cycle_end: Date | null;

	// Timestamps
	created_at: Date;
	updated_at: Date;
}

/** API response'dan password_hash chiqarib tashlangan member */
export type MemberResponse = Omit<Member, 'password_hash'>;

/** Tokenga yoziladigan payload */
export interface TokenPayload {
	id: string;
	subscription_tier: SubscriptionTier;
}

/** Login/Signup response */
export interface AuthResponse {
	accessToken: string;
	member: MemberResponse;
	needs_subscription?: boolean;
}
