import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { DatabaseService } from '../../database/database.service';
import { EmailService } from '../email/email.service';
import { AcceptTosDto } from '../../libs/dto/member/accept-tos.dto';
import { SignupDto } from '../../libs/dto/member/signup.dto';
import { GoogleLoginDto, LoginDto } from '../../libs/dto/member/login.dto';
import { AdminSignupDto } from '../../libs/dto/admin/admin-signup.dto';
import { AdminLoginDto } from '../../libs/dto/admin/admin-login.dto';
import { AdminGetUsersQueryDto } from '../../libs/dto/admin/admin-get-users-query.dto';
import { ForgetPasswordDto, UpdateMemberDto } from '../../libs/dto/member/update-member.dto';
import { AuthResponse, CreditWarningLevel, Member, MemberResponse, UsageResponse } from '../../libs/types/member/member.type';
import { AdminAuthResponse } from '../../libs/types/admin/admin.type';
import { AdminRole, MemberStatus, Message, SubscriptionTier } from '../../libs/enums/common.enum';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

interface ResetTokenPayload {
	id: string;
	purpose: string;
}

@Injectable()
export class MemberService {
	constructor(
		private readonly authService: AuthService,
		private readonly databaseService: DatabaseService,
		private readonly emailService: EmailService,
		private readonly configService: ConfigService,
	) { }

	// ── AUTH DELEGATION ──────────────────────────────────────────

	async signup(input: SignupDto, ipAddress?: string, userAgent?: string): Promise<AuthResponse> {
		console.log('MemberService: signup');
		return this.authService.signup(input, ipAddress, userAgent);
	}

	async login(input: LoginDto): Promise<AuthResponse> {
		console.log('MemberService: login');
		return this.authService.login(input);
	}

	async googleLogin(input: GoogleLoginDto, ipAddress: string, userAgent: string): Promise<AuthResponse> {
		console.log('MemberService: googleLogin');
		return this.authService.googleLogin(input, ipAddress, userAgent);
	}

	async adminLogin(input: AdminLoginDto): Promise<AdminAuthResponse> {
		console.log('MemberService: adminLogin');
		return this.authService.adminLogin(input);
	}

	async adminSignupWithCheck(input: AdminSignupDto, authHeader: string): Promise<AdminAuthResponse> {
		console.log('MemberService: adminSignup');
		const { count: adminCount } = await this.databaseService.client
			.from('admin_users')
			.select('*', { count: 'exact', head: true });

		// 1. If no admins exist, allow exactly ONE Super Admin to be created without a token.
		if (!adminCount) {
			if (input.role !== AdminRole.SUPER_ADMIN) {
				throw new BadRequestException('The first admin must be a SUPER_ADMIN.');
			}
			return this.authService.adminSignup(input);
		}

		// 2. If admins exist, we ONLY allow signup via a valid inviteToken.
		if (!input.inviteToken) {
			throw new UnauthorizedException('An invite token is required to register as an admin.');
		}

		// 3. Prevent creating more than one SUPER_ADMIN (Optional but requested: "SUPER ADMIN bir dona bolsin")
		if (input.role === AdminRole.SUPER_ADMIN) {
			throw new BadRequestException('Only one SUPER_ADMIN is allowed in the system.');
		}

		// 4. Validate the invite token
		const { data: invite, error } = await this.databaseService.client
			.from('admin_invites')
			.select('*')
			.eq('token', input.inviteToken)
			.eq('is_used', false)
			.single();

		if (error || !invite) {
			throw new BadRequestException('Invalid or expired invite token.');
		}

		if (new Date(invite.expires_at) < new Date()) {
			throw new BadRequestException('This invite token has expired.');
		}

		if (invite.role !== input.role) {
			throw new BadRequestException(`This token is for a ${invite.role} role, not ${input.role}.`);
		}

		// 5. Proceed with registration
		const response = await this.authService.adminSignup(input);

		// 6. Mark token as used
		await this.databaseService.client
			.from('admin_invites')
			.update({ is_used: true })
			.eq('_id', invite._id);

		return response;
	}

	// ── ADMIN INVITES ──────────────────────────────────────────

	async generateAdminInvite(role: AdminRole, createdBy: string): Promise<{ inviteToken: string, expiresAt: string }> {
		if (role === AdminRole.SUPER_ADMIN) {
			throw new BadRequestException('Cannot invite another SUPER_ADMIN. Only one is allowed.');
		}

		// Generate a simple 16-character token
		const crypto = require('crypto');
		const inviteToken = crypto.randomBytes(8).toString('hex');

		// Expires in 2 days
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 2);

		const { error } = await this.databaseService.client
			.from('admin_invites')
			.insert({
				token: inviteToken,
				role: role,
				created_by: createdBy,
				expires_at: expiresAt.toISOString(),
			});

