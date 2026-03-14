import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminRole, Message } from '../../libs/enums/common.enum';
import { Member } from '../../libs/types/member/member.type';
import { AdminMember } from '../../libs/types/admin/admin.type';
import { CanvaService } from './canva.service';
import { CanvaOAuthService } from './canva-oauth.service';
import { CreateCanvaOrderDto } from './dto/create-canva-order.dto';
import { FulfillCanvaOrderDto } from './dto/fulfill-canva-order.dto';

@Controller('canva')
export class CanvaController {
	constructor(
		private readonly canvaService: CanvaService,
		private readonly canvaOAuthService: CanvaOAuthService,
		private readonly configService: ConfigService,
	) {}

	// ── CANVA OAUTH ───────────────────────────────────────────

	@UseGuards(AuthGuard)
	@Get('auth')
	async getAuthUrl(@AuthMember() authMember: Member) {
		console.log('CanvaController: GET /auth');
		return this.canvaOAuthService.generateAuthUrl(authMember._id);
	}

	@Get('callback')
	async handleCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
		console.log('CanvaController: GET /callback');

		const frontendUrl = this.configService.get<string>('FRONTEND_URL');

		try {
			await this.canvaOAuthService.handleCallback(code, state);
			return res.redirect(`${frontendUrl}/account?canva=connected`);
		} catch (err: unknown) {
			console.error('CanvaController: callback error:', err instanceof Error ? err.message : err);
			return res.redirect(`${frontendUrl}/account?canva=failed`);
		}
	}

	@UseGuards(AuthGuard)
	@Get('connection-status')
	async getConnectionStatus(@AuthMember() authMember: Member) {
		console.log('CanvaController: GET /connection-status');
		return this.canvaOAuthService.getConnectionStatus(authMember._id);
	}

	@UseGuards(AuthGuard)
	@Post('disconnect')
	async disconnect(@AuthMember() authMember: Member) {
		console.log('CanvaController: POST /disconnect');
		await this.canvaOAuthService.revokeToken(authMember._id);
		return { success: true };
	}

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
	@Patch('orders/:id/start')
	async startOrder(
		@Param('id') id: string,
		@AuthMember() adminMember: AdminMember,
	) {
		console.log('CanvaController: PATCH /orders/:id/start');
		await this.canvaService.startOrder(id, adminMember._id);
		return { success: true };
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
