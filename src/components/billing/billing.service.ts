import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from 'src/database/database.service';
import { EmailService } from '../email/email.service';
import Stripe from 'stripe';
import { CanvaService } from '../canva/canva.service';

@Injectable()
export class BillingService {
	private stripe: Stripe;
	private readonly logger = new Logger(BillingService.name);

	constructor(
		private readonly configService: ConfigService,
		private readonly databaseService: DatabaseService,
		private readonly emailService: EmailService,
		private readonly canvaService: CanvaService,
	) {
		this.stripe = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY'));
	}

	// ──────────────────────────────────────────────
	//  CUSTOMER — getOrCreateCustomer (idempotent)
	// ──────────────────────────────────────────────

	async getOrCreateCustomer(
		userId: string,
		email: string,
		fullName: string,
	): Promise<{ stripe_customer_id: string; is_new: boolean }> {
		const { data: user, error: dbError } = await this.databaseService.client
			.from('users')
			.select('stripe_customer_id')
			.eq('_id', userId)
			.single();

		if (dbError) {
			this.logger.error(`DB error (user lookup): ${dbError.message}`);
			throw new InternalServerErrorException('User not found');
		}

		if (user?.stripe_customer_id && user.stripe_customer_id !== '') {
			this.logger.log(`Existing Stripe customer: ${user.stripe_customer_id} (user: ${userId})`);
			return { stripe_customer_id: user.stripe_customer_id, is_new: false };
		}

		let customer: Stripe.Customer;
		try {
			customer = await this.stripe.customers.create({
				email: email,
				name: fullName,
				metadata: {
					user_id: userId,
					platform: 'static-engine',
				},
			});
		} catch (err) {
			const e = err as Error;
			this.logger.error(`Stripe customer creation error: ${e.message}`, e.stack);
			throw new InternalServerErrorException('Payment system error');
		}

		const { error: updateError } = await this.databaseService.client
			.from('users')
			.update({ stripe_customer_id: customer.id })
			.eq('_id', userId);

		if (updateError) {
			this.logger.error(
				`CRITICAL: Stripe customer (${customer.id}) created but not saved to DB! ` +
					`userId: ${userId}, error: ${updateError.message}`,
			);
		}

		this.logger.log(`New Stripe customer created: ${customer.id} (user: ${userId})`);
		return { stripe_customer_id: customer.id, is_new: true };
	}

	// ──────────────────────────────────────────────
	//  CHECKOUT SESSION
	// ──────────────────────────────────────────────

	async createCheckoutSession(
		userId: string,
		email: string,
		fullName: string,
		tier: string,
		billingInterval: string,
	): Promise<{ checkout_url: string }> {
		console.log('\n📦 CREATE CHECKOUT SESSION');
		console.log('  userId:', userId);
		console.log('  email:', email);
		console.log('  tier:', tier);
		console.log('  billingInterval:', billingInterval);

		// 1 — Check for active subscription
		const { data: existingSub } = await this.databaseService.client
			.from('subscriptions')
			.select('_id')
			.eq('user_id', userId)
			.eq('status', 'active')
			.single();

		if (existingSub) {
			console.log('  ⚠️ Already has active subscription:', existingSub._id);
			throw new BadRequestException(
				'You already have an active subscription. Use the billing portal to change your plan.',
			);
		}

		// 2 — Get or create Stripe Customer
		const { stripe_customer_id } = await this.getOrCreateCustomer(userId, email, fullName);
		console.log('  stripe_customer_id:', stripe_customer_id);

		// 3 — Get price_id from subscription_tiers
		const priceField = billingInterval === 'annual' ? 'stripe_annual_price_id' : 'stripe_monthly_price_id';

		const { data: tierData, error: tierError } = await this.databaseService.client
			.from('subscription_tiers')
			.select(`${priceField}, credits_per_month`)
			.eq('tier_key', tier)
			.eq('is_active', true)
			.single();

		console.log('  tierData:', JSON.stringify(tierData));
		console.log('  tierError:', tierError?.message || 'none');

		if (tierError || !tierData || !tierData[priceField]) {
			throw new BadRequestException('Invalid tier or price not configured');
		}

		const frontendUrl = this.configService.get('FRONTEND_URL');
		console.log('  FRONTEND_URL:', frontendUrl);
		console.log('  success_url:', `${frontendUrl}/dashboard?checkout=success`);
		console.log('  cancel_url:', `${frontendUrl}/pricing?checkout=cancelled`);

		// 4 — Create Stripe Checkout Session
		let session: Stripe.Checkout.Session;
		try {
			session = await this.stripe.checkout.sessions.create({
				customer: stripe_customer_id,
				mode: 'subscription',
				payment_method_types: ['card'],
				line_items: [{ price: tierData[priceField], quantity: 1 }],
				metadata: {
					user_id: userId,
					tier: tier,
					billing_interval: billingInterval,
				},
				subscription_data: {
					metadata: {
						user_id: userId,
						tier: tier,
					},
				},
				success_url: `${frontendUrl}/dashboard?checkout=success`,
				cancel_url: `${frontendUrl}/pricing?checkout=cancelled`,
				allow_promotion_codes: true,
			});
		} catch (err) {
			const e = err as Error;
			console.error('  ❌ Checkout session error:', e.message);
			this.logger.error(`Checkout session creation error: ${e.message}`, e.stack);
			throw new InternalServerErrorException('Failed to create checkout session');
		}

		console.log('  ✅ Session created:', session.id);
		console.log('  checkout_url:', session.url);
		this.logger.log(`Checkout session created: ${session.id} (user: ${userId}, tier: ${tier})`);
		return { checkout_url: session.url };
	}

