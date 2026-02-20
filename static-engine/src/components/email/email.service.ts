import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private resend: Resend | null = null;
    private fromEmail: string;

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>('RESEND_API_KEY');
        this.fromEmail = this.configService.get<string>('EMAIL_FROM') || 'Static Engine <onboarding@resend.dev>';
        if (apiKey) {
            this.resend = new Resend(apiKey);
        } else {
            this.logger.warn('RESEND_API_KEY not set — email notifications will be skipped');
        }
    }

    private async send(to: string, subject: string, html: string): Promise<void> {
        if (!this.resend) return;
        try {
            const { error } = await this.resend.emails.send({
                from: this.fromEmail,
                to: [to],
                subject,
                html,
            });
            if (error) {
                this.logger.error(`Email send error: ${error.message}`);
            } else {
                this.logger.log(`Email sent: ${subject} -> ${to}`);
            }
        } catch (err) {
            const e = err as Error;
            this.logger.error(`Email exception: ${e.message}`, e.stack);
        }
    }

    /** Welcome email — sent on signup */
    async sendWelcome(to: string, fullName: string): Promise<void> {
        const subject = "Welcome — Static Engine";
        const html = `
            <h2>Hello, ${fullName}!</h2>
            <p>You have successfully signed up.</p>
            <p>Choose a subscription plan to start using ad generation.</p>
            <p>If you have any questions, just reply to this email.</p>
            <p>— The Static Engine team</p>
        `;
        await this.send(to, subject, html);
    }

    /** Canva order confirmation */
    async sendCanvaOrderConfirmation(to: string, orderId: string, fullName?: string): Promise<void> {
        const subject = "Your Canva template order has been received";
        const html = `
            <h2>Hello${fullName ? `, ${fullName}` : ''}!</h2>
            <p>Your Canva template order has been confirmed.</p>
            <p>Order ID: <strong>${orderId}</strong></p>
            <p>We will send you the link once the template is ready.</p>
            <p>— The Static Engine team</p>
        `;
        await this.send(to, subject, html);
    }

    /** Send Canva link when order is fulfilled */
    async sendCanvaFulfilled(to: string, canvaLink: string, fullName?: string): Promise<void> {
        const subject = "Your Canva template is ready";
        const html = `
            <h2>Hello${fullName ? `, ${fullName}` : ''}!</h2>
            <p>Your Canva template is ready.</p>
            <p>Open the template using the link below:</p>
            <p><a href="${canvaLink}" target="_blank">${canvaLink}</a></p>
            <p>— The Static Engine team</p>
        `;
        await this.send(to, subject, html);
    }

    /** Notify when subscription is cancelled */
    async sendSubscriptionCancelled(to: string, fullName?: string): Promise<void> {
        const subject = "Your subscription has been cancelled";
        const html = `
            <h2>Hello${fullName ? `, ${fullName}` : ''}!</h2>
            <p>Your subscription has been cancelled.</p>
            <p>You can subscribe again anytime from your dashboard.</p>
            <p>— The Static Engine team</p>
        `;
        await this.send(to, subject, html);
    }

    /** Notify when payment fails */
    async sendPaymentFailed(to: string, fullName?: string): Promise<void> {
        const subject = "Payment failed — Static Engine";
        const html = `
            <h2>Hello${fullName ? `, ${fullName}` : ''}!</h2>
            <p>Your subscription payment could not be processed.</p>
            <p>Please check your payment method or try another card.</p>
            <p>You can update your payment details in the billing section of your dashboard.</p>
            <p>— The Static Engine team</p>
        `;
        await this.send(to, subject, html);
    }
}
