import { BadRequestException, CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { Message, MemberStatus } from '../../../libs/enums/common.enum';

@Injectable()
export class AuthGuard implements CanActivate {
	constructor(private authService: AuthService) { }

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const bearerToken = request.headers.authorization;

		if (!bearerToken) throw new BadRequestException(Message.TOKEN_NOT_EXIST);

		const token = bearerToken.split(' ')[1];
		if (!token) throw new BadRequestException(Message.TOKEN_NOT_EXIST);

		// Avval admin token sifatida tekshiramiz
		try {
			const adminUser = await this.authService.verifyAdminToken(token);
			if (adminUser) {
				request.authMember = adminUser;
				return true;
			}
		} catch {
			// Admin token emas — oddiy user sifatida davom etamiz
		}

		// Oddiy user token sifatida tekshiramiz
		const authMember = await this.authService.verifyToken(token) as any;
		if (!authMember) throw new UnauthorizedException(Message.NOT_AUTHENTICATED);

		if (authMember.member_status === MemberStatus.SUSPENDED) {
			throw new UnauthorizedException(Message.ACCOUNT_SUSPENDED);
		}
		if (authMember.member_status === MemberStatus.DELETED) {
			throw new UnauthorizedException(Message.ACCOUNT_DELETED);
		}

		// Deny request if ToS is out of date and this is not the ToS acceptance endpoint
		const path = request.route?.path || request.path || '';
		if (authMember.needs_tos_update && !path.includes('/member/accept-tos')) {
			throw new UnauthorizedException('You must accept the updated Terms of Service to continue.');
		}

		request.authMember = authMember;
		return true;
	}
}
