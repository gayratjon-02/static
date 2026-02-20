import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { SignupDto } from '../../libs/dto/member/signup.dto';
import { LoginDto } from 'src/libs/dto/member/login.dto';
import { AdminSignupDto } from '../../libs/dto/admin/admin-signup.dto';
import { AdminLoginDto } from '../../libs/dto/admin/admin-login.dto';
import { AuthResponse, Member, MemberResponse } from '../../libs/types/member/member.type';
import { AdminAuthResponse } from '../../libs/types/admin/admin.type';
import { ForgetPasswordDto, UpdateMemberDto } from '../../libs/dto/member/update-member.dto';
import { T } from 'src/libs/types/common';
import { DatabaseService } from '../../database/database.service';
import { MemberStatus } from '../../libs/enums/common.enum';
import { Message } from '../../libs/enums/common.enum';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MemberService {
	constructor(
		private authService: AuthService,
		private databaseService: DatabaseService,
		private emailService: EmailService,
		private configService: ConfigService,
	) { }

	// test method
	public async testMethod() {
		return { message: 'Member service is working!' };
	}

	// signup method
	public async signup(input: SignupDto): Promise<AuthResponse> {
		const result = await this.authService.signup(input);
		// Fire-and-forget welcome email — does not block the response
		if (result?.member?.email) {
			this.emailService.sendWelcome(
				result.member.email,
				result.member.full_name || 'User',
			).catch(() => { });
		}
		return result;
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

	// Request password reset (stateless via short-lived JWT)
	public async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
		const { data: user } = await this.databaseService.client
			.from('users')
			.select('_id, full_name, member_status')
			.eq('email', email)
			.single();

		// Always return success to prevent email enumeration attacks
		if (!user || user.member_status === 'deleted' || user.member_status === 'suspended') {
			return { success: true, message: 'If an account exists, a reset email will be sent.' };
		}

		const secret = this.configService.get<string>('JWT_SECRET');
		const token = jwt.sign({ id: user._id, purpose: 'reset_password' }, secret, { expiresIn: '1h' });

		const frontendUrl = this.configService.get<string>('FRONTEND_URL');
		const resetLink = `${frontendUrl}/reset-password?token=${token}`;

		this.emailService.sendPasswordReset(email, resetLink, user.full_name).catch(console.error);

		return { success: true, message: 'If an account exists, a reset email will be sent.' };
	}

	// Execute password reset
	public async executePasswordReset(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
		try {
			const secret = this.configService.get<string>('JWT_SECRET');
			const decoded: any = jwt.verify(token, secret);

			if (decoded.purpose !== 'reset_password') {
				throw new BadRequestException('Invalid token purpose');
			}

			const password_hash = await this.authService.hashPassword(newPassword);

			const { error } = await this.databaseService.client
				.from('users')
				.update({ password_hash, updated_at: new Date() })
				.eq('_id', decoded.id);

			if (error) {
				throw new InternalServerErrorException('Failed to reset password');
			}

			return { success: true, message: 'Password has been successfully reset' };
		} catch (err) {
			console.error('Execute password reset error:', err);
			throw new BadRequestException('Invalid or expired reset token');
		}
	}

	// forgetPassword — update password (when logged in)
	public async forgetPassword(authmember: Member, input: ForgetPasswordDto): Promise<MemberResponse> {
		const { password, confirm_password } = input;

		// 1. Check new password and confirm match
		if (password !== confirm_password) throw new BadRequestException(Message.PASSWORDS_DO_NOT_MATCH);

		// 2. Get current password hash from DB
		const { data: userData, error } = await this.databaseService.client
			.from('users')
			.select('password_hash')
			.eq('_id', authmember._id)
			.eq('member_status', MemberStatus.ACTIVE)
			.single();

		if (error || !userData) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		// 3. New password must not be the same as current
		const isSamePassword = await bcrypt.compare(password, userData.password_hash);
		if (isSamePassword) throw new BadRequestException(Message.NEW_PASSWORD_SAME_AS_OLD);

		// 4. Hash new password and update
		const newPasswordHash = await this.authService.hashPassword(password);

		const { data: updatedUser, error: updateError } = await this.databaseService.client
			.from('users')
			.update({
				password_hash: newPasswordHash,
				updated_at: new Date(),
			})
			.eq('_id', authmember._id)
			.eq('member_status', MemberStatus.ACTIVE)
			.select('*')
			.single();

		if (updateError || !updatedUser) throw new InternalServerErrorException(Message.UPDATE_FAILED);

		// 5. password_hash olib tashlangan holda qaytarish
		const { password_hash, ...memberWithoutPassword } = updatedUser;
		return memberWithoutPassword as MemberResponse;
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
			// Collect fields to update
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

	// getUsage — credits and subscription status
	// getUsage — credits and subscription status
	public async getUsage(authMember: Member) {
		try {
			// 1. User subscription & credits
			const userPromise = this.databaseService.client
				.from('users')
				.select(
					'subscription_tier, subscription_status, credits_used, credits_limit, addon_credits_remaining, billing_cycle_start, billing_cycle_end',
				)
				.eq('_id', authMember._id)
				.eq('member_status', MemberStatus.ACTIVE)
				.single();

			// 2. Stats: ads generated (all time)
			const generatedPromise = this.databaseService.client
				.from('generated_ads')
				.select('*', { count: 'exact', head: true })
				.eq('user_id', authMember._id);

			// 3. Stats: ads saved
			const savedPromise = this.databaseService.client
				.from('generated_ads')
				.select('*', { count: 'exact', head: true })
				.eq('user_id', authMember._id)
				.eq('is_saved', true);

			const [userRes, generatedRes, savedRes] = await Promise.all([userPromise, generatedPromise, savedPromise]);

			if (userRes.error || !userRes.data) {
				throw new InternalServerErrorException(Message.NO_DATA_FOUND);
			}

			return {
				...userRes.data,
				stats: {
					ads_generated: generatedRes.count || 0,
					ads_saved: savedRes.count || 0,
					canva_templates: 0, // Placeholder for now
				},
			};
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
	// ── ADMIN METHODS ──────────────────────────────────────────

	/** Admin: paginated user list with optional search and tier filter */
	public async adminGetUsers(query: {
		search?: string;
		tier?: string;
		status?: string;
		page?: number;
		limit?: number;
	}) {
		const page = Math.max(1, query.page || 1);
		const limit = Math.min(50, query.limit || 20);
		const offset = (page - 1) * limit;

		let dbQuery = this.databaseService.client
			.from('users')
			.select('_id, email, full_name, member_status, subscription_tier, subscription_status, credits_used, credits_limit, created_at', { count: 'exact' });

		if (query.search) {
			dbQuery = dbQuery.or(`email.ilike.%${query.search}%,full_name.ilike.%${query.search}%`);
		}
		if (query.tier) {
			dbQuery = dbQuery.eq('subscription_tier', query.tier);
		}
		if (query.status) {
			dbQuery = dbQuery.eq('member_status', query.status);
		}

		const { data, error, count } = await dbQuery
			.order('created_at', { ascending: false })
			.range(offset, offset + limit - 1);

		if (error) throw new InternalServerErrorException(Message.SOMETHING_WENT_WRONG);
		return { list: data || [], total: count || 0, page, limit };
	}

	/** Admin: suspend a user */
	public async adminBlockUser(targetId: string) {
		const { data, error } = await this.databaseService.client
			.from('users')
			.update({ member_status: MemberStatus.SUSPENDED, updated_at: new Date() })
			.eq('_id', targetId)
			.select('_id, email, member_status')
			.single();

		if (error || !data) throw new BadRequestException(Message.USER_NOT_FOUND);
		return data;
	}

	/** Admin: reactivate a suspended user */
	public async adminUnblockUser(targetId: string) {
		const { data, error } = await this.databaseService.client
			.from('users')
			.update({ member_status: MemberStatus.ACTIVE, updated_at: new Date() })
			.eq('_id', targetId)
			.select('_id, email, member_status')
			.single();

		if (error || !data) throw new BadRequestException(Message.USER_NOT_FOUND);
		return data;
	}

	/** Admin: platform-wide statistics */
	public async adminGetPlatformStats() {
		const now = new Date();
		const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
		const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

		const [
			totalUsersRes, activeUsersRes, paidUsersRes,
			totalAdsRes, todayAdsRes, weekAdsRes,
			completedAdsRes, failedAdsRes,
		] = await Promise.all([
			this.databaseService.client.from('users').select('*', { count: 'exact', head: true }),
			this.databaseService.client.from('users').select('*', { count: 'exact', head: true }).eq('member_status', MemberStatus.ACTIVE),
			this.databaseService.client.from('users').select('*', { count: 'exact', head: true }).neq('subscription_tier', 'free'),
			this.databaseService.client.from('generated_ads').select('*', { count: 'exact', head: true }),
			this.databaseService.client.from('generated_ads').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
			this.databaseService.client.from('generated_ads').select('*', { count: 'exact', head: true }).gte('created_at', weekStart),
			this.databaseService.client.from('generated_ads').select('*', { count: 'exact', head: true }).eq('generation_status', 'completed'),
			this.databaseService.client.from('generated_ads').select('*', { count: 'exact', head: true }).eq('generation_status', 'failed'),
		]);

		return {
			users: {
				total: totalUsersRes.count || 0,
				active: activeUsersRes.count || 0,
				paid: paidUsersRes.count || 0,
			},
			generations: {
				total: totalAdsRes.count || 0,
				today: todayAdsRes.count || 0,
				this_week: weekAdsRes.count || 0,
				completed: completedAdsRes.count || 0,
				failed: failedAdsRes.count || 0,
			},
		};
	}

	// getActivity method — oxirgi activitylar (credit transactions asosida)
	public async getActivity(authMember: Member, limit: number = 5) {
		const { data, error } = await this.databaseService.client
			.from('credit_transactions')
			.select('*')
			.eq('user_id', authMember._id)
			.order('created_at', { ascending: false })
			.limit(limit);

		if (error) throw new InternalServerErrorException(Message.SOMETHING_WENT_WRONG);
		if (!data || data.length === 0) return [];

		// Collect reference IDs (for generated_ad only)
		const adIds = data.filter((t) => t.reference_type === 'generated_ad').map((t) => t.reference_id);

		const uniqueAdIds = [...new Set(adIds)];

		// Get ad details
		const { data: ads } = await this.databaseService.client
			.from('generated_ads')
			.select('_id, ad_name, brand_id')
			.in('_id', uniqueAdIds);

		const adMap = new Map(ads?.map((ad) => [ad._id, ad]));

		// Get brand details
		const brandIds = ads?.map((ad) => ad.brand_id) || [];
		const uniqueBrandIds = [...new Set(brandIds)];

		const { data: brands } = await this.databaseService.client
			.from('brands')
			.select('_id, name')
			.in('_id', uniqueBrandIds);

		const brandMap = new Map(brands?.map((b) => [b._id, b.name]));

		// Map transactions to readable activity
		return data.map((t) => {
			let label = 'Activity';
			let sub = '';
			let icon = 'A'; // Default

			if (t.reference_type === 'generated_ad') {
				const ad = adMap.get(t.reference_id);
				const brandName = ad ? brandMap.get(ad.brand_id) : '';
				const adName = ad?.ad_name || 'Ad';

				switch (t.transaction_type) {
					case 'generation':
						label = 'Generated ad';
						sub = `${brandName ? brandName + ' - ' : ''}${adName}`;
						icon = 'G';
						break;
					case 'fix_errors':
						label = 'Fixed errors';
						sub = `${brandName ? brandName + ' - ' : ''}${adName}`;
						icon = 'F';
						break;
					case 'regenerate_single':
						label = 'Regenerated ad';
						sub = `${brandName ? brandName + ' - ' : ''}${adName}`;
						icon = 'R';
						break;
					default:
						label = 'Ad generation';
						sub = adName;
						break;
				}
			} else {
				// Boshqa transaction turlari (masalan, 'buy_credits')
				if (t.transaction_type === 'buy_credits') {
					label = 'Bought credits';
					sub = `${Math.abs(t.credits_amount)} credits added`;
					icon = 'B';
				}
			}

			return {
				_id: t._id,
				label,
				sub,
				icon,
				created_at: t.created_at,
				amount: t.credits_amount,
			};
		});
	}
}
