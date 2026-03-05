import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminRole } from '../../libs/enums/common.enum';
import { SystemConfigService } from './system-config.service';

@Controller('system-config')
export class SystemConfigController {
	constructor(private readonly systemConfigService: SystemConfigService) {}

	@Get()
	async getPublicConfig() {
		console.log('SystemConfigController: GET /system-config');
		const all = await this.systemConfigService.getAll();
		const publicKeys = [
			'credits_per_generation',
			'credits_per_fix_errors',
			'credits_per_regenerate_single',
			'canva_base_price_cents',
			'canva_bundle_price_cents',
			'canva_discount_growth',
			'canva_discount_pro',
		];
		const config: Record<string, unknown> = {};
		for (const entry of all) {
			if (publicKeys.includes(entry.key)) {
				config[entry.key] = entry.value;
			}
		}
		return config;
	}

	@Roles(AdminRole.SUPER_ADMIN)
	@UseGuards(RolesGuard)
	@Get('all')
	async getAllConfig() {
		console.log('SystemConfigController: GET /system-config/all');
		return this.systemConfigService.getAll();
	}

	@Roles(AdminRole.SUPER_ADMIN)
	@UseGuards(RolesGuard)
	@Patch()
	async updateConfig(@Body() body: { key: string; value: unknown }) {
		console.log('SystemConfigController: PATCH /system-config');
		await this.systemConfigService.update(body.key, body.value);
		return { success: true };
	}
}
