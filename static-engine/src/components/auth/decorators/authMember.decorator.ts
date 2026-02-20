import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const AuthMember = createParamDecorator((data: string, context: ExecutionContext) => {
	const request = context.switchToHttp().getRequest();
	const member = request.authMember;

	if (member) return data ? member?.[data] : member;
	return null;
});
