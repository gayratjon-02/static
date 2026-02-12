import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { MemberService } from './member.service';
import { SignupDto } from '../../libs/dto/member/signup.dto';
import { AuthResponse, Member, MemberResponse } from '../../libs/types/member/member.type';
import { LoginDto } from 'src/libs/dto/member/login.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';

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

	//getMember
	@UseGuards(AuthGuard)
	@Get('getMember')
	public async getMember(@AuthMember() authMember: Member): Promise<MemberResponse> {
		console.log('Authenticated member:', authMember);
		return this.memberService.getMember(authMember);
	}
}
