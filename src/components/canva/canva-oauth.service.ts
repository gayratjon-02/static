import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseService } from '../../database/database.service';
import { Message } from '../../libs/enums/common.enum';

interface CanvaTokenResponse {
	access_token: string;
	refresh_token: string;
	expires_in: number;
	token_type: string;
	scope: string;
}

interface CanvaConnection {
	_id: string;
	user_id: string;
	canva_user_id: string | null;
	access_token: string;
	refresh_token: string;
	token_expires_at: string;
	scopes: string | null;
	status: string;
}

const CANVA_SCOPES = [
	'profile:read',
	'asset:write',
	'brandtemplate:meta:read',
	'brandtemplate:content:read',
	'design:content:write',
	'design:content:read',
	'design:meta:read',
].join(' ');

const CANVA_AUTH_URL = 'https://www.canva.com/api/oauth/authorize';
const CANVA_TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token';
const CANVA_REVOKE_URL = 'https://api.canva.com/rest/v1/oauth/revoke';

@Injectable()
export class CanvaOAuthService {
	constructor(
		private readonly databaseService: DatabaseService,
		private readonly configService: ConfigService,
	) {}

	async generateAuthUrl(userId: string): Promise<{ authUrl: string }> {
		console.log('CanvaOAuthService: generateAuthUrl');

		const clientId = this.configService.get<string>('CANVA_CLIENT_ID');
		const redirectUri = this.configService.get<string>('CANVA_REDIRECT_URI');

		const codeVerifier = randomBytes(64).toString('base64url').slice(0, 96);
		const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
		const state = randomBytes(32).toString('base64url');

		await this.databaseService.client
			.from('canva_oauth_states')
			.delete()
			.eq('user_id', userId)
			.lt('expires_at', new Date().toISOString());

		const { error } = await this.databaseService.client.from('canva_oauth_states').insert({
			user_id: userId,
			state,
			code_verifier: codeVerifier,
			redirect_uri: redirectUri,
		});

		if (error) throw new BadRequestException(Message.CANVA_AUTH_FAILED);

		const params = new URLSearchParams({
			code_challenge_method: 'S256',
			response_type: 'code',
			client_id: clientId,
			scope: CANVA_SCOPES,
			redirect_uri: redirectUri,
			state,
			code_challenge: codeChallenge,
		});

		return { authUrl: `${CANVA_AUTH_URL}?${params.toString()}` };
	}

	async handleCallback(code: string, state: string): Promise<{ userId: string }> {
		console.log('CanvaOAuthService: handleCallback');

		const { data: oauthState, error: stateError } = await this.databaseService.client
			.from('canva_oauth_states')
			.select('*')
			.eq('state', state)
			.gt('expires_at', new Date().toISOString())
			.single();

		if (stateError || !oauthState) throw new BadRequestException(Message.CANVA_STATE_NOT_FOUND);

		const clientId = this.configService.get<string>('CANVA_CLIENT_ID');
		const clientSecret = this.configService.get<string>('CANVA_CLIENT_SECRET');
		const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

		const body = new URLSearchParams({
			grant_type: 'authorization_code',
			code_verifier: oauthState.code_verifier,
			code,
			redirect_uri: oauthState.redirect_uri,
		});

		const response = await fetch(CANVA_TOKEN_URL, {
			method: 'POST',
			headers: {
				Authorization: `Basic ${basicAuth}`,
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: body.toString(),
		});

		if (!response.ok) throw new BadRequestException(Message.CANVA_AUTH_FAILED);

		const tokens: CanvaTokenResponse = await response.json();
		const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

		const { error: upsertError } = await this.databaseService.client
			.from('canva_connections')
			.upsert(
				{
					user_id: oauthState.user_id,
					access_token: tokens.access_token,
					refresh_token: tokens.refresh_token,
					token_expires_at: tokenExpiresAt,
					scopes: tokens.scope ?? CANVA_SCOPES,
					status: 'active',
					updated_at: new Date().toISOString(),
				},
				{ onConflict: 'user_id' },
			);

		if (upsertError) throw new BadRequestException(Message.CANVA_AUTH_FAILED);

		await this.databaseService.client.from('canva_oauth_states').delete().eq('state', state);

		return { userId: oauthState.user_id };
	}

	async getValidToken(userId: string): Promise<string> {
		console.log('CanvaOAuthService: getValidToken');

		const { data: connection, error } = await this.databaseService.client
			.from('canva_connections')
			.select('*')
			.eq('user_id', userId)
			.eq('status', 'active')
			.single();

		if (error || !connection) throw new BadRequestException(Message.CANVA_NOT_CONNECTED);

		const expiresAt = new Date(connection.token_expires_at).getTime();
		const bufferMs = 5 * 60 * 1000;

		if (Date.now() >= expiresAt - bufferMs) {
			await this.refreshToken(userId);

			const { data: refreshed } = await this.databaseService.client
				.from('canva_connections')
				.select('access_token')
				.eq('user_id', userId)
				.single();

			return refreshed.access_token;
		}

		return connection.access_token;
	}

	async refreshToken(userId: string): Promise<void> {
		console.log('CanvaOAuthService: refreshToken');

		const { data: connection, error } = await this.databaseService.client
			.from('canva_connections')
			.select('refresh_token')
			.eq('user_id', userId)
			.eq('status', 'active')
			.single();

		if (error || !connection) throw new BadRequestException(Message.CANVA_NOT_CONNECTED);

		const clientId = this.configService.get<string>('CANVA_CLIENT_ID');
		const clientSecret = this.configService.get<string>('CANVA_CLIENT_SECRET');
		const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

		const body = new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: connection.refresh_token,
		});

		const response = await fetch(CANVA_TOKEN_URL, {
			method: 'POST',
			headers: {
				Authorization: `Basic ${basicAuth}`,
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: body.toString(),
		});

		if (!response.ok) throw new BadRequestException(Message.CANVA_TOKEN_EXPIRED);

		const tokens: CanvaTokenResponse = await response.json();
		const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

		const { error: updateError } = await this.databaseService.client
			.from('canva_connections')
			.update({
				access_token: tokens.access_token,
				refresh_token: tokens.refresh_token,
				token_expires_at: tokenExpiresAt,
				updated_at: new Date().toISOString(),
			})
			.eq('user_id', userId);

		if (updateError) throw new BadRequestException(Message.CANVA_AUTH_FAILED);
	}

	async revokeToken(userId: string): Promise<void> {
		console.log('CanvaOAuthService: revokeToken');

		const { data: connection } = await this.databaseService.client
			.from('canva_connections')
			.select('access_token')
			.eq('user_id', userId)
			.eq('status', 'active')
			.single();

		if (connection) {
			const clientId = this.configService.get<string>('CANVA_CLIENT_ID');
			const clientSecret = this.configService.get<string>('CANVA_CLIENT_SECRET');
			const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

			await fetch(CANVA_REVOKE_URL, {
				method: 'POST',
				headers: {
					Authorization: `Basic ${basicAuth}`,
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams({ token: connection.access_token }).toString(),
			});
		}

		await this.databaseService.client.from('canva_connections').delete().eq('user_id', userId);
	}

	async getConnectionStatus(userId: string): Promise<{ connected: boolean; canva_user_id?: string }> {
		console.log('CanvaOAuthService: getConnectionStatus');

		const { data: connection } = await this.databaseService.client
			.from('canva_connections')
			.select('canva_user_id, status')
			.eq('user_id', userId)
			.eq('status', 'active')
			.single();

		if (!connection) return { connected: false };

		return {
			connected: true,
			canva_user_id: connection.canva_user_id ?? undefined,
		};
	}
}
