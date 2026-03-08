import { Body, Controller, Get, Param, Post, Query, UseGuards, Headers, Req, Delete } from '@nestjs/common';
import { Request } from 'express';
import { MemberService } from './member.service';
import { SignupDto } from '../../libs/dto/member/signup.dto';
import { GoogleLoginDto, LoginDto } from '../../libs/dto/member/login.dto';
import { AdminSignupDto } from '../../libs/dto/admin/admin-signup.dto';
import { AdminLoginDto } from '../../libs/dto/admin/admin-login.dto';
import { GenerateInviteDto } from '../../libs/dto/admin/generate-invite.dto';
import { AdminGetUsersQueryDto } from '../../libs/dto/admin/admin-get-users-query.dto';
import { AuthResponse, Member, MemberResponse, UsageResponse } from '../../libs/types/member/member.type';
import { AdminAuthResponse } from '../../libs/types/admin/admin.type';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AcceptTosDto } from '../../libs/dto/member/accept-tos.dto';
import {
	ForgetPasswordDto,
	RequestPasswordResetDto,
	ResetPasswordDto,
	UpdateMemberDto,
} from '../../libs/dto/member/update-member.dto';
import { AdminRole } from '../../libs/enums/common.enum';

@Controller('member')
export class MemberController {
	constructor(private readonly memberService: MemberService) { }

	// ── PUBLIC ───────────────────────────────────────────────────

	@Post('signup')
	async signup(@Body() input: SignupDto, @Req() req: Request): Promise<AuthResponse> {
		const ipAddress = (req.ip || req.connection.remoteAddress) as string | undefined;
		const userAgent = req.headers['user-agent'] as string | undefined;
		return this.memberService.signup(input, ipAddress, userAgent);
	}

	@Post('login')
	async login(@Body() input: LoginDto): Promise<AuthResponse> {
		return this.memberService.login(input);
	}

	@Post('google-auth')
	async googleLogin(@Body() input: GoogleLoginDto, @Req() req: Request): Promise<AuthResponse> {
		const ipAddress = req.ip || req.connection.remoteAddress || '0.0.0.0';
		const userAgent = req.headers['user-agent'] || 'Unknown';
		return this.memberService.googleLogin(input, ipAddress, userAgent);
	}

	@Post('forgot-password-flow')
	async requestPasswordReset(@Body() input: RequestPasswordResetDto): Promise<{ success: boolean; message: string }> {
		return this.memberService.requestPasswordReset(input.email);
	}

	@Post('reset-password-flow')
	async executePasswordReset(@Body() input: ResetPasswordDto): Promise<{ success: boolean; message: string }> {
		return this.memberService.executePasswordReset(input.token, input.password);
	}

	@Post('adminSignup')
	async adminSignup(
		@Body() input: AdminSignupDto,
		@Headers('authorization') authHeader: string,
	): Promise<AdminAuthResponse> {
		return this.memberService.adminSignupWithCheck(input, authHeader);
	}

	@Post('adminLogin')
	async adminLogin(@Body() input: AdminLoginDto): Promise<AdminAuthResponse> {
		return this.memberService.adminLogin(input);
	}

	@UseGuards(RolesGuard)
	@Roles(AdminRole.SUPER_ADMIN)
	@Post('generateAdminInvite')
	async generateAdminInvite(
		@Body() input: GenerateInviteDto,
		@Req() req: Request
	): Promise<{ inviteToken: string, expiresAt: string }> {
		const adminId = (req as any).authMember._id;
		return this.memberService.generateAdminInvite(input.role, adminId);
	}

	@UseGuards(RolesGuard)
	@Roles(AdminRole.SUPER_ADMIN)
	@Get('adminInvites')
	async adminGetInvites() {
		return this.memberService.adminGetInvites();
	}

	// ── AUTHENTICATED USER ───────────────────────────────────────

	@UseGuards(AuthGuard)
	@Post('accept-tos')
	async acceptTos(@AuthMember() authMember: Member, @Body() input: AcceptTosDto, @Req() req: Request): Promise<{ success: boolean }> {
		const ipAddress = (req.ip || req.connection.remoteAddress) as string | undefined;
		const userAgent = req.headers['user-agent'] as string | undefined;
		return this.memberService.acceptTos(authMember, input, ipAddress, userAgent);
	}

	@UseGuards(AuthGuard)
	@Post('forgetPassword')
	async forgetPassword(@AuthMember() authMember: Member, @Body() input: ForgetPasswordDto): Promise<MemberResponse> {
		return this.memberService.forgetPassword(authMember, input);
	}

	@UseGuards(AuthGuard)
	@Get('getMember')
	async getMember(@AuthMember() authMember: Member): Promise<MemberResponse> {
		return this.memberService.getMember(authMember);
	}

	@UseGuards(AuthGuard)
	@Post('updateMember')
	async updateMember(@Body() input: UpdateMemberDto, @AuthMember() authMember: Member): Promise<MemberResponse> {
		return this.memberService.updateMember(input, authMember);
	}

	@UseGuards(AuthGuard)
	@Post('deleteMember')
	async deleteMember(@AuthMember() authMember: Member): Promise<MemberResponse> {
		return this.memberService.deleteMember(authMember);
	}

	@UseGuards(AuthGuard)
	@Get('getUsage')
	async getUsage(@AuthMember() authMember: Member): Promise<UsageResponse> {
		return this.memberService.getUsage(authMember);
	}

	@UseGuards(AuthGuard)
	@Get('getActivity')
	async getActivity(@AuthMember() authMember: Member) {
		return this.memberService.getActivity(authMember);
	}

	// ── ADMIN ────────────────────────────────────────────────────

	@Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_ADMIN, AdminRole.SUPPORT)
	@UseGuards(RolesGuard)
	@Get('adminUsers')
	async adminGetUsers(@Query() query: AdminGetUsersQueryDto) {
		return this.memberService.adminGetUsers(query);
	}

	@Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_ADMIN)
	@UseGuards(RolesGuard)
	@Post('adminBlock/:id')
	async adminBlockUser(@Param('id') id: string) {
		return this.memberService.adminBlockUser(id);
	}

	@Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_ADMIN)
	@UseGuards(RolesGuard)
	@Post('adminUnblock/:id')
	async adminUnblockUser(@Param('id') id: string) {
		return this.memberService.adminUnblockUser(id);
	}

	@Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_ADMIN)
	@UseGuards(RolesGuard)
	@Delete('adminDelete/:id')
	async adminDeleteUser(@Param('id') id: string) {
		return this.memberService.adminDeleteUser(id);
	}

	@Roles(AdminRole.SUPER_ADMIN)
	@UseGuards(RolesGuard)
	@Get('adminStats')
	async adminGetPlatformStats() {
		return this.memberService.adminGetPlatformStats();
	}
}
