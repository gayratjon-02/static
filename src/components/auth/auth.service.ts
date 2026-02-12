import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { Message } from '../../libs/enums/common.enum';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
	constructor(
		private configService: ConfigService,
		private databaseService: DatabaseService,
	) {}

	/** JWT token yaratish */
	createToken(payload: { id: string; member_type: string }): string {
		const secret = this.configService.get<string>('JWT_SECRET');
		return jwt.sign(payload, secret, { expiresIn: '30d' });
	}

	/** JWT token tekshirish va user ma'lumotini qaytarish */
	async verifyToken(token: string): Promise<any> {
		try {
			const secret = this.configService.get<string>('JWT_SECRET');
			const decoded: any = jwt.verify(token, secret);

			const { data, error } = await this.databaseService.client
				.from('users')
				.select('*')
				.eq('id', decoded.id)
				.single();

			if (error || !data) throw new UnauthorizedException(Message.NOT_AUTHENTICATED);

			return data;
		} catch (err) {
			if (err instanceof UnauthorizedException) throw err;
			throw new UnauthorizedException(Message.INVALID_TOKEN);
		}
	}
}
