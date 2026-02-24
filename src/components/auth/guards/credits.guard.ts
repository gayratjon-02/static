import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from '../../../database/database.service';
import { SystemConfigService } from '../../system-config/system-config.service';
import { Message } from '../../../libs/enums/common.enum';

export const CREDITS_KEY = 'credits_required';

@Injectable()
export class CreditsGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly databaseService: DatabaseService,
		private readonly systemConfigService: SystemConfigService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const configKey = this.reflector.get<string>(CREDITS_KEY, context.getHandler());
		if (!configKey) return true;

		const creditsRequired = await this.systemConfigService.getNumber(configKey, 0);
		if (creditsRequired === 0) return true;

		const request = context.switchToHttp().getRequest();
		const user = request.authMember;

		if (!user) throw new ForbiddenException(Message.NOT_AUTHENTICATED);

		const { data, error } = await this.databaseService.client
			.from('users')
			.select('credits_used, credits_limit, addon_credits_remaining')
			.eq('_id', user._id)
			.single();

		if (error ?? !data) throw new ForbiddenException(Message.SOMETHING_WENT_WRONG);

		const creditsRemaining =
			(data.credits_limit - data.credits_used) + (data.addon_credits_remaining ?? 0);

		if (creditsRemaining < creditsRequired) {
			throw new ForbiddenException(Message.INSUFFICIENT_CREDITS);
		}

		return true;
	}
}
