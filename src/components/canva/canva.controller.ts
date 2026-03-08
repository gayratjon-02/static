import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Member } from '../../libs/types/member/member.type';
import { CanvaService } from './canva.service';
import { CreateCanvaOrderDto } from './dto/create-canva-order.dto';
import { FulfillCanvaOrderDto } from './dto/fulfill-canva-order.dto';

@Controller('canva')
export class CanvaController {
	constructor(private readonly canvaService: CanvaService) {}

	// ── USER ─────────────────────────────────────────────────────

	@UseGuards(AuthGuard)
	@Post('orders')
	async createOrder(@Body() dto: CreateCanvaOrderDto, @AuthMember() authMember: Member) {
		console.log('CanvaController: POST /orders');
		return this.canvaService.createOrder(authMember._id, authMember.email, authMember.full_name, dto);
	}

	@UseGuards(AuthGuard)
	@Get('orders')
	async getMyOrders(@AuthMember() authMember: Member) {
		console.log('CanvaController: GET /orders');
		return this.canvaService.getMyOrders(authMember._id);
	}

	// ── ADMIN (API Key protected) ────────────────────────────────

	@UseGuards(ApiKeyGuard)
	@Get('orders/all')
	async getAllOrdersAdmin() {
		console.log('CanvaController: GET /orders/all');
		return this.canvaService.getAllOrdersAdmin();
	}

	@UseGuards(ApiKeyGuard)
	@Patch('orders/:id/start')
	async startOrder(@Param('id') id: string) {
		console.log('CanvaController: PATCH /orders/:id/start');
		await this.canvaService.startOrder(id, 'admin');
		return { success: true };
	}

	@UseGuards(ApiKeyGuard)
	@Patch('orders/:id/fulfill')
	async fulfillOrder(
		@Param('id') id: string,
		@Body() dto: FulfillCanvaOrderDto,
	) {
		console.log('CanvaController: PATCH /orders/:id/fulfill');
		await this.canvaService.fulfillOrder(id, dto.canva_link, 'admin');
		return { success: true };
	}
}
