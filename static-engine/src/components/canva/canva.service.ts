import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { EmailService } from '../email/email.service';
import { CreateCanvaOrderDto } from './dto/create-canva-order.dto';

@Injectable()
export class CanvaService {
    private readonly logger = new Logger(CanvaService.name);

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly emailService: EmailService,
    ) { }

    /**
     * Create Canva order and send confirmation email.
     */
    async createOrder(
        userId: string,
        userEmail: string,
        fullName: string | null,
        dto: CreateCanvaOrderDto,
    ): Promise<{ _id: string }> {
        const { data: ad } = await this.databaseService.client
            .from('generated_ads')
            .select('_id')
            .eq('_id', dto.generated_ad_id)
            .eq('user_id', userId)
            .single();

        if (!ad) {
            throw new BadRequestException('Ad not found or does not belong to you');
        }

        const { data: order, error } = await this.databaseService.client
            .from('canva_orders')
            .insert({
                user_id: userId,
                generated_ad_id: dto.generated_ad_id,
                stripe_payment_id: dto.stripe_payment_id,
                price_paid_cents: dto.price_paid_cents,
                status: 'pending',
            })
            .select('_id')
            .single();

        if (error || !order) {
            this.logger.error(`Canva order insert: ${error?.message}`);
            throw new BadRequestException('Failed to create order');
        }

        this.emailService.sendCanvaOrderConfirmation(userEmail, order._id, fullName || undefined).catch(() => { });
        this.logger.log(`Canva order created: ${order._id}, user: ${userId}`);
        return { _id: order._id };
    }

    /**
     * Fulfill Canva order (admin): set link and send email.
     */
    async fulfillOrder(orderId: string, canvaLink: string, _adminUserId: string): Promise<void> {
        const { data: order, error: fetchError } = await this.databaseService.client
            .from('canva_orders')
            .select('_id, user_id, status')
            .eq('_id', orderId)
            .single();

        if (fetchError || !order) {
            throw new NotFoundException('Order not found');
        }
        if (order.status === 'fulfilled') {
            throw new BadRequestException('Order is already fulfilled');
        }

        const now = new Date().toISOString();

        const { error: updateError } = await this.databaseService.client
            .from('canva_orders')
            .update({
                status: 'fulfilled',
                canva_link: canvaLink,
                fulfilled_at: now,
                fulfilled_by: _adminUserId,
            })
            .eq('_id', orderId);

        if (updateError) {
            this.logger.error(`Canva fulfill update: ${updateError.message}`);
            throw new BadRequestException('Failed to update');
        }

        const { data: user } = await this.databaseService.client
            .from('users')
            .select('email, full_name')
            .eq('_id', order.user_id)
            .single();

        if (user?.email) {
            this.emailService.sendCanvaFulfilled(user.email, canvaLink, user.full_name || undefined).catch(() => { });
        }

        this.logger.log(`Canva order fulfilled: ${orderId}`);
    }

    /** Get current user's Canva orders */
    async getMyOrders(userId: string) {
        const { data, error } = await this.databaseService.client
            .from('canva_orders')
            .select('_id, generated_ad_id, status, canva_link, price_paid_cents, created_at, fulfilled_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            this.logger.error(`Canva getMyOrders: ${error.message}`);
            throw new BadRequestException('Failed to load orders');
        }
        return data || [];
    }

    /** Get all Canva orders (Admin-only) */
    async getAllOrdersAdmin() {
        const { data, error } = await this.databaseService.client
            .from('canva_orders')
            .select('*, users:user_id(email, full_name), generated_ads:generated_ad_id(ad_name, image_url_1x1, image_url_16x9, image_url_9x16)')
            .order('created_at', { ascending: false });

        if (error) {
            this.logger.error(`Admin getAllOrders: ${error.message}`);
            throw new BadRequestException('Failed to load all orders');
        }
        return data || [];
    }
}
