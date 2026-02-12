import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from '../../../database/database.service';
import { Message } from '../../../libs/enums/common.enum';

export const CREDITS_KEY = 'credits_required';

@Injectable()
export class CreditsGuard implements CanActivate {
	constructor(
		private reflector: Reflector,
		private databaseService: DatabaseService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const creditsRequired = this.reflector.get<number>(CREDITS_KEY, context.getHandler());
		if (!creditsRequired) return true;

		const request = context.switchToHttp().getRequest();
		const user = request.authMember;

		if (!user) throw new ForbiddenException(Message.NOT_AUTHENTICATED);

		// Get user's current credits
		const { data, error } = await this.databaseService.client
			.from('users')
			.select('credits_remaining')
			.eq('id', user.id)
			.single();

		if (error || !data) throw new ForbiddenException(Message.SOMETHING_WENT_WRONG);

		if (data.credits_remaining < creditsRequired) {
			throw new ForbiddenException(Message.INSUFFICIENT_CREDITS);
		}

		return true;
	}
}
