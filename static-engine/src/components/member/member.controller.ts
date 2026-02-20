import { Body, Controller, Get, Param, Post, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { MemberService } from './member.service';
import { SignupDto } from '../../libs/dto/member/signup.dto';
import { LoginDto } from 'src/libs/dto/member/login.dto';
import { AdminSignupDto } from '../../libs/dto/admin/admin-signup.dto';
import { AdminLoginDto } from '../../libs/dto/admin/admin-login.dto';
import { AuthResponse, Member, MemberResponse } from '../../libs/types/member/member.type';
import { AdminAuthResponse } from '../../libs/types/admin/admin.type';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { ForgetPasswordDto, UpdateMemberDto } from 'src/libs/dto/member/update-member.dto';

@Controller('member')
export class MemberController {
	constructor(private readonly memberService: MemberService) {}

	// test API
	@Get('test')
	public testEndpoint() {
		console.log('Test endpoint hit');
		return this.memberService.testMethod();
	}

	// sign up API
	@Post('signup')
	public async signup(@Body() input: SignupDto): Promise<AuthResponse> {
		console.log('Signup input:', input);
		return this.memberService.signup(input);
	}

	// login API
	@Post('login')
	public async login(@Body() input: LoginDto): Promise<AuthResponse> {
		console.log('Login input:', input);
		return this.memberService.login(input);
	}

	// forgetPassword user API
	@UseGuards(AuthGuard)
	@Post('forgetPassword')
	public async forgetPassword(
		@AuthMember() authmember: Member,
		@Body() input: ForgetPasswordDto,
	): Promise<MemberResponse> {
		console.log('member controller -> forgetPassword: ');
		return this.memberService.forgetPassword(authmember, input);
	}

	// admin signup API — only existing super_admin can create new admins
	@UseGuards(AuthGuard)
	@Post('adminSignup')
	public async adminSignup(@Body() input: AdminSignupDto, @AuthMember() authMember: any): Promise<AdminAuthResponse> {
		// Only super_admin can create new admin accounts
		if (!authMember?.admin_role || authMember.admin_role !== 'super_admin') {
			throw new UnauthorizedException('Only super_admin can create admin accounts');
		}
		return this.memberService.adminSignup(input);
	}

	// admin login API
	@Post('adminLogin')
	public async adminLogin(@Body() input: AdminLoginDto): Promise<AdminAuthResponse> {
		return this.memberService.adminLogin(input);
	}

	//getMember
	@UseGuards(AuthGuard)
	@Get('getMember')
	public async getMember(@AuthMember() authMember: Member): Promise<MemberResponse> {
		console.log('Authenticated member:', authMember);
		return this.memberService.getMember(authMember);
	}

	// updateMember
	@UseGuards(AuthGuard)
	@Post('updateMember')
	public async updateMember(@Body() input: UpdateMemberDto, @AuthMember() authMember: Member): Promise<MemberResponse> {
		return this.memberService.updateMember(input, authMember);
	}

	// deleteMember (soft delete)
	@UseGuards(AuthGuard)
	@Post('deleteMember')
	public async deleteMember(@AuthMember() authMember: Member): Promise<MemberResponse> {
		return this.memberService.deleteMember(authMember);
	}

	// getUsage — credits and subscription status
	@UseGuards(AuthGuard)
	@Get('getUsage')
	public async getUsage(@AuthMember() authMember: Member) {
		return this.memberService.getUsage(authMember);
	}

	// getActivity
	@UseGuards(AuthGuard)
	@Get('getActivity')
	public async getActivity(@AuthMember() authMember: Member) {
		return this.memberService.getActivity(authMember);
	}

	// ── ADMIN ENDPOINTS ──────────────────────────────────────────

	@UseGuards(AuthGuard)
	@Get('adminUsers')
	public async adminGetUsers(
		@AuthMember() authMember: any,
		@Query('search') search?: string,
		@Query('tier') tier?: string,
		@Query('status') status?: string,
		@Query('page') page?: string,
		@Query('limit') limit?: string,
	) {
		if (!authMember?.admin_role) throw new UnauthorizedException('Admin access required');
		return this.memberService.adminGetUsers({
			search,
			tier,
			status,
			page: page ? parseInt(page) : 1,
			limit: limit ? parseInt(limit) : 20,
		});
	}

	@UseGuards(AuthGuard)
	@Post('adminBlock/:id')
	public async adminBlockUser(
		@Param('id') id: string,
		@AuthMember() authMember: any,
	) {
		if (!authMember?.admin_role) throw new UnauthorizedException('Admin access required');
		return this.memberService.adminBlockUser(id);
	}

	@UseGuards(AuthGuard)
	@Post('adminUnblock/:id')
	public async adminUnblockUser(
		@Param('id') id: string,
		@AuthMember() authMember: any,
	) {
		if (!authMember?.admin_role) throw new UnauthorizedException('Admin access required');
		return this.memberService.adminUnblockUser(id);
	}

	@UseGuards(AuthGuard)
	@Get('adminStats')
	public async adminGetPlatformStats(@AuthMember() authMember: any) {
		if (!authMember?.admin_role) throw new UnauthorizedException('Admin access required');
		return this.memberService.adminGetPlatformStats();
	}
}
