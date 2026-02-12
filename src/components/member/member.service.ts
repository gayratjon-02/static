import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { SignupDto } from '../../libs/dto/member/signup.dto';
import { AuthResponse, Member, MemberResponse } from '../../libs/types/member/member.type';
import { LoginDto } from 'src/libs/dto/member/login.dto';
import { T } from 'src/libs/types/common';
import { DatabaseService } from '../../database/database.service';
import { MemberStatus } from '../../libs/enums/common.enum';
import { Message } from '../../libs/enums/common.enum';

@Injectable()
export class MemberService {
	constructor(
		private authService: AuthService,
		private databaseService: DatabaseService,
	) {}

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

	//getMember method
	public async getMember(authMember: Member): Promise<MemberResponse> {
		const { data, error } = await this.databaseService.client
			.from('users')
			.select('*')
			.eq('_id', authMember._id)
			.eq('member_status', MemberStatus.ACTIVE)
			.single();

		if (error || !data) {
			throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		}

		// remove password_hash before returning
		const { password_hash, ...memberWithoutPassword } = data;
		return memberWithoutPassword as MemberResponse;
	}
}
