import { BadRequestException, Injectable, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { EmailService } from '../email/email.service';
import { SignupDto } from '../../libs/dto/member/signup.dto';
import { AcceptTosDto } from '../../libs/dto/member/accept-tos.dto';
import { GoogleLoginDto, LoginDto } from '../../libs/dto/member/login.dto';
import { AdminSignupDto } from '../../libs/dto/admin/admin-signup.dto';
import { AdminLoginDto } from '../../libs/dto/admin/admin-login.dto';
import { AuthResponse, Member, TokenPayload } from '../../libs/types/member/member.type';
import { AdminAuthResponse, AdminMember, AdminTokenPayload } from '../../libs/types/admin/admin.type';
import { MemberAuthType, MemberStatus, Message, SubscriptionStatus, SubscriptionTier } from '../../libs/enums/common.enum';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

const FREE_CREDITS_LIMIT = 25;
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

interface GoogleUserInfo {
	email: string;
	name: string;
	picture: string;
	email_verified: boolean;
}

@Injectable()
export class AuthService {
	constructor(
		private readonly configService: ConfigService,
		private readonly databaseService: DatabaseService,
		private readonly emailService: EmailService,
	) { }

	// ── USER AUTH ────────────────────────────────────────────────

	async googleLogin(input: GoogleLoginDto): Promise<AuthResponse> {
		console.log('AuthService: googleLogin');

		const res = await fetch(GOOGLE_USERINFO_URL, {
			headers: { Authorization: `Bearer ${input.access_token}` },
		}).catch(() => {
			throw new BadRequestException(Message.GOOGLE_AUTH_FAILED);
		});

		if (!res.ok) throw new BadRequestException(Message.GOOGLE_AUTH_FAILED);

		const userInfo: GoogleUserInfo = await res.json();
		if (!userInfo.email_verified) throw new BadRequestException(Message.GOOGLE_EMAIL_NOT_VERIFIED);

		const email = userInfo.email;
		const full_name = userInfo.name ?? '';
		const avatar_url = userInfo.picture ?? '';

		const { data: existingUser } = await this.databaseService.client
			.from('users')
			.select('*')
			.eq('email', email)
			.single();

		if (existingUser) {
			if (existingUser.member_status === MemberStatus.SUSPENDED) {
				throw new BadRequestException(Message.ACCOUNT_SUSPENDED);
			}

			if (existingUser.auth_type === MemberAuthType.EMAIL && existingUser.member_status === MemberStatus.ACTIVE) {
				throw new BadRequestException(Message.USE_EMAIL_SIGN_IN);
			}

			if (existingUser.member_status === MemberStatus.DELETED) {
				const { data: reactivated, error } = await this.databaseService.client
					.from('users')
					.update({
						full_name,
						avatar_url,
						auth_type: MemberAuthType.GOOGLE,
						password_hash: null,
						member_status: MemberStatus.ACTIVE,
						subscription_tier: SubscriptionTier.FREE,
						credits_used: 0,
						credits_limit: FREE_CREDITS_LIMIT,
						addon_credits_remaining: 0,
						updated_at: new Date(),
					})
					.eq('_id', existingUser._id)
					.select()
					.single();

				if (error || !reactivated) throw new BadRequestException(Message.GOOGLE_AUTH_FAILED);

				const accessToken = this.createToken({
					id: reactivated._id,
					subscription_tier: reactivated.subscription_tier,
				});

				const { password_hash: _, ...memberWithoutPassword } = reactivated;
				return { accessToken, member: memberWithoutPassword, needs_subscription: true };
			}

			const hasPaidSubscription =
				[SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING].includes(existingUser.subscription_status) &&
				existingUser.subscription_tier !== SubscriptionTier.FREE;

			const accessToken = this.createToken({
				id: existingUser._id,
				subscription_tier: existingUser.subscription_tier,
			});

			const { password_hash: _, ...memberWithoutPassword } = existingUser;
			return { accessToken, member: memberWithoutPassword, needs_subscription: !hasPaidSubscription };
		}

		const { data: newUser, error } = await this.databaseService.client
			.from('users')
			.insert({
				email,
				full_name,
				avatar_url,
				auth_type: MemberAuthType.GOOGLE,
				subscription_tier: SubscriptionTier.FREE,
				credits_limit: FREE_CREDITS_LIMIT,
			})
			.select()
			.single();

		if (error || !newUser) throw new BadRequestException(Message.CREATE_FAILED);

		const accessToken = this.createToken({
			id: newUser._id,
			subscription_tier: newUser.subscription_tier,
		});

		this.emailService.sendWelcome(newUser.email, newUser.full_name ?? '').catch(() => { });

		const { password_hash: _, ...memberWithoutPassword } = newUser;
		return { accessToken, member: memberWithoutPassword, needs_subscription: true };
	}

	async signup(input: SignupDto, ipAddress: string, userAgent: string): Promise<AuthResponse> {
		console.log('AuthService: signup');
		const { email, password, full_name, avatar_url, tos_accepted, tos_version } = input;

		if (!tos_accepted) {
			throw new BadRequestException('You must agree to the Terms of Service and Privacy Policy to continue.');
		}

		const { data: existingUser } = await this.databaseService.client
			.from('users')
			.select('_id, member_status')
			.eq('email', email)
			.single();

		if (existingUser && existingUser.member_status !== MemberStatus.DELETED) {
			throw new BadRequestException(Message.EMAIL_ALREADY_EXISTS);
		}

		const password_hash = await this.hashPassword(password);

		// Start Transaction
		const { data: rpcResult, error } = await this.databaseService.client.rpc('signup_with_tos', {
			p_email: email,
			p_full_name: full_name,
			p_password_hash: password_hash,
			p_avatar_url: avatar_url ?? '',
			p_tos_version: tos_version,
			p_ip_address: ipAddress,
			p_user_agent: userAgent,
			p_existing_user_id: existingUser ? existingUser._id : null
		});

		if (error) {
			console.error('signup_with_tos RPC error:', error);
			throw new BadRequestException(Message.CREATE_FAILED);
		}

		// RETURNS SETOF users → rpcResult is an array
		const newUser = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
		if (!newUser) throw new BadRequestException(Message.CREATE_FAILED);

		const accessToken = this.createToken({
			id: newUser._id,
			subscription_tier: newUser.subscription_tier,
		});

		const tierInfo: Record<string, { name: string; credits: string }> = {
			starter: { name: 'Starter', credits: '250' },
			pro: { name: 'Pro', credits: '750' },
			growth: { name: 'Growth Engine', credits: '2,000' },
			free: { name: 'Free', credits: '25' },
		};
		const plan = tierInfo[input.subscription_tier || 'free'] || tierInfo.free;
		this.emailService.sendWelcome(newUser.email, newUser.full_name ?? '', plan.name, plan.credits).catch(() => { });

		const { password_hash: _, ...memberWithoutPassword } = newUser;

		return {
			accessToken,
			member: memberWithoutPassword,
			needs_subscription: true,
		};
	}

	async acceptTos(memberId: string, input: AcceptTosDto, ipAddress?: string, userAgent?: string): Promise<boolean> {
		if (!input.tos_accepted) {
			throw new BadRequestException('You must agree to the Terms of Service and Privacy Policy.');
		}

		const { error } = await this.databaseService.client
			.from('tos_acceptances')
			.insert({
				user_id: memberId,
				tos_version: input.tos_version,
				ip_address: ipAddress || null,
				user_agent: userAgent || null
			});

		if (error) {
			console.error("ToS acceptance save error:", error);
			throw new InternalServerErrorException('Failed to accept Terms of Service.');
		}

		return true;
	}

	async login(input: LoginDto): Promise<AuthResponse> {
		console.log('AuthService: login');
		const { email, password } = input;

		const { data: user, error } = await this.databaseService.client
			.from('users')
			.select('*')
			.eq('email', email)
			.single();

		if (error || !user) throw new BadRequestException(Message.USER_NOT_FOUND);
		if (user.member_status === MemberStatus.DELETED) throw new BadRequestException(Message.USER_NOT_FOUND);
		if (user.member_status === MemberStatus.SUSPENDED) throw new BadRequestException(Message.ACCOUNT_SUSPENDED);
		if (user.auth_type === MemberAuthType.GOOGLE && !user.password_hash) {
			throw new BadRequestException(Message.USE_GOOGLE_SIGN_IN);
		}

		const isMatch = await bcrypt.compare(password, user.password_hash);
		if (!isMatch) throw new BadRequestException(Message.WRONG_PASSWORD);

		const hasPaidSubscription =
			[SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING].includes(user.subscription_status) &&
			user.subscription_tier !== SubscriptionTier.FREE;

		const accessToken = this.createToken({
			id: user._id,
			subscription_tier: user.subscription_tier,
		});

		const { password_hash: _, ...memberWithoutPassword } = user;

		return {
			accessToken,
			member: memberWithoutPassword,
			needs_subscription: !hasPaidSubscription,
		};
	}

	// ── ADMIN AUTH ───────────────────────────────────────────────

	async adminSignup(input: AdminSignupDto): Promise<AdminAuthResponse> {
		console.log('AuthService: adminSignup');
		const { email, password, name, role } = input;

		const { data: existingAdmin } = await this.databaseService.client
			.from('admin_users')
			.select('_id')
			.eq('email', email)
			.single();

		if (existingAdmin) throw new BadRequestException(Message.EMAIL_ALREADY_EXISTS);

		const password_hash = await this.hashPassword(password);

		const { data, error } = await this.databaseService.client
			.from('admin_users')
			.insert({ email, name, password_hash, role })
			.select()
			.single();

		if (error || !data) throw new BadRequestException(Message.CREATE_FAILED);

		const accessToken = this.createToken({
			id: data._id,
			is_admin: true,
			admin_role: data.role,
		});

		const { password_hash: _, ...adminWithoutPassword } = data;
		return { accessToken, admin: adminWithoutPassword };
	}

	async adminLogin(input: AdminLoginDto): Promise<AdminAuthResponse> {
		console.log('AuthService: adminLogin');
		const { email, password } = input;

		const { data: admin, error } = await this.databaseService.client
			.from('admin_users')
			.select('*')
			.eq('email', email)
			.single();

		if (error || !admin) throw new BadRequestException(Message.USER_NOT_FOUND);

		const isMatch = await bcrypt.compare(password, admin.password_hash);
		if (!isMatch) throw new BadRequestException(Message.WRONG_PASSWORD);

		const accessToken = this.createToken({
			id: admin._id,
			is_admin: true,
			admin_role: admin.role,
		});

		const { password_hash: _, ...adminWithoutPassword } = admin;
		return { accessToken, admin: adminWithoutPassword };
	}

	// ── TOKEN ────────────────────────────────────────────────────

	createToken(payload: TokenPayload | AdminTokenPayload): string {
		const secret = this.configService.get<string>('JWT_SECRET');
		return jwt.sign(payload, secret!, { expiresIn: '7d' });
	}

	async verifyToken(token: string): Promise<Member> {
		console.log('AuthService: verifyToken');
		try {
			const secret = this.configService.get<string>('JWT_SECRET');
			const decoded = jwt.verify(token, secret!) as TokenPayload;

			const { data, error } = await this.databaseService.client
				.from('users')
				.select(`
					*,
					tos_acceptances (
						tos_version
					)
				`)
				.eq('_id', decoded.id)
				.order('accepted_at', { foreignTable: 'tos_acceptances', ascending: false })
				.limit(1, { foreignTable: 'tos_acceptances' })
				.single();

			if (error || !data) throw new UnauthorizedException(Message.NOT_AUTHENTICATED);

			const currentTosVersion = process.env.NEXT_PUBLIC_TOS_VERSION || '2026-03-05';
			let needs_tos_update = true;

			if (data.tos_acceptances && data.tos_acceptances.length > 0) {
				const userLatestVersion = data.tos_acceptances[0].tos_version;
				if (userLatestVersion === currentTosVersion) {
					needs_tos_update = false;
				}
			}

			// Clean up the relation from the returned object
			const { tos_acceptances, ...memberData } = data;

			return { ...memberData, needs_tos_update } as Member & { needs_tos_update: boolean };
		} catch (err) {
			if (err instanceof UnauthorizedException) throw err;
			throw new UnauthorizedException(Message.INVALID_TOKEN);
		}
	}

	async verifyAdminToken(token: string): Promise<AdminMember> {
		console.log('AuthService: verifyAdminToken');
		try {
			const secret = this.configService.get<string>('JWT_SECRET');
			const decoded = jwt.verify(token, secret!) as AdminTokenPayload;

			if (!decoded.is_admin) throw new UnauthorizedException(Message.NOT_AUTHENTICATED);

			const { data, error } = await this.databaseService.client
				.from('admin_users')
				.select('*')
				.eq('_id', decoded.id)
				.single();

			if (error || !data) throw new UnauthorizedException(Message.NOT_AUTHENTICATED);

			const { password_hash: _, ...adminData } = data;
			return { ...adminData, admin_role: data.role } as AdminMember;
		} catch (err) {
			if (err instanceof UnauthorizedException) throw err;
			throw new UnauthorizedException(Message.INVALID_TOKEN);
		}
	}

	// ── HELPERS ──────────────────────────────────────────────────

	async hashPassword(password: string): Promise<string> {
		const salt = await bcrypt.genSalt(12);
		return bcrypt.hash(password, salt);
	}
}
