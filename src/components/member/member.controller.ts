import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { MemberService } from './member.service';
import { SignupDto } from '../../libs/dto/member/signup.dto';
import { LoginDto } from 'src/libs/dto/member/login.dto';
import { AdminSignupDto } from '../../libs/dto/admin/admin-signup.dto';
import { AdminLoginDto } from '../../libs/dto/admin/admin-login.dto';
import { AuthResponse, Member, MemberResponse } from '../../libs/types/member/member.type';
import { AdminAuthResponse } from '../../libs/types/admin/admin.type';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { UpdateMemberDto } from 'src/libs/dto/member/update-member.dto';

@Controller('member')
export class MemberController {
	constructor(private readonly memberService: MemberService) {}

	// test API
	@Get('test')
	public testEndpoint() {
		return this.memberService.testMethod();
	}

	// sign up API
	@Post('signup')
	public async signup(@Body() input: SignupDto): Promise<AuthResponse> {
		return this.memberService.signup(input);
	}

	// login API
	@Post('login')
	public async login(@Body() input: LoginDto): Promise<AuthResponse> {
		console.log('Login input:', input);
		return this.memberService.login(input);
	}

	// admin signup API
	@Post('adminSignup')
	public async adminSignup(@Body() input: AdminSignupDto): Promise<AdminAuthResponse> {
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

	// getUsage — credit va obuna holati
	@UseGuards(AuthGuard)
	@Get('getUsage')
	public async getUsage(@AuthMember() authMember: Member) {
		return this.memberService.getUsage(authMember);
	}
}