	// ──────────────────────────────────────────────
	//  CUSTOMER PORTAL
	// ──────────────────────────────────────────────

	async createPortalSession(userId: string): Promise<{ portal_url: string }> {
		const { data: user } = await this.databaseService.client
			.from('users')
			.select('stripe_customer_id')
			.eq('_id', userId)
			.single();

		if (!user?.stripe_customer_id || user.stripe_customer_id === '') {
			throw new BadRequestException('No active subscription found');
		}

		let session: Stripe.BillingPortal.Session;
		try {
			session = await this.stripe.billingPortal.sessions.create({
				customer: user.stripe_customer_id,
				return_url: `${this.configService.get('FRONTEND_URL')}/dashboard`,
			});
		} catch (err) {
			const e = err as Error;
			this.logger.error(`Portal session error: ${e.message}`, e.stack);
			throw new InternalServerErrorException('Failed to create portal session');
		}

		return { portal_url: session.url };
	}

	// ──────────────────────────────────────────────
	//  CREDIT ADDON PURCHASE
	// ──────────────────────────────────────────────

	async createAddonCheckout(userId: string, email: string, fullName: string, addonKey: string = 'credits_100'): Promise<{ checkout_url: string }> {
		const { stripe_customer_id } = await this.getOrCreateCustomer(userId, email, fullName);

		const { data: addon } = await this.databaseService.client
			.from('addon_products')
			.select('stripe_price_id, credits, addon_key')
			.eq('addon_key', addonKey)
			.eq('is_active', true)
			.single();

		if (!addon || !addon.stripe_price_id) {
			throw new BadRequestException('Addon not found or not configured');
		}

		let session: Stripe.Checkout.Session;
		try {
			session = await this.stripe.checkout.sessions.create({
				customer: stripe_customer_id,
				mode: 'payment',
				payment_method_types: ['card'],
				line_items: [{ price: addon.stripe_price_id, quantity: 1 }],
				metadata: { user_id: userId, addon_type: addon.addon_key },
				payment_intent_data: {
					metadata: { user_id: userId, addon_type: addon.addon_key },
				},
				success_url: `${this.configService.get('FRONTEND_URL')}/dashboard?addon=success`,
				cancel_url: `${this.configService.get('FRONTEND_URL')}/dashboard?addon=cancelled`,
			});
		} catch (err) {
			const e = err as Error;
			this.logger.error(`Addon checkout error: ${e.message}`, e.stack);
			throw new InternalServerErrorException('Failed to create addon checkout');
		}

		return { checkout_url: session.url };
	}

