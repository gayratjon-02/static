import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { EmailService } from '../email/email.service';
import { Message } from '../../libs/enums/common.enum';
import { SignupDto } from '../../libs/dto/member/signup.dto';
import { LoginDto } from '../../libs/dto/member/login.dto';
import { AdminSignupDto } from '../../libs/dto/admin/admin-signup.dto';
import { AdminLoginDto } from '../../libs/dto/admin/admin-login.dto';
import { AuthResponse } from '../../libs/types/member/member.type';
import { AdminAuthResponse } from '../../libs/types/admin/admin.type';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
	constructor(
		private configService: ConfigService,
		private databaseService: DatabaseService,
		private emailService: EmailService,
	) { }

	/** Signup progress */
	public async signup(input: SignupDto): Promise<AuthResponse> {
		const { email, password, full_name, avatar_url } = input;

		// Signup always starts with free tier — updated via webhook after payment
		const tier = 'free';
		const creditsLimit = 25;

		try {
			// 1. Email uniqueness check (faqat active/inactive userlar orasida)
			const { data: existingUser } = await this.databaseService.client
				.from('users')
				.select('_id, member_status')
				.eq('email', email)
				.single();

			if (existingUser && existingUser.member_status !== 'deleted') {
				throw new BadRequestException(Message.EMAIL_ALREADY_EXISTS);
			}

			// 2. Password hash
			const password_hash = await this.hashPassword(password);

			let newUser: any;

			if (existingUser && existingUser.member_status === 'deleted') {
				// 3a. Deleted user bor — qayta aktivatsiya (reuse row)
				const { data, error } = await this.databaseService.client
					.from('users')
					.update({
						full_name,
						password_hash,
						avatar_url: avatar_url || '',
						member_status: 'active',
						subscription_tier: tier,
						credits_used: 0,
						credits_limit: creditsLimit,
						addon_credits_remaining: 0,
						updated_at: new Date(),
					})
					.eq('_id', existingUser._id)
					.select()
					.single();

				if (error || !data) throw new BadRequestException(Message.CREATE_FAILED);
				newUser = data;
			} else {
				// 3b. Create new user (Free tier: 25 credits)
				const { data, error } = await this.databaseService.client
					.from('users')
					.insert({
						email,
						full_name,
						password_hash,
						avatar_url: avatar_url || '',
						subscription_tier: tier,
						credits_limit: creditsLimit,
					})
					.select()
					.single();

				if (error || !data) throw new BadRequestException(Message.CREATE_FAILED);
				newUser = data;
			}

			// 4. JWT token
			const accessToken = this.createToken({
				id: newUser._id,
				subscription_tier: newUser.subscription_tier,
			});

			// 5. Welcome email (on signup)
			this.emailService.sendWelcome(newUser.email, newUser.full_name || '').catch(() => {});

			// 6. remove password hash
			const { password_hash: _, ...memberWithoutPassword } = newUser;

			return {
				accessToken,
				member: memberWithoutPassword,
				needs_subscription: true,
			};
		} catch (err: any) {
			console.log('Error, AuthService.signup:', err.message);
			if (err instanceof BadRequestException) throw err;
			throw new BadRequestException(Message.SOMETHING_WENT_WRONG);
		}
	}

	/** Login progress */
	public async login(input: LoginDto): Promise<AuthResponse> {
		const { email, password } = input;

		try {
			// 1. Find user by email
			const { data: user, error } = await this.databaseService.client
				.from('users')
				.select('*')
				.eq('email', email)
				.single();

			if (error || !user) throw new BadRequestException(Message.USER_NOT_FOUND);

			// 2. Check member status
			if (user.member_status === 'deleted') throw new BadRequestException(Message.USER_NOT_FOUND);
			if (user.member_status === 'suspended') throw new BadRequestException(Message.ACCOUNT_SUSPENDED);

			// 3. Compare passwords
			const isMatch = await this.comparePasswords(password, user.password_hash);
			if (!isMatch) throw new BadRequestException(Message.WRONG_PASSWORD);

			// 4. Check subscription — allow login but return needs_subscription flag
			const PAID_TIERS = ['starter', 'pro', 'growth'];
			const ALLOWED_STATUSES = ['active', 'trialing'];
			const hasPaidSubscription = ALLOWED_STATUSES.includes(user.subscription_status)
				&& PAID_TIERS.includes(user.subscription_tier);

			// 5. JWT token
			const accessToken = this.createToken({
				id: user._id,
				subscription_tier: user.subscription_tier,
			});

			// 6. Remove password_hash
			const { password_hash: _, ...memberWithoutPassword } = user;

			return {
				accessToken,
				member: memberWithoutPassword,
				needs_subscription: !hasPaidSubscription,
			};
		} catch (err: any) {
			console.log('Error, AuthService.login:', err.message);
			if (err instanceof BadRequestException) throw err;
			throw new BadRequestException(Message.SOMETHING_WENT_WRONG);
		}
	}

	/** hash password*/
	public async hashPassword(password: string): Promise<string> {
		const salt = await bcrypt.genSalt(12);
		return await bcrypt.hash(password, salt);
	}

	/** compare passwords */
	public async comparePasswords(password: string, hashedPassword: string): Promise<boolean> {
		return await bcrypt.compare(password, hashedPassword);
	}

	/** Admin Signup */
	public async adminSignup(input: AdminSignupDto): Promise<AdminAuthResponse> {
		const { email, password, name, role } = input;

		try {
			// 1. Email uniqueness check
			const { data: existingAdmin } = await this.databaseService.client
				.from('admin_users')
				.select('_id')
				.eq('email', email)
				.single();

			if (existingAdmin) {
				throw new BadRequestException(Message.EMAIL_ALREADY_EXISTS);
			}

			// 2. Password hash
			const password_hash = await this.hashPassword(password);

			// 3. Insert admin
			const { data, error } = await this.databaseService.client
				.from('admin_users')
				.insert({ email, name, password_hash, role })
				.select()
				.single();

			if (error || !data) throw new BadRequestException(Message.CREATE_FAILED);

			// 4. JWT token (with is_admin flag)
			const accessToken = this.createToken({
				id: data._id,
				is_admin: true,
				admin_role: data.role,
			});

			// 5. Remove password_hash
			const { password_hash: _, ...adminWithoutPassword } = data;

			return { accessToken, admin: adminWithoutPassword };
		} catch (err: any) {
			console.log('Error, AuthService.adminSignup:', err.message);
			if (err instanceof BadRequestException) throw err;
			throw new BadRequestException(Message.SOMETHING_WENT_WRONG);
		}
	}

	/** Admin Login */
	public async adminLogin(input: AdminLoginDto): Promise<AdminAuthResponse> {
		const { email, password } = input;

		try {
			// 1. Find admin by email
			const { data: admin, error } = await this.databaseService.client
				.from('admin_users')
				.select('*')
				.eq('email', email)
				.single();

			if (error || !admin) throw new BadRequestException(Message.USER_NOT_FOUND);

			// 2. Compare passwords
			const isMatch = await this.comparePasswords(password, admin.password_hash);
			if (!isMatch) throw new BadRequestException(Message.WRONG_PASSWORD);

			// 3. JWT token
			const accessToken = this.createToken({
				id: admin._id,
				is_admin: true,
				admin_role: admin.role,
			});

			// 4. Remove password_hash
			const { password_hash: _, ...adminWithoutPassword } = admin;

			return { accessToken, admin: adminWithoutPassword };
		} catch (err: any) {
			console.log('Error, AuthService.adminLogin:', err.message);
			if (err instanceof BadRequestException) throw err;
			throw new BadRequestException(Message.SOMETHING_WENT_WRONG);
		}
	}

	/** create JWT token */
	public createToken(payload: { id: string;[key: string]: any }): string {
		const secret = this.configService.get<string>('JWT_SECRET');
		return jwt.sign(payload, secret, { expiresIn: '30d' });
	}

	/** verify JWT token and return user data */
	public async verifyToken(token: string): Promise<any> {
		try {
			const secret = this.configService.get<string>('JWT_SECRET');
			const decoded: any = jwt.verify(token, secret);

			const { data, error } = await this.databaseService.client
				.from('users')
				.select('*')
				.eq('_id', decoded.id)
				.single();

			if (error || !data) throw new UnauthorizedException(Message.NOT_AUTHENTICATED);

			return data;
		} catch (err) {
			if (err instanceof UnauthorizedException) throw err;
			throw new UnauthorizedException(Message.INVALID_TOKEN);
		}
	}

	/** verify admin JWT token and return admin data */
	public async verifyAdminToken(token: string): Promise<any> {
		try {
			const secret = this.configService.get<string>('JWT_SECRET');
			const decoded: any = jwt.verify(token, secret);

			// Verify it is an admin token
			if (!decoded.is_admin) throw new UnauthorizedException(Message.NOT_AUTHENTICATED);

			const { data, error } = await this.databaseService.client
				.from('admin_users')
				.select('*')
				.eq('_id', decoded.id)
				.single();

			if (error || !data) throw new UnauthorizedException(Message.NOT_AUTHENTICATED);

			// password_hash ni olib tashlaymiz, admin_role qo'shamiz
			const { password_hash: _, ...adminData } = data;
			return { ...adminData, admin_role: data.role };
		} catch (err) {
			if (err instanceof UnauthorizedException) throw err;
			throw new UnauthorizedException(Message.INVALID_TOKEN);
		}
	}
}
