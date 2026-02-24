import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { EmailService } from '../email/email.service';
import { SignupDto } from '../../libs/dto/member/signup.dto';
import { LoginDto } from '../../libs/dto/member/login.dto';
import { AdminSignupDto } from '../../libs/dto/admin/admin-signup.dto';
import { AdminLoginDto } from '../../libs/dto/admin/admin-login.dto';
import { AuthResponse, Member, TokenPayload } from '../../libs/types/member/member.type';
import { AdminAuthResponse, AdminMember, AdminTokenPayload } from '../../libs/types/admin/admin.type';
import { MemberStatus, Message, SubscriptionStatus, SubscriptionTier } from '../../libs/enums/common.enum';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

const FREE_CREDITS_LIMIT = 25;

@Injectable()
export class AuthService {
	constructor(
		private readonly configService: ConfigService,
		private readonly databaseService: DatabaseService,
		private readonly emailService: EmailService,
	) {}

	// ── USER AUTH ────────────────────────────────────────────────

	async signup(input: SignupDto): Promise<AuthResponse> {
		console.log('AuthService: signup');
		const { email, password, full_name, avatar_url } = input;

		const { data: existingUser } = await this.databaseService.client
			.from('users')
			.select('_id, member_status')
			.eq('email', email)
			.single();

		if (existingUser && existingUser.member_status !== MemberStatus.DELETED) {
			throw new BadRequestException(Message.EMAIL_ALREADY_EXISTS);
		}

		const password_hash = await this.hashPassword(password);

		const { data: newUser, error } = existingUser
			? await this.databaseService.client
					.from('users')
					.update({
						full_name,
						password_hash,
						avatar_url: avatar_url ?? '',
						member_status: MemberStatus.ACTIVE,
						subscription_tier: SubscriptionTier.FREE,
						credits_used: 0,
						credits_limit: FREE_CREDITS_LIMIT,
						addon_credits_remaining: 0,
						updated_at: new Date(),
					})
					.eq('_id', existingUser._id)
					.select()
					.single()
			: await this.databaseService.client
					.from('users')
					.insert({
						email,
						full_name,
						password_hash,
						avatar_url: avatar_url ?? '',
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

		this.emailService.sendWelcome(newUser.email, newUser.full_name ?? '').catch(() => {});

		const { password_hash: _, ...memberWithoutPassword } = newUser;

		return {
			accessToken,
			member: memberWithoutPassword,
			needs_subscription: true,
		};
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
				.select('*')
				.eq('_id', decoded.id)
				.single();

			if (error || !data) throw new UnauthorizedException(Message.NOT_AUTHENTICATED);

			return data as Member;
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
