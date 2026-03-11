import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { EmailService } from '../email/email.service';
import { Message } from '../../libs/enums/common.enum';
import { CreateCanvaOrderDto } from './dto/create-canva-order.dto';

@Injectable()
export class CanvaService {
	constructor(
		private readonly databaseService: DatabaseService,
		private readonly emailService: EmailService,
	) {}

	async createOrder(
		userId: string,
		userEmail: string,
		fullName: string | null,
		dto: CreateCanvaOrderDto,
	): Promise<{ _id: string }> {
		console.log('CanvaService: POST /orders');

		const { data: ad } = await this.databaseService.client
			.from('generated_ads')
			.select('_id')
			.eq('_id', dto.generated_ad_id)
			.eq('user_id', userId)
			.single();

		if (!ad) {
			throw new BadRequestException(Message.AD_NOT_FOUND);
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

		if (error ?? !order) {
			throw new BadRequestException(Message.CANVA_ORDER_CREATE_FAILED);
		}

		this.emailService.sendCanvaOrderConfirmation(userEmail, order._id, fullName ?? undefined).catch(() => {});

		return { _id: order._id };
	}

	async startOrder(orderId: string, adminUserId: string): Promise<void> {
		console.log('CanvaService: startOrder');

		const { data: order, error: fetchError } = await this.databaseService.client
			.from('canva_orders')
			.select('_id, status')
			.eq('_id', orderId)
			.single();

		if (fetchError ?? !order) {
			throw new NotFoundException(Message.CANVA_ORDER_NOT_FOUND);
		}

		if (order.status !== 'pending') {
			throw new BadRequestException(Message.CANVA_ORDER_UPDATE_FAILED);
		}

		const { error: updateError } = await this.databaseService.client
			.from('canva_orders')
			.update({
				status: 'in_progress',
			})
			.eq('_id', orderId);

		if (updateError) {
			throw new BadRequestException(Message.CANVA_ORDER_UPDATE_FAILED);
		}
	}

	async fulfillOrder(orderId: string, canvaLink: string, adminUserId: string): Promise<void> {
		console.log('CanvaService: fulfillOrder');

		const { data: order, error: fetchError } = await this.databaseService.client
			.from('canva_orders')
			.select('_id, user_id, status')
			.eq('_id', orderId)
			.single();

		if (fetchError ?? !order) {
			throw new NotFoundException(Message.CANVA_ORDER_NOT_FOUND);
		}

		if (order.status === 'fulfilled') {
			throw new BadRequestException(Message.CANVA_ORDER_ALREADY_FULFILLED);
		}

		const { error: updateError } = await this.databaseService.client
			.from('canva_orders')
			.update({
				status: 'fulfilled',
				canva_link: canvaLink,
				fulfilled_at: new Date().toISOString(),
			})
			.eq('_id', orderId);

		if (updateError) {
			console.error('CanvaService: fulfillOrder updateError:', JSON.stringify(updateError));
			throw new BadRequestException(Message.CANVA_ORDER_UPDATE_FAILED);
		}

		const { data: user } = await this.databaseService.client
			.from('users')
			.select('email, full_name')
			.eq('_id', order.user_id)
			.single();

		if (user?.email) {
			this.emailService.sendCanvaFulfilled(user.email, canvaLink, user.full_name ?? undefined).catch(() => {});
		}
	}

	async getMyOrders(userId: string) {
		console.log('CanvaService: GET /orders');

		const { data, error } = await this.databaseService.client
			.from('canva_orders')
			.select('_id, generated_ad_id, status, canva_link, price_paid_cents, created_at, fulfilled_at, generated_ads:generated_ad_id(ad_name, image_url_1x1)')
			.eq('user_id', userId)
			.order('created_at', { ascending: false });

		if (error) {
			throw new BadRequestException(Message.CANVA_ORDERS_LOAD_FAILED);
		}

		return data ?? [];
	}

	async getAllOrdersAdmin() {
		console.log('CanvaService: GET /orders/all');

		const { data, error } = await this.databaseService.client
			.from('canva_orders')
			.select('*, users:user_id(email, full_name), generated_ads:generated_ad_id(ad_name, image_url_1x1, image_url_16x9, image_url_9x16)')
			.order('created_at', { ascending: false });

		if (error) {
			throw new BadRequestException(Message.CANVA_ORDERS_LOAD_FAILED);
		}

		return data ?? [];
	}
}
