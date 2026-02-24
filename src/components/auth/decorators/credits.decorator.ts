import { SetMetadata } from '@nestjs/common';
import { CREDITS_KEY } from '../guards/credits.guard';

export const RequireCredits = (configKey: string) => SetMetadata(CREDITS_KEY, configKey);
