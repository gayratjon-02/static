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
     * Authenticated user uchun Stripe Customer yaratadi.
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
     * Stripe Checkout Session yaratadi va checkout_url qaytaradi.
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
     * Stripe Customer Portal sessiyasi yaratadi.
     */
    @UseGuards(AuthGuard)
    @Post('portal')
    async createPortal(@AuthMember() authMember: Member) {
        return this.billingService.createPortalSession(authMember._id);
    }

    /**
     * POST /billing/purchase-addon
     * 100 kredit sotib olish uchun checkout sessiya.
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
     * Canva shablonini sotib olish uchun checkout sessiya.
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
        );
    }

    /**
     * POST /billing/verify-checkout
     * Stripe'dan to'g'ridan-to'g'ri subscription holatini tekshiradi.
     * Webhook kelmasa ham, bu endpoint orqali obunani aktivlashtirish mumkin.
     */
    @UseGuards(AuthGuard)
    @Post('verify-checkout')
    async verifyCheckout(@AuthMember() authMember: Member) {
        return this.billingService.verifyCheckoutSession(authMember._id);
    }

    /**
     * GET /billing/plans
     * Barcha aktiv subscription planlarni qaytaradi (public).
     */
    @Get('plans')
    async getPlans() {
        return this.billingService.getPlans();
    }
}