		if (error) {
			console.error('Failed to create admin invite:', error);
			throw new InternalServerErrorException('Could not generate invite token');
		}

		return { inviteToken, expiresAt: expiresAt.toISOString() };
	}

	// ── PASSWORD RESET (PUBLIC) ──────────────────────────────────

	async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
		console.log('MemberService: forgot-password-flow');
		const SAFE_RESPONSE = { success: true, message: Message.PASSWORD_RESET_EMAIL_SENT };

		const { data: user } = await this.databaseService.client
			.from('users')
			.select('_id, full_name, member_status')
			.eq('email', email)
			.single();

		if (!user || user.member_status === MemberStatus.DELETED || user.member_status === MemberStatus.SUSPENDED) {
			return SAFE_RESPONSE;
		}

		const secret = this.configService.get<string>('JWT_SECRET');
		const token = jwt.sign({ id: user._id, purpose: 'reset_password' }, secret!, { expiresIn: '1h' });
		const resetLink = `${this.configService.get<string>('FRONTEND_URL')}/reset-password?token=${token}`;

		this.emailService.sendPasswordReset(email, resetLink, user.full_name).catch(() => { });

		return SAFE_RESPONSE;
	}

	async executePasswordReset(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
		console.log('MemberService: reset-password-flow');
		try {
			const secret = this.configService.get<string>('JWT_SECRET');
			const decoded = jwt.verify(token, secret!) as ResetTokenPayload;

			if (decoded.purpose !== 'reset_password') {
				throw new BadRequestException(Message.INVALID_TOKEN_PURPOSE);
			}

			const password_hash = await this.authService.hashPassword(newPassword);

			const { error } = await this.databaseService.client
				.from('users')
				.update({ password_hash, updated_at: new Date() })
				.eq('_id', decoded.id);

			if (error) {
				throw new InternalServerErrorException(Message.PASSWORD_RESET_FAILED);
			}

			return { success: true, message: Message.PASSWORD_RESET_SUCCESS };
		} catch (err) {
			if (err instanceof BadRequestException || err instanceof InternalServerErrorException) throw err;
			throw new BadRequestException(Message.INVALID_OR_EXPIRED_RESET_TOKEN);
		}
	}

	// ── AUTHENTICATED USER ───────────────────────────────────────

	async acceptTos(authMember: Member, input: AcceptTosDto, ipAddress?: string, userAgent?: string): Promise<{ success: boolean }> {
		console.log('MemberService: acceptTos');
		await this.authService.acceptTos(authMember._id, input, ipAddress, userAgent);
		return { success: true };
	}

	async forgetPassword(authMember: Member, input: ForgetPasswordDto): Promise<MemberResponse> {
		console.log('MemberService: forgetPassword');
		const { password, confirm_password } = input;

		if (password !== confirm_password) {
			throw new BadRequestException(Message.PASSWORDS_DO_NOT_MATCH);
		}

		const { data: userData, error } = await this.databaseService.client
			.from('users')
			.select('password_hash')
			.eq('_id', authMember._id)
			.eq('member_status', MemberStatus.ACTIVE)
			.single();

		if (error || !userData) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		const isSamePassword = await bcrypt.compare(password, userData.password_hash);
		if (isSamePassword) throw new BadRequestException(Message.NEW_PASSWORD_SAME_AS_OLD);

		const newPasswordHash = await this.authService.hashPassword(password);

		const { data: updatedUser, error: updateError } = await this.databaseService.client
			.from('users')
			.update({ password_hash: newPasswordHash, updated_at: new Date() })
			.eq('_id', authMember._id)
			.eq('member_status', MemberStatus.ACTIVE)
			.select('*')
			.single();

		if (updateError || !updatedUser) throw new InternalServerErrorException(Message.UPDATE_FAILED);

		const { password_hash, ...memberWithoutPassword } = updatedUser;
		return memberWithoutPassword as MemberResponse;
	}

	async getMember(authMember: Member): Promise<MemberResponse> {
		console.log('MemberService: getMember');
		const { data, error } = await this.databaseService.client
			.from('users')
			.select('*')
			.eq('_id', authMember._id)
			.eq('member_status', MemberStatus.ACTIVE)
			.single();

		if (error || !data) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

		const { password_hash, ...memberWithoutPassword } = data;
		return memberWithoutPassword as MemberResponse;
	}

	async updateMember(input: UpdateMemberDto, authMember: Member): Promise<MemberResponse> {
		console.log('MemberService: updateMember');
		const updateData: Record<string, string | Date> = {};

		if (input.full_name) updateData.full_name = input.full_name;
		if (input.avatar_url !== undefined) updateData.avatar_url = input.avatar_url;
		if (input.password) updateData.password_hash = await this.authService.hashPassword(input.password);

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

		if (error || !data) throw new InternalServerErrorException(Message.UPDATE_FAILED);

		const { password_hash, ...memberWithoutPassword } = data;
		return memberWithoutPassword as MemberResponse;
	}

	async deleteMember(authMember: Member): Promise<MemberResponse> {
		console.log('MemberService: deleteMember');
		const { data, error } = await this.databaseService.client
			.from('users')
			.update({ member_status: MemberStatus.DELETED, updated_at: new Date() })
			.eq('_id', authMember._id)
			.eq('member_status', MemberStatus.ACTIVE)
			.select('*')
			.single();

		if (error || !data) throw new InternalServerErrorException(Message.REMOVE_FAILED);

		const { password_hash, ...memberWithoutPassword } = data;
		return memberWithoutPassword as MemberResponse;
	}

	async getUsage(authMember: Member): Promise<UsageResponse> {
		console.log('MemberService: getUsage');
		const [userRes, generatedRes, savedRes] = await Promise.all([
			this.databaseService.client
				.from('users')
				.select(
					'subscription_tier, subscription_status, credits_used, credits_limit, addon_credits_remaining, billing_cycle_start, billing_cycle_end',
				)
				.eq('_id', authMember._id)
				.eq('member_status', MemberStatus.ACTIVE)
				.single(),
			this.databaseService.client
				.from('generated_ads')
				.select('*', { count: 'exact', head: true })
				.eq('user_id', authMember._id),
			this.databaseService.client
				.from('generated_ads')
				.select('*', { count: 'exact', head: true })
				.eq('user_id', authMember._id)
				.eq('is_saved', true),
		]);

		if (userRes.error || !userRes.data) {
			throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		}

		const { credits_used, credits_limit, addon_credits_remaining } = userRes.data;
		const creditsTotal = credits_limit + addon_credits_remaining;
		const creditsRemaining = Math.max(0, creditsTotal - credits_used);
		const usagePercent = creditsTotal > 0 ? Math.round((credits_used / creditsTotal) * 100) : 0;

		const creditWarning = this.buildCreditWarning(creditsRemaining, creditsTotal, usagePercent);

		return {
			...userRes.data,
			credit_warning: creditWarning,
			stats: {
				ads_generated: generatedRes.count ?? 0,
				ads_saved: savedRes.count ?? 0,
			},
		};
	}

	private buildCreditWarning(
		creditsRemaining: number,
		creditsTotal: number,
		usagePercent: number,
	): UsageResponse['credit_warning'] {
		let level: CreditWarningLevel;
		let message: string | null;

		if (creditsRemaining <= 0) {
			level = CreditWarningLevel.DEPLETED;
			message = Message.CREDITS_DEPLETED;
		} else if (usagePercent >= 95) {
			level = CreditWarningLevel.CRITICAL;
			message = Message.CREDITS_CRITICAL;
		} else if (usagePercent >= 80) {
			level = CreditWarningLevel.LOW;
			message = Message.CREDITS_LOW;
		} else {
			level = CreditWarningLevel.NONE;
			message = null;
		}

		return {
			level,
			credits_remaining: creditsRemaining,
			credits_total: creditsTotal,
			usage_percent: usagePercent,
			message,
		};
	}

	async getActivity(authMember: Member, limit: number = 5) {
		console.log('MemberService: getActivity');
		const { data, error } = await this.databaseService.client
			.from('credit_transactions')
			.select('*')
			.eq('user_id', authMember._id)
			.order('created_at', { ascending: false })
			.limit(limit);

		if (error) throw new InternalServerErrorException(Message.SOMETHING_WENT_WRONG);
		if (!data?.length) return [];

		const adIds = [...new Set(
			data.filter((t) => t.reference_type === 'generated_ad').map((t) => t.reference_id),
		)];

		const { data: ads } = await this.databaseService.client
			.from('generated_ads')
			.select('_id, ad_name, brand_id')
			.in('_id', adIds);

		const adMap = new Map(ads?.map((ad) => [ad._id, ad]));

		const brandIds = [...new Set(ads?.map((ad) => ad.brand_id) ?? [])];
		const { data: brands } = await this.databaseService.client
			.from('brands')
			.select('_id, name')
			.in('_id', brandIds);

		const brandMap = new Map(brands?.map((b) => [b._id, b.name]));

		return data.map((t) => {
			const ad = adMap.get(t.reference_id);
			const brandName = ad ? brandMap.get(ad.brand_id) : '';
			const adName = ad?.ad_name ?? 'Ad';
			const brandPrefix = brandName ? `${brandName} - ` : '';

			const ACTIVITY_MAP: Record<string, { label: string; sub: string; icon: string }> = {
				generation: { label: 'Generated ad', sub: `${brandPrefix}${adName}`, icon: 'G' },
				fix_errors: { label: 'Fixed errors', sub: `${brandPrefix}${adName}`, icon: 'F' },
				regenerate_single: { label: 'Regenerated ad', sub: `${brandPrefix}${adName}`, icon: 'R' },
				buy_credits: { label: 'Bought credits', sub: `${Math.abs(t.credits_amount)} credits added`, icon: 'B' },
			};

			const activity = ACTIVITY_MAP[t.transaction_type] ?? { label: 'Activity', sub: '', icon: 'A' };

			return {
				_id: t._id,
				...activity,
				created_at: t.created_at,
				amount: t.credits_amount,
			};
		});
	}

	// ── ADMIN ────────────────────────────────────────────────────

	async adminGetUsers(query: AdminGetUsersQueryDto) {
		console.log('MemberService: adminUsers');
		const page = query.page ?? 1;
		const limit = Math.min(50, query.limit ?? 20);
		const offset = (page - 1) * limit;

		let dbQuery = this.databaseService.client
			.from('users')
			.select(
				'_id, email, full_name, member_status, subscription_tier, subscription_status, credits_used, credits_limit, created_at',
				{ count: 'exact' },
			);

		if (query.search) dbQuery = dbQuery.or(`email.ilike.%${query.search}%,full_name.ilike.%${query.search}%`);
		if (query.tier) dbQuery = dbQuery.eq('subscription_tier', query.tier);
		if (query.status) dbQuery = dbQuery.eq('member_status', query.status);

		const { data, error, count } = await dbQuery
			.order('created_at', { ascending: false })
			.range(offset, offset + limit - 1);

		if (error) throw new InternalServerErrorException(Message.SOMETHING_WENT_WRONG);
		return { list: data ?? [], total: count ?? 0, page, limit };
	}

	async adminBlockUser(targetId: string) {
		console.log('MemberService: adminBlock');
		const { data, error } = await this.databaseService.client
			.from('users')
			.update({ member_status: MemberStatus.SUSPENDED, updated_at: new Date() })
			.eq('_id', targetId)
			.select('_id, email, member_status')
			.single();

		if (error || !data) throw new BadRequestException(Message.USER_NOT_FOUND);
		return data;
	}

	async adminUnblockUser(targetId: string) {
		console.log('MemberService: adminUnblock');
		const { data, error } = await this.databaseService.client
			.from('users')
			.update({ member_status: MemberStatus.ACTIVE, updated_at: new Date() })
			.eq('_id', targetId)
			.select('_id, email, member_status')
			.single();

		if (error || !data) throw new BadRequestException(Message.USER_NOT_FOUND);
		return data;
	}

	async adminDeleteUser(targetId: string) {
		console.log('MemberService: adminDeleteUser');
		// Hard delete from custom users table.
		// NOTE: Supabase auth.users should technically be deleted via admin API,
		// but since we rely on our custom table primarily, deleting here is minimum required.
		const { error } = await this.databaseService.client
			.from('users')
			.delete()
			.eq('_id', targetId);

		if (error) throw new InternalServerErrorException(Message.SOMETHING_WENT_WRONG);
		return { success: true, message: 'User deleted successfully' };
	}


	async adminGetPlatformStats() {
		console.log('MemberService: adminStats');
		const now = new Date();
		const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
		const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

		const [totalUsersRes, activeUsersRes, paidUsersRes, totalAdsRes, todayAdsRes, weekAdsRes, completedAdsRes, failedAdsRes] =
			await Promise.all([
				this.databaseService.client.from('users').select('*', { count: 'exact', head: true }),
				this.databaseService.client.from('users').select('*', { count: 'exact', head: true }).eq('member_status', MemberStatus.ACTIVE),
				this.databaseService.client.from('users').select('*', { count: 'exact', head: true }).neq('subscription_tier', SubscriptionTier.FREE),
				this.databaseService.client.from('generated_ads').select('*', { count: 'exact', head: true }),
				this.databaseService.client.from('generated_ads').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
				this.databaseService.client.from('generated_ads').select('*', { count: 'exact', head: true }).gte('created_at', weekStart),
				this.databaseService.client.from('generated_ads').select('*', { count: 'exact', head: true }).eq('generation_status', 'completed'),
				this.databaseService.client.from('generated_ads').select('*', { count: 'exact', head: true }).eq('generation_status', 'failed'),
			]);

		return {
			users: {
				total: totalUsersRes.count ?? 0,
				active: activeUsersRes.count ?? 0,
				paid: paidUsersRes.count ?? 0,
			},
			generations: {
				total: totalAdsRes.count ?? 0,
				today: todayAdsRes.count ?? 0,
				this_week: weekAdsRes.count ?? 0,
				completed: completedAdsRes.count ?? 0,
				failed: failedAdsRes.count ?? 0,
			},
		};
	}
}