	// ──────────────────────────────────────────────
	//  CANVA TEMPLATE CHECKOUT
	// ──────────────────────────────────────────────

	async createCanvaCheckout(
		userId: string,
		email: string,
		fullName: string,
		adId: string,
		userTier?: string,
	): Promise<{ checkout_url: string }> {
		const { stripe_customer_id } = await this.getOrCreateCustomer(userId, email, fullName);

		// Tier-based discounts: Growth 20%, Pro 10%, Starter 0%
		const basePrice = 490; // $4.90
		const discountPercent = userTier === 'growth_engine' ? 20 : userTier === 'pro' ? 10 : 0;
		const finalPrice = discountPercent > 0 ? Math.round(basePrice * (1 - discountPercent / 100)) : basePrice;

		if (discountPercent > 0) {
			this.logger.log(
				`Canva checkout: ${discountPercent}% tier discount applied (${userTier}). Price: $${(finalPrice / 100).toFixed(2)}`,
			);
		}

		let session: Stripe.Checkout.Session;
		try {
			session = await this.stripe.checkout.sessions.create({
				customer: stripe_customer_id,
				mode: 'payment',
				payment_method_types: ['card'],
				line_items: [
					{
						price_data: {
							currency: 'usd',
							product_data: {
								name: 'Editable Canva Template',
								description: `A fully editable Canva version of your generated ad.${discountPercent > 0 ? ` (${discountPercent}% ${userTier} discount applied)` : ''}`,
							},
							unit_amount: finalPrice,
						},
						quantity: 1,
					},
				],
				metadata: {
					user_id: userId,
					addon_type: 'canva_template',
					ad_id: adId,
					discount_percent: String(discountPercent),
				},
				payment_intent_data: {
					metadata: { user_id: userId, addon_type: 'canva_template', ad_id: adId },
				},
				success_url: `${this.configService.get('FRONTEND_URL')}/generateAds?canva_checkout=success`,
				cancel_url: `${this.configService.get('FRONTEND_URL')}/generateAds?canva_checkout=cancelled`,
			});
		} catch (err) {
			const e = err as Error;
			this.logger.error(`Canva checkout error: ${e.message}`, e.stack);
			throw new InternalServerErrorException('Failed to create Canva checkout');
		}

		return { checkout_url: session.url };
	}

	// ──────────────────────────────────────────────
	//  PLANS (public)
	// ──────────────────────────────────────────────

	async getPlans() {
		const { data, error } = await this.databaseService.client
			.from('subscription_tiers')
			.select(
				'tier_key, display_name, monthly_price_cents, annual_price_cents, credits_per_month, max_brands, max_products_per_brand, features, display_order',
			)
			.eq('is_active', true)
			.order('display_order', { ascending: true });

		if (error) {
			this.logger.error(`Plans fetch error: ${error.message}`);
			throw new InternalServerErrorException('Failed to load plans');
		}

		return data.map((t) => ({
			...t,
			monthly_price: t.monthly_price_cents / 100,
			annual_price: t.annual_price_cents / 100,
			annual_monthly: Math.round(t.annual_price_cents / 12) / 100,
		}));
	}

	// ──────────────────────────────────────────────
	//  VERIFY CHECKOUT — fallback when webhook is delayed/unavailable
	// ──────────────────────────────────────────────

