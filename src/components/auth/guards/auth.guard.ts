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
		const authMember = await this.authService.verifyToken(token);
		if (!authMember) throw new UnauthorizedException(Message.NOT_AUTHENTICATED);

		if (authMember.member_status === MemberStatus.SUSPENDED) {
			throw new UnauthorizedException(Message.ACCOUNT_SUSPENDED);
		}
		if (authMember.member_status === MemberStatus.DELETED) {
			throw new UnauthorizedException(Message.ACCOUNT_DELETED);
		}

		request.authMember = authMember;
		return true;
	}
}
