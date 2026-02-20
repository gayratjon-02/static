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
        this.fromEmail = this.configService.get<string>('EMAIL_FROM') || 'Static Engine <[EMAIL_ADDRESS]>';
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

    /** Xush kelibsiz email — signup da */
    async sendWelcome(to: string, fullName: string): Promise<void> {
        const subject = "Xush kelibsiz — Static Engine";
        const html = `
            <h2>Salom, ${fullName}!</h2>
            <p>Siz muvaffaqiyatli ro'yxatdan o'tdingiz.</p>
            <p>Obuna rejimini tanlash orqali reklama generatsiyasidan foydalanishni boshlashingiz mumkin.</p>
            <p>Savollar bo'lsa, javob yozing.</p>
            <p>— Static Engine jamoasi</p>
        `;
        await this.send(to, subject, html);
    }

    /** Canva buyurtma tasdiqnomasi */
    async sendCanvaOrderConfirmation(to: string, orderId: string, fullName?: string): Promise<void> {
        const subject = "Canva shablon buyurtmangiz qabul qilindi";
        const html = `
            <h2>Salom${fullName ? `, ${fullName}` : ''}!</h2>
            <p>Canva shablon buyurtmangiz tasdiqlandi.</p>
            <p>Buyurtma raqami: <strong>${orderId}</strong></p>
            <p>Shablon tayyor bo'lgach, sizga link yuboriladi.</p>
            <p>— Static Engine jamoasi</p>
        `;
        await this.send(to, subject, html);
    }

    /** Canva bajarilganda link yuborish */
    async sendCanvaFulfilled(to: string, canvaLink: string, fullName?: string): Promise<void> {
        const subject = "Canva shabloningiz tayyor";
        const html = `
            <h2>Salom${fullName ? `, ${fullName}` : ''}!</h2>
            <p>Canva shabloningiz tayyor.</p>
            <p>Shablonni quyidagi link orqali oching:</p>
            <p><a href="${canvaLink}" target="_blank">${canvaLink}</a></p>
            <p>— Static Engine jamoasi</p>
        `;
        await this.send(to, subject, html);
    }

    /** Obuna bekor qilinganida ogohlantirish */
    async sendSubscriptionCancelled(to: string, fullName?: string): Promise<void> {
        const subject = "Obunangiz bekor qilindi";
        const html = `
            <h2>Salom${fullName ? `, ${fullName}` : ''}!</h2>
            <p>Sizning obunangiz bekor qilindi.</p>
            <p>Yana xizmatdan foydalanish uchun dashboard orqali yangi obuna olishingiz mumkin.</p>
            <p>— Static Engine jamoasi</p>
        `;
        await this.send(to, subject, html);
    }

    /** To'lov muvaffaqiyatsiz bo'lganda ogohlantirish */
    async sendPaymentFailed(to: string, fullName?: string): Promise<void> {
        const subject = "To'lov muvaffaqiyatsiz — Static Engine";
        const html = `
            <h2>Salom${fullName ? `, ${fullName}` : ''}!</h2>
            <p>Obuna to'lovi amalga oshmadi.</p>
            <p>Iltimos, to'lov usulingizni tekshiring yoki boshqa kartadan urinib ko'ring.</p>
            <p>Dashboard orqali billing bo'limida to'lovni yangilashingiz mumkin.</p>
            <p>— Static Engine jamoasi</p>
        `;
        await this.send(to, subject, html);
    }
}