	async verifyCheckoutSession(userId: string): Promise<{
		verified: boolean;
		subscription_tier?: string;
		subscription_status?: string;
		credits_limit?: number;
	}> {
		console.log('\n🔍 VERIFY CHECKOUT SESSION');
		console.log('  userId:', userId);

		// 1 ─ Get user's stripe_customer_id
		const { data: user, error: userError } = await this.databaseService.client
			.from('users')
			.select('stripe_customer_id, subscription_tier, subscription_status')
			.eq('_id', userId)
			.single();

		if (userError || !user) {
			console.log('  ❌ User not found');
			return { verified: false };
		}

		console.log('  stripe_customer_id:', user.stripe_customer_id);
		console.log('  current tier:', user.subscription_tier);
		console.log('  current status:', user.subscription_status);

		// Already active? No need to verify
		const PAID_TIERS = ['starter', 'pro', 'growth'];
		if (user.subscription_status === 'active' && PAID_TIERS.includes(user.subscription_tier)) {
			console.log('  ✅ Already has active paid subscription');
			const { data: freshUser } = await this.databaseService.client
				.from('users')
				.select('subscription_tier, subscription_status, credits_limit')
				.eq('_id', userId)
				.single();
			return {
				verified: true,
				subscription_tier: freshUser?.subscription_tier,
				subscription_status: freshUser?.subscription_status,
				credits_limit: freshUser?.credits_limit,
			};
		}

		if (!user.stripe_customer_id || user.stripe_customer_id === '') {
			console.log('  ❌ No stripe_customer_id');
			return { verified: false };
		}

		// 2 ─ Query Stripe for active subscriptions of this customer
		let subscriptions: Stripe.ApiList<Stripe.Subscription>;
		try {
			subscriptions = await this.stripe.subscriptions.list({
				customer: user.stripe_customer_id,
				status: 'active',
				limit: 1,
			});
		} catch (err) {
			const e = err as Error;
			console.error('  ❌ Stripe API error:', e.message);
			this.logger.error(`Stripe subscription list error: ${e.message}`);
			return { verified: false };
		}

		console.log('  Stripe subscriptions found:', subscriptions.data.length);

		if (subscriptions.data.length === 0) {
			// Also check for 'trialing' status
			try {
				subscriptions = await this.stripe.subscriptions.list({
					customer: user.stripe_customer_id,
					status: 'trialing',
					limit: 1,
				});
			} catch (err) {
				return { verified: false };
			}

			if (subscriptions.data.length === 0) {
				console.log('  ❌ No active/trialing subscription found on Stripe');
				return { verified: false };
			}
		}

		const subscription = subscriptions.data[0];
		console.log('  ✅ Found Stripe subscription:', subscription.id);
		console.log('  subscription.status:', subscription.status);

		// 3 ─ Get tier from subscription metadata or price_id
		let tier = subscription.metadata?.tier;
		if (!tier) {
			// Fallback: find tier by price_id
			const priceId = subscription.items.data[0]?.price?.id;
			const tierData = await this.getTierByPriceId(priceId);
			tier = tierData?.tier_key;
		}

		if (!tier) {
			console.error('  ❌ Could not determine tier from subscription');
			return { verified: false };
		}

		console.log('  tier:', tier);

		// 4 ─ Get tier credits
		const { data: tierData } = await this.databaseService.client
			.from('subscription_tiers')
			.select('credits_per_month')
			.eq('tier_key', tier)
			.single();

		if (!tierData) {
			console.error('  ❌ Tier not found in subscription_tiers:', tier);
			return { verified: false };
		}

		// 5 ─ Get billing period from subscription
		const item = subscription.items.data[0];
		const periodStart = new Date(item.current_period_start * 1000);
		const periodEnd = new Date(item.current_period_end * 1000);

		const now = new Date().toISOString();

		// 6 ─ Update users table
		const userUpdateData = {
			subscription_tier: tier,
			subscription_status: 'active',
			credits_used: 0,
			credits_limit: tierData.credits_per_month,
			addon_credits_remaining: 0,
			billing_cycle_start: periodStart.toISOString(),
			billing_cycle_end: periodEnd.toISOString(),
			stripe_customer_id: user.stripe_customer_id,
			updated_at: now,
		};
		console.log('  📝 Updating users table:', JSON.stringify(userUpdateData));

		const { error: updateError } = await this.databaseService.client
			.from('users')
			.update(userUpdateData)
			.eq('_id', userId);

		if (updateError) {
			console.error('  ❌ User update error:', updateError.message);
			return { verified: false };
		}

		console.log('  ✅ Users table updated');

		// 7 ─ Upsert subscriptions table
		const billingInterval = subscription.items.data[0]?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly';

		const { error: subError } = await this.databaseService.client.from('subscriptions').upsert(
			{
				user_id: userId,
				stripe_subscription_id: subscription.id,
				stripe_customer_id: user.stripe_customer_id,
				tier: tier,
				status: 'active',
				billing_interval: billingInterval,
				current_period_start: periodStart.toISOString(),
				current_period_end: periodEnd.toISOString(),
				cancel_at_period_end: subscription.cancel_at_period_end,
				updated_at: now,
			},
			{ onConflict: 'stripe_subscription_id' },
		);

		if (subError) {
			console.error('  ❌ Subscription upsert error:', subError.message);
		} else {
			console.log('  ✅ Subscriptions table upserted');
		}

		// 8 ─ Insert credit transaction (if not already recorded)
		const { data: existingTxn } = await this.databaseService.client
			.from('credit_transactions')
			.select('_id')
			.eq('user_id', userId)
			.eq('transaction_type', 'monthly_reset')
			.eq('reference_type', 'subscription')
			.limit(1)
			.single();

		if (!existingTxn) {
			await this.databaseService.client.from('credit_transactions').insert({
				user_id: userId,
				credits_amount: tierData.credits_per_month,
				transaction_type: 'monthly_reset',
				reference_type: 'subscription',
				balance_before: 0,
				balance_after: tierData.credits_per_month,
			});
			console.log('  ✅ Credit transaction inserted');
		}

		console.log('  ✅ VERIFY CHECKOUT COMPLETED: userId=' + userId + ', tier=' + tier);

		return {
			verified: true,
			subscription_tier: tier,
			subscription_status: 'active',
			credits_limit: tierData.credits_per_month,
		};
	}

