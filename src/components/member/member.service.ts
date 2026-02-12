import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { SignupDto } from '../../libs/dto/member/signup.dto';
import { LoginDto } from 'src/libs/dto/member/login.dto';
import { AdminSignupDto } from '../../libs/dto/admin/admin-signup.dto';
import { AdminLoginDto } from '../../libs/dto/admin/admin-login.dto';
import { AuthResponse, Member, MemberResponse } from '../../libs/types/member/member.type';
import { AdminAuthResponse } from '../../libs/types/admin/admin.type';
import { UpdateMemberDto } from '../../libs/dto/member/update-member.dto';
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

	// admin signup method
	public async adminSignup(input: AdminSignupDto): Promise<AdminAuthResponse> {
		return await this.authService.adminSignup(input);
	}

	// admin login method
	public async adminLogin(input: AdminLoginDto): Promise<AdminAuthResponse> {
		return await this.authService.adminLogin(input);
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

	// updateMember method
	public async updateMember(input: UpdateMemberDto, authMember: Member): Promise<MemberResponse> {
		try {
			// Yangilanish uchun fieldlarni yig'amiz
			const updateData: T = {};

			if (input.full_name) {
				updateData.full_name = input.full_name;
			}

			if (input.avatar_url !== undefined) {
				updateData.avatar_url = input.avatar_url;
			}

			if (input.password) {
				updateData.password_hash = await this.authService.hashPassword(input.password);
			}

			// nothing has been sent
			if (Object.keys(updateData).length === 0) {
				throw new BadRequestException(Message.BAD_REQUEST);
			}

			updateData.updated_at = new Date();

			const { data, error } = await this.databaseService.client
				.from('users')
				.update(updateData)
				.eq('_id', authMember._id)
				.eq('member_status', MemberStatus.ACTIVE)
				.select('*')
				.single();

			if (error || !data) {
				throw new InternalServerErrorException(Message.UPDATE_FAILED);
			}

			const { password_hash, ...memberWithoutPassword } = data;
			return memberWithoutPassword as MemberResponse;
		} catch (err) {
			throw err;
		}
	}

	// getUsage method — credit va obuna holati
	public async getUsage(authMember: Member) {
		try {
			const { data, error } = await this.databaseService.client
				.from('users')
				.select('subscription_tier, subscription_status, credits_used, credits_limit, addon_credits_remaining, billing_cycle_start, billing_cycle_end')
				.eq('_id', authMember._id)
				.eq('member_status', MemberStatus.ACTIVE)
				.single();

			if (error || !data) {
				throw new InternalServerErrorException(Message.NO_DATA_FOUND);
			}

			return data;
		} catch (err) {
			throw err;
		}
	}

	// deleteMember method (soft delete — faqat status o'zgaradi)
	public async deleteMember(authMember: Member): Promise<MemberResponse> {
		try {
			const { data, error } = await this.databaseService.client
				.from('users')
				.update({
					member_status: MemberStatus.DELETED,
					updated_at: new Date(),
				})
				.eq('_id', authMember._id)
				.eq('member_status', MemberStatus.ACTIVE)
				.select('*')
				.single();

			if (error || !data) {
				throw new InternalServerErrorException(Message.REMOVE_FAILED);
			}

			const { password_hash, ...memberWithoutPassword } = data;
			return memberWithoutPassword as MemberResponse;
		} catch (err) {
			throw err;
		}
	}
}
