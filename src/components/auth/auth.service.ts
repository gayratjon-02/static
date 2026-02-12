import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { Message } from '../../libs/enums/common.enum';
import { SignupDto } from '../../libs/dto/member/signup.dto';
import { LoginDto } from '../../libs/dto/member/login.dto';
import { AuthResponse } from '../../libs/types/member/member.type';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
	constructor(
		private configService: ConfigService,
		private databaseService: DatabaseService,
	) {}

	/** Signup progress */
	public async signup(input: SignupDto): Promise<AuthResponse> {
		const { email, password, full_name, avatar_url } = input;

		try {
			// 1. Email uniqueness check
			const { data: existingUser } = await this.databaseService.client
				.from('users')
				.select('_id')
				.eq('email', email)
				.single();

			if (existingUser) throw new BadRequestException(Message.EMAIL_ALREADY_EXISTS);

			// 2. Password hash
			const password_hash = await this.hashPassword(password);

			// 3. User creation
			const { data: newUser, error } = await this.databaseService.client
				.from('users')
				.insert({
					email,
					full_name,
					password_hash,
					avatar_url: avatar_url || '',
				})
				.select()
				.single();

			if (error || !newUser) throw new BadRequestException(Message.CREATE_FAILED);

			// 4. JWT token
			const accessToken = this.createToken({
				id: newUser._id,
				subscription_tier: newUser.subscription_tier,
			});

			// 5. remove passwork hash
			const { password_hash: _, ...memberWithoutPassword } = newUser;

			return {
				accessToken,
				member: memberWithoutPassword,
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

			// 4. JWT token
			const accessToken = this.createToken({
				id: user._id,
				subscription_tier: user.subscription_tier,
			});

			// 5. Remove password_hash
			const { password_hash: _, ...memberWithoutPassword } = user;

			return {
				accessToken,
				member: memberWithoutPassword,
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

	/** create JWT token */
	public createToken(payload: { id: string; subscription_tier: string }): string {
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
}