	// ──────────────────────────────────────────────
	//  WEBHOOK HANDLER
	// ──────────────────────────────────────────────

	async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
		const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

		let event: Stripe.Event;

		try {
			event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
		} catch (err) {
			const e = err as Error;
			this.logger.error(`Webhook signature error: ${e.message}`);
			throw new Error(`Webhook signature verification failed: ${e.message}`);
		}

		this.logger.log(`Webhook event received: ${event.type} (${event.id})`);

		switch (event.type) {
			case 'checkout.session.completed':
				await this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
				break;
			case 'invoice.payment_succeeded':
				await this.onInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
				break;
			case 'invoice.payment_failed':
				await this.onInvoicePaymentFailed(event.data.object as Stripe.Invoice);
				break;
			case 'customer.subscription.updated':
				await this.onSubscriptionUpdated(event.data.object as Stripe.Subscription);
				break;
			case 'customer.subscription.deleted':
				await this.onSubscriptionDeleted(event.data.object as Stripe.Subscription);
				break;
			case 'payment_intent.succeeded':
				await this.onPaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
				break;
			default:
				this.logger.warn(`Unhandled webhook event: ${event.type}`);
		}
	}

	// ── EVENT 1: checkout.session.completed ──────
	private async onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
		const userId = session.metadata?.user_id;
		const tier = session.metadata?.tier;
		const billingInterval = session.metadata?.billing_interval || 'monthly';

		console.log('\n🎉 CHECKOUT COMPLETED');
		console.log('  session.id:', session.id);
		console.log('  userId:', userId);
		console.log('  tier:', tier);
		console.log('  billingInterval:', billingInterval);
		console.log('  session.customer:', session.customer);
		console.log('  session.subscription:', session.subscription);
		console.log('  session.metadata:', JSON.stringify(session.metadata));

		if (!userId || !tier) {
			console.error('  ❌ METADATA MISSING!');
			this.logger.error('Checkout: metadata missing');
			return;
		}

		if (session.metadata?.addon_type === 'credits_100') {
			console.log('  → Addon checkout, skipping subscription logic');
			this.logger.log(`Addon checkout completed: ${session.id}`);
			return;
		}

		if (session.metadata?.addon_type === 'canva_template') {
			console.log('  → Canva Template checkout, creating Canva order');
			const adId = session.metadata.ad_id;
			try {
				// Determine price paid using amount_total
				const pricePaid = session.amount_total || 490;
				await this.canvaService.createOrder(
					userId,
					session.customer_details?.email || '',
					session.customer_details?.name || null,
					{
						generated_ad_id: adId,
						stripe_payment_id: session.payment_intent as string,
						price_paid_cents: pricePaid,
					},
				);
				this.logger.log(`Canva order fulfilled via webhook for session: ${session.id}`);
			} catch (err: any) {
				this.logger.error(`Failed to create Canva order from webhook: ${err.message}`);
			}
			return;
		}

		const subscriptionId = session.subscription as string;
		console.log('  subscriptionId:', subscriptionId);

		const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
		console.log('  subscription.status:', subscription.status);

		// Stripe v20: current_period_start/end is on subscription items
		const item = subscription.items.data[0];
		const periodStart = new Date(item.current_period_start * 1000);
		const periodEnd = new Date(item.current_period_end * 1000);
		console.log('  periodStart:', periodStart.toISOString());
		console.log('  periodEnd:', periodEnd.toISOString());

		const { data: tierData } = await this.databaseService.client
			.from('subscription_tiers')
			.select('credits_per_month')
			.eq('tier_key', tier)
			.single();

		console.log('  tierData:', JSON.stringify(tierData));

		if (!tierData) {
			console.error('  ❌ TIER NOT FOUND in subscription_tiers:', tier);
			this.logger.error(`Tier not found: ${tier}`);
			return;
		}

		const now = new Date().toISOString();

		// UPDATE USERS TABLE
		const userUpdateData = {
			subscription_tier: tier,
			subscription_status: 'active',
			credits_used: 0,
			credits_limit: tierData.credits_per_month,
			addon_credits_remaining: 0,
			billing_cycle_start: periodStart.toISOString(),
			billing_cycle_end: periodEnd.toISOString(),
			stripe_customer_id: session.customer as string,
			updated_at: now,
		};
		console.log('  📝 Updating users table:', JSON.stringify(userUpdateData));

		const { error: userUpdateError } = await this.databaseService.client
			.from('users')
			.update(userUpdateData)
			.eq('_id', userId);

		if (userUpdateError) {
			console.error('  ❌ USER UPDATE ERROR:', userUpdateError.message);
		} else {
			console.log('  ✅ Users table updated successfully');
		}

		// VERIFY USER WAS UPDATED
		const { data: updatedUser } = await this.databaseService.client
			.from('users')
			.select('subscription_tier, subscription_status, credits_limit')
			.eq('_id', userId)
			.single();
		console.log('  📋 User after update:', JSON.stringify(updatedUser));

		// UPSERT SUBSCRIPTIONS TABLE
		const { error: subUpsertError } = await this.databaseService.client.from('subscriptions').upsert(
			{
				user_id: userId,
				stripe_subscription_id: subscriptionId,
				stripe_customer_id: session.customer as string,
				tier: tier,
				status: 'active',
				billing_interval: billingInterval,
				current_period_start: periodStart.toISOString(),
				current_period_end: periodEnd.toISOString(),
				cancel_at_period_end: false,
				updated_at: now,
			},
			{ onConflict: 'stripe_subscription_id' },
		);

		if (subUpsertError) {
			console.error('  ❌ SUBSCRIPTIONS UPSERT ERROR:', subUpsertError.message);
		} else {
			console.log('  ✅ Subscriptions table upserted successfully');
		}

		await this.databaseService.client.from('credit_transactions').insert({
			user_id: userId,
			credits_amount: tierData.credits_per_month,
			transaction_type: 'monthly_reset',
			reference_type: 'subscription',
			balance_before: 0,
			balance_after: tierData.credits_per_month,
		});

		console.log('  ✅ CHECKOUT COMPLETED FULLY: user=' + userId + ', tier=' + tier);
		this.logger.log(`Subscription activated: user=${userId}, tier=${tier}, credits=${tierData.credits_per_month}`);
	}

	// ── EVENT 2: invoice.payment_succeeded ───────
	private async onInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
		if (invoice.billing_reason !== 'subscription_cycle') {
			this.logger.log(`Skip invoice (reason: ${invoice.billing_reason})`);
			return;
		}

		// Stripe v20: Invoice.subscription moved to invoice.parent.subscription_details.subscription
		const rawSub = invoice.parent?.subscription_details?.subscription;
		const subscriptionId = typeof rawSub === 'string' ? rawSub : rawSub?.id;

		if (!subscriptionId) {
			this.logger.error('Invoice: subscriptionId not found');
			return;
		}

		const { data: sub } = await this.databaseService.client
			.from('subscriptions')
			.select('user_id, tier')
			.eq('stripe_subscription_id', subscriptionId)
			.single();

		if (!sub) {
			this.logger.error(`Subscription not found: ${subscriptionId}`);
			return;
		}

		const { data: tierData } = await this.databaseService.client
			.from('subscription_tiers')
			.select('credits_per_month')
			.eq('tier_key', sub.tier)
			.single();

		if (!tierData) return;

		const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
		const item = subscription.items.data[0];
		const periodStart = new Date(item.current_period_start * 1000);
		const periodEnd = new Date(item.current_period_end * 1000);

		const { data: userData } = await this.databaseService.client
			.from('users')
			.select('credits_used, credits_limit, addon_credits_remaining')
			.eq('_id', sub.user_id)
			.single();

		const oldRemaining = userData
			? userData.credits_limit - userData.credits_used + (userData.addon_credits_remaining || 0)
			: 0;

		const now = new Date().toISOString();

		await this.databaseService.client
			.from('users')
			.update({
				credits_used: 0,
				credits_limit: tierData.credits_per_month,
				addon_credits_remaining: 0,
				subscription_status: 'active',
				billing_cycle_start: periodStart.toISOString(),
				billing_cycle_end: periodEnd.toISOString(),
				updated_at: now,
			})
			.eq('_id', sub.user_id);

		await this.databaseService.client
			.from('subscriptions')
			.update({
				status: 'active',
				current_period_start: periodStart.toISOString(),
				current_period_end: periodEnd.toISOString(),
				updated_at: now,
			})
			.eq('stripe_subscription_id', subscriptionId);

		await this.databaseService.client.from('credit_transactions').insert({
			user_id: sub.user_id,
			credits_amount: tierData.credits_per_month,
			transaction_type: 'monthly_reset',
			reference_type: 'subscription',
			balance_before: oldRemaining,
			balance_after: tierData.credits_per_month,
		});

		this.logger.log(`Credit reset: user=${sub.user_id}, limit=${tierData.credits_per_month}`);
	}

	// ── EVENT 3: invoice.payment_failed ──────────
	private async onInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
		const rawSub2 = invoice.parent?.subscription_details?.subscription;
		const subscriptionId = typeof rawSub2 === 'string' ? rawSub2 : rawSub2?.id;

		if (!subscriptionId) return;

		const { data: sub } = await this.databaseService.client
			.from('subscriptions')
			.select('user_id')
			.eq('stripe_subscription_id', subscriptionId)
			.single();

		if (!sub) return;

		const now = new Date().toISOString();

		await this.databaseService.client
			.from('users')
			.update({ subscription_status: 'past_due', updated_at: now })
			.eq('_id', sub.user_id);

		await this.databaseService.client
			.from('subscriptions')
			.update({ status: 'past_due', updated_at: now })
			.eq('stripe_subscription_id', subscriptionId);

		const { data: user } = await this.databaseService.client
			.from('users')
			.select('email, full_name')
			.eq('_id', sub.user_id)
			.single();
		if (user?.email) {
			this.emailService.sendPaymentFailed(user.email, user.full_name || undefined).catch(() => {});
		}

		this.logger.warn(`Payment failed: user=${sub.user_id}`);
	}

	// ── EVENT 4: customer.subscription.updated ───
	private async onSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
		const subscriptionId = subscription.id;

		const { data: sub } = await this.databaseService.client
			.from('subscriptions')
			.select('user_id, tier')
			.eq('stripe_subscription_id', subscriptionId)
			.single();

		if (!sub) return;

		const priceId = subscription.items.data[0]?.price?.id;
		const newTier = await this.getTierByPriceId(priceId);

		if (!newTier) {
			this.logger.warn(`Noma'lum price_id: ${priceId}`);
			return;
		}

		const item = subscription.items.data[0];
		const periodStart = new Date(item.current_period_start * 1000);
		const periodEnd = new Date(item.current_period_end * 1000);

		const now = new Date().toISOString();

		if (newTier.tier_key !== sub.tier) {
			await this.databaseService.client
				.from('users')
				.update({
					subscription_tier: newTier.tier_key,
					credits_limit: newTier.credits_per_month,
					subscription_status: subscription.status === 'active' ? 'active' : subscription.status,
					billing_cycle_start: periodStart.toISOString(),
					billing_cycle_end: periodEnd.toISOString(),
					updated_at: now,
				})
				.eq('_id', sub.user_id);

			this.logger.log(`Tier o'zgarishi: ${sub.tier} → ${newTier.tier_key}`);
		}

		await this.databaseService.client
			.from('subscriptions')
			.update({
				tier: newTier.tier_key,
				status: subscription.status,
				cancel_at_period_end: subscription.cancel_at_period_end,
				canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
				current_period_start: periodStart.toISOString(),
				current_period_end: periodEnd.toISOString(),
				updated_at: now,
			})
			.eq('stripe_subscription_id', subscriptionId);
	}

	// ── EVENT 5: customer.subscription.deleted ───
	private async onSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
		const { data: sub } = await this.databaseService.client
			.from('subscriptions')
			.select('user_id')
			.eq('stripe_subscription_id', subscription.id)
			.single();

		if (!sub) return;

		const { data: user } = await this.databaseService.client
			.from('users')
			.select('email, full_name')
			.eq('_id', sub.user_id)
			.single();
		if (user?.email) {
			this.emailService.sendSubscriptionCancelled(user.email, user.full_name || undefined).catch(() => {});
		}

		const { data: freeTier } = await this.databaseService.client
			.from('subscription_tiers')
			.select('credits_per_month')
			.eq('tier_key', 'free')
			.single();

		const now = new Date().toISOString();
		const newCycleStart = now;
		const newCycleEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

		await this.databaseService.client
			.from('users')
			.update({
				subscription_tier: 'free',
				subscription_status: 'canceled',
				credits_used: 0,
				credits_limit: freeTier?.credits_per_month || 50,
				addon_credits_remaining: 0,
				billing_cycle_start: newCycleStart,
				billing_cycle_end: newCycleEnd,
				updated_at: now,
			})
			.eq('_id', sub.user_id);

		await this.databaseService.client
			.from('subscriptions')
			.update({ status: 'canceled', canceled_at: now, updated_at: now })
			.eq('stripe_subscription_id', subscription.id);

		this.logger.log(`Subscription cancelled: user=${sub.user_id} → free tier`);
	}

	// ── EVENT 6: payment_intent.succeeded (addon) ─
	private async onPaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
		const userId = paymentIntent.metadata?.user_id;
		const addonType = paymentIntent.metadata?.addon_type;

		if (!userId || addonType !== 'credits_100') return;

		const { data: user } = await this.databaseService.client
			.from('users')
			.select('addon_credits_remaining, credits_used, credits_limit')
			.eq('_id', userId)
			.single();

		if (!user) return;

		const currentRemaining = user.credits_limit - user.credits_used + (user.addon_credits_remaining || 0);

		await this.databaseService.client
			.from('users')
			.update({
				addon_credits_remaining: (user.addon_credits_remaining || 0) + 100,
				updated_at: new Date().toISOString(),
			})
			.eq('_id', userId);

		await this.databaseService.client.from('credit_transactions').insert({
			user_id: userId,
			credits_amount: 100,
			transaction_type: 'addon_purchase',
			reference_type: 'stripe_payment',
			balance_before: currentRemaining,
			balance_after: currentRemaining + 100,
		});

		this.logger.log(`Addon credits: user=${userId} +100`);
	}

	// ── HELPER: price_id dan tier topish ─────────
	private async getTierByPriceId(priceId: string) {
		const { data } = await this.databaseService.client
			.from('subscription_tiers')
			.select('tier_key, credits_per_month')
			.or(`stripe_monthly_price_id.eq.${priceId},stripe_annual_price_id.eq.${priceId}`)
			.single();
		return data;
	}
}
