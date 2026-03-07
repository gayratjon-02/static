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
    async sendWelcome(to: string, fullName: string, planName?: string, planCredits?: string): Promise<void> {
        const subject = "🎉 Welcome to Static Engine — Let's Build Your Ads!";
        const displayPlan = planName || 'Free';
        const displayCredits = planCredits || '25';
        const html = `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; border-radius: 16px; overflow: hidden;">
                <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 40px 32px 24px; text-align: center;">
                    <h1 style="margin: 0 0 8px; font-size: 28px; font-weight: 800; color: #3ECFCF;">⚡ Static Engine</h1>
                    <p style="margin: 0; color: #94a3b8; font-size: 14px;">AI Ad Generator</p>
                </div>

                <div style="padding: 32px;">
                    <h2 style="margin: 0 0 16px; font-size: 22px; color: #f8fafc;">Welcome aboard, ${fullName}! 🎉</h2>
                    <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                        Thank you for joining Static Engine — the AI-powered platform that helps you create 
                        high-converting Facebook ad creatives, landing pages, and marketing materials in seconds. 
                        Upload your brand, pick a concept, and let AI do the rest.
                    </p>

                    <div style="background: rgba(62, 207, 207, 0.08); border: 1px solid rgba(62, 207, 207, 0.25); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                        <p style="margin: 0 0 4px; font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Your Selected Plan</p>
                        <p style="margin: 0; font-size: 20px; font-weight: 700; color: #3ECFCF;">${displayPlan}</p>
                        <p style="margin: 4px 0 0; font-size: 14px; color: #cbd5e1;">${displayCredits} credits/month</p>
                    </div>

                    <h3 style="margin: 0 0 12px; font-size: 16px; color: #f8fafc;">Here's what you can do:</h3>
                    <table style="width: 100%; margin-bottom: 24px;">
                        <tr>
                            <td style="padding: 8px 12px 8px 0; vertical-align: top; color: #3ECFCF; font-size: 18px;">🎨</td>
                            <td style="padding: 8px 0; color: #cbd5e1; font-size: 14px; line-height: 1.5;"><strong style="color: #f8fafc;">Generate Ad Creatives</strong> — AI-powered static ads optimized for Facebook & Instagram</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 12px 8px 0; vertical-align: top; color: #3ECFCF; font-size: 18px;">🛍️</td>
                            <td style="padding: 8px 0; color: #cbd5e1; font-size: 14px; line-height: 1.5;"><strong style="color: #f8fafc;">Connect Shopify</strong> — Import your products and auto-generate landing pages</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 12px 8px 0; vertical-align: top; color: #3ECFCF; font-size: 18px;">📊</td>
                            <td style="padding: 8px 0; color: #cbd5e1; font-size: 14px; line-height: 1.5;"><strong style="color: #f8fafc;">Ad Library</strong> — Browse and manage all your generated ads in one place</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 12px 8px 0; vertical-align: top; color: #3ECFCF; font-size: 18px;">🚀</td>
                            <td style="padding: 8px 0; color: #cbd5e1; font-size: 14px; line-height: 1.5;"><strong style="color: #f8fafc;">Multiple Brands</strong> — Manage unlimited brands from a single dashboard</td>
                        </tr>
                    </table>

                    <div style="text-align: center; margin-bottom: 24px;">
                        <a href="https://app.staticengine.com/dashboard" 
                           style="display: inline-block; background: linear-gradient(135deg, #3ECFCF, #2bb5b5); color: #0f172a; font-weight: 700; font-size: 15px; padding: 14px 40px; border-radius: 10px; text-decoration: none;">
                            Go to Dashboard →
                        </a>
                    </div>

                    <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0; border-top: 1px solid #334155; padding-top: 20px;">
                        If you have any questions, just reply to this email — we're happy to help.<br/>
                        <br/>
                        — The Static Engine Team<br/>
                        <span style="color: #475569;">Korsica Brands LLC · Los Angeles, California</span>
                    </p>
                </div>
            </div>
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

    /** Reset password email */
    async sendPasswordReset(to: string, resetLink: string, fullName?: string): Promise<void> {
        const subject = "Reset your password — Static Engine";
        const html = `
            <h2>Hello${fullName ? `, ${fullName}` : ''}!</h2>
            <p>You requested a password reset for your Static Engine account.</p>
            <p>Please click the link below to set a new password. This link will expire in 1 hour.</p>
            <p><a href="${resetLink}" target="_blank">Reset Password</a></p>
            <p>If you did not request this, please ignore this email.</p>
            <p>— The Static Engine team</p>
        `;
        await this.send(to, subject, html);
    }
}
