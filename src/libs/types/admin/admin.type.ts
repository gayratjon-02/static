import { AdminRole } from '../../enums/common.enum';

/** admin_users jadvalidan kelgan to'liq admin */
export interface AdminUser {
	_id: string;

	// Account
	email: string;
	name: string;
	password_hash?: string;

	// Role
	role: AdminRole;

	// Timestamps
	created_at: Date;
}

/** API response'dan password_hash chiqarib tashlangan admin */
export type AdminResponse = Omit<AdminUser, 'password_hash'>;

/** AuthGuard orqali request.authMember ga qo'yiladigan admin object */
export interface AdminMember extends AdminResponse {
	admin_role: AdminRole;
}

/** Admin login/signup response */
export interface AdminAuthResponse {
	accessToken: string;
	admin: AdminResponse;
}
