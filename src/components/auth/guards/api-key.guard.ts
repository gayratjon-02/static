import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Message } from '../../../libs/enums/common.enum';

@Injectable()
export class ApiKeyGuard implements CanActivate {
	constructor(private readonly configService: ConfigService) {}

	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest();
		const apiKey = request.headers['x-api-key'];
		const expectedKey = this.configService.get<string>('INTERNAL_API_KEY');

		if (!expectedKey || !apiKey || apiKey !== expectedKey) {
			throw new ForbiddenException(Message.NOT_AUTHENTICATED);
		}

		return true;
	}
}
