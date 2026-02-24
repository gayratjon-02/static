import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminRole } from '../../libs/enums/common.enum';
import { Member } from '../../libs/types/member/member.type';
import { AdminMember } from '../../libs/types/admin/admin.type';
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

	// ── ADMIN ────────────────────────────────────────────────────

	@Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_ADMIN)
	@UseGuards(RolesGuard)
	@Get('orders/all')
	async getAllOrdersAdmin() {
		console.log('CanvaController: GET /orders/all');
		return this.canvaService.getAllOrdersAdmin();
	}

	@Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_ADMIN)
	@UseGuards(RolesGuard)
	@Patch('orders/:id/fulfill')
	async fulfillOrder(
		@Param('id') id: string,
		@Body() dto: FulfillCanvaOrderDto,
		@AuthMember() adminMember: AdminMember,
	) {
		console.log('CanvaController: PATCH /orders/:id/fulfill');
		await this.canvaService.fulfillOrder(id, dto.canva_link, adminMember._id);
		return { success: true };
	}
}
