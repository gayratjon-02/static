import { Controller, Post, Req, Headers, HttpCode, Logger, RawBodyRequest, HttpException, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { BillingService } from './billing.service';

@Controller('webhooks')
export class StripeWebhookController {
    private readonly logger = new Logger(StripeWebhookController.name);

    constructor(private readonly billingService: BillingService) { }

    /**
     * POST /webhooks/stripe
     * Stripe webhook eventlarini qabul qiladi.
     * AuthGuard YO'Q — Stripe o'zi yuboradi, signature orqali verify qilinadi.
     */
    @Post('stripe')
    @HttpCode(200)
    async handleWebhook(
        @Req() req: RawBodyRequest<Request>,
        @Headers('stripe-signature') signature: string,
    ) {
        if (!req.rawBody || !signature) {
            this.logger.error('Webhook: rawBody or signature missing');
            throw new HttpException('Missing rawBody or signature', HttpStatus.BAD_REQUEST);
        }

        try {
            await this.billingService.handleWebhook(req.rawBody, signature);
            this.logger.log('Webhook processed successfully');
            return { received: true };
        } catch (err) {
            const e = err as Error;
            this.logger.error(`Webhook error: ${e.message}`);
            // Return 400 so Stripe will retry the event
            throw new HttpException('Webhook processing failed', HttpStatus.BAD_REQUEST);
        }
    }
}
