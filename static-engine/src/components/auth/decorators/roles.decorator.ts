import { SetMetadata } from '@nestjs/common';
import { SubscriptionTier, AdminRole } from '../../../libs/enums/common.enum';

export type AllRoles = SubscriptionTier | AdminRole;

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AllRoles[]) => SetMetadata(ROLES_KEY, roles);
