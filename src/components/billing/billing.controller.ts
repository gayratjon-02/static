import { Body, Controller, Get, Post, UseGuards, Param } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { BillingService } from './billing.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Member } from '../../libs/types/member/member.type';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@Controller('billing')
@UseGuards(ThrottlerGuard)
export class BillingController {
    constructor(private readonly billingService: BillingService) { }

    /**
     * POST /billing/create-customer
     * Creates Stripe Customer for the authenticated user.
     */
    @UseGuards(AuthGuard)
    @Post('create-customer')
    async createCustomer(@AuthMember() authMember: Member) {
        return this.billingService.getOrCreateCustomer(
            authMember._id,
            authMember.email,
            authMember.full_name,
        );
    }

    /**
     * POST /billing/create-checkout
     * Creates Stripe Checkout Session and returns checkout_url.
     */
    @UseGuards(AuthGuard)
    @Post('create-checkout')
    async createCheckout(
        @Body() input: CreateCheckoutDto,
        @AuthMember() authMember: Member,
    ) {
        return this.billingService.createCheckoutSession(
            authMember._id,
            authMember.email,
            authMember.full_name,
            input.tier,
            input.billing_interval,
        );
    }

    /**
     * POST /billing/portal
     * Creates Stripe Customer Portal session.
     */
    @UseGuards(AuthGuard)
    @Post('portal')
    async createPortal(@AuthMember() authMember: Member) {
        return this.billingService.createPortalSession(authMember._id);
    }

    /**
     * POST /billing/purchase-addon
     * Checkout session for purchasing 100 credits addon.
     */
    @UseGuards(AuthGuard)
    @Post('purchase-addon')
    async purchaseAddon(@AuthMember() authMember: Member) {
        return this.billingService.createAddonCheckout(
            authMember._id,
            authMember.email,
            authMember.full_name,
        );
    }

    /**
     * POST /billing/create-canva-checkout/:adId
     * Checkout session for purchasing a Canva template.
     */
    @UseGuards(AuthGuard)
    @Post('create-canva-checkout/:adId')
    async createCanvaCheckout(
        @Param('adId') adId: string,
        @AuthMember() authMember: Member,
    ) {
        return this.billingService.createCanvaCheckout(
            authMember._id,
            authMember.email,
            authMember.full_name,
            adId,
            authMember.subscription_tier,
        );
    }

    /**
     * POST /billing/verify-checkout
     * Verifies subscription status directly from Stripe.
     * Can activate subscription via this endpoint if webhook is delayed.
     */
    @UseGuards(AuthGuard)
    @Post('verify-checkout')
    async verifyCheckout(@AuthMember() authMember: Member) {
        return this.billingService.verifyCheckoutSession(authMember._id);
    }

    /**
     * GET /billing/plans
     * Returns all active subscription plans (public).
     */
    @Get('plans')
    async getPlans() {
        return this.billingService.getPlans();
    }
}
