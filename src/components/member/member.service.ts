import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { SignupDto } from '../../libs/dto/member/signup.dto';
import { AuthResponse } from '../../libs/types/member/member.type';
import { LoginDto } from 'src/libs/dto/member/login.dto';

@Injectable()
export class MemberService {
	constructor(private authService: AuthService) {}

	// test method
	public async testMethod() {
		return { message: 'Member service is working!' };
	}

	// signup method
	public async signup(input: SignupDto): Promise<AuthResponse> {
		return await this.authService.signup(input);
	}

	// login method
	public async login(input: LoginDto): Promise<AuthResponse> {
		return await this.authService.login(input);
	}
}
