import { Body, Controller, Get, Param, Patch, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { CanvaService } from './canva.service';
import { CreateCanvaOrderDto } from './dto/create-canva-order.dto';
import { FulfillCanvaOrderDto } from './dto/fulfill-canva-order.dto';

@Controller('canva')
export class CanvaController {
    constructor(private readonly canvaService: CanvaService) { }

    @UseGuards(AuthGuard)
    @Post('orders')
    async createOrder(@Body() dto: CreateCanvaOrderDto, @AuthMember() auth: any) {
        if (auth?.admin_role) throw new UnauthorizedException('Faqat oddiy foydalanuvchi buyurtma yarata oladi');
        const userId = auth._id;
        const email = auth.email || '';
        const fullName = auth.full_name || null;
        return this.canvaService.createOrder(userId, email, fullName, dto);
    }

    @UseGuards(AuthGuard)
    @Get('orders')
    async getMyOrders(@AuthMember() auth: any) {
        if (auth?.admin_role) throw new UnauthorizedException('Faqat oddiy foydalanuvchi');
        return this.canvaService.getMyOrders(auth._id);
    }

    /** Admin: get all pending and fulfilled Canva orders */
    @UseGuards(AuthGuard)
    @Get('orders/all')
    async getAllOrdersAdmin(@AuthMember() auth: any) {
        if (!auth?.admin_role) throw new UnauthorizedException('Admin access required');
        return this.canvaService.getAllOrdersAdmin();
    }

    /** Admin: fulfill Canva order — set link and send email */
    @UseGuards(AuthGuard)
    @Patch('orders/:id/fulfill')
    async fulfillOrder(
        @Param('id') id: string,
        @Body() dto: FulfillCanvaOrderDto,
        @AuthMember() auth: any,
    ) {
        if (!auth?.admin_role) throw new UnauthorizedException('Admin access required');
        await this.canvaService.fulfillOrder(id, dto.canva_link, auth._id);
        return { success: true };
    }
}
