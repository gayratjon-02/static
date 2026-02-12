import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class WithoutGuard implements CanActivate {
	constructor(private authService: AuthService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const bearerToken = request.headers.authorization;

		if (bearerToken) {
			try {
				const token = bearerToken.split(' ')[1];
				request.authMember = await this.authService.verifyToken(token);
			} catch (err) {
				request.authMember = null;
			}
		} else {
			request.authMember = null;
		}

		return true;
	}
}
