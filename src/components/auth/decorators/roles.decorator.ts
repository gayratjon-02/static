import { SetMetadata } from '@nestjs/common';
import { MemberType, AdminRole } from '../../../libs/enums/common.enum';

export type AllRoles = MemberType | AdminRole;

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AllRoles[]) => SetMetadata(ROLES_KEY, roles);
