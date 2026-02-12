import { BadRequestException, CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service';
import { Message, MemberStatus } from '../../../libs/enums/common.enum';
import { ROLES_KEY, AllRoles } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(
		private reflector: Reflector,
		private authService: AuthService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const roles = this.reflector.get<AllRoles[]>(ROLES_KEY, context.getHandler());
		if (!roles) return true;

		const request = context.switchToHttp().getRequest();
		const bearerToken = request.headers.authorization;
		if (!bearerToken) throw new BadRequestException(Message.TOKEN_NOT_EXIST);

		const token = bearerToken.split(' ')[1];
		if (!token) throw new BadRequestException(Message.TOKEN_NOT_EXIST);

		const authMember = await this.authService.verifyToken(token);
		if (!authMember) throw new ForbiddenException(Message.NOT_AUTHENTICATED);

		if (authMember.member_status === MemberStatus.SUSPENDED) {
			throw new ForbiddenException(Message.ACCOUNT_SUSPENDED);
		}

		// Check member_type OR admin_role
		const hasRole = roles.includes(authMember.member_type) || roles.includes(authMember.admin_role);
		if (!hasRole) throw new ForbiddenException(Message.ONLY_SPECIFIC_ROLES_ALLOWED);

		request.authMember = authMember;
		return true;
	}
}
