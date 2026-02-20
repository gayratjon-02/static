import { SetMetadata } from '@nestjs/common';
import { CREDITS_KEY } from '../guards/credits.guard';

export const RequireCredits = (credits: number) => SetMetadata(CREDITS_KEY, credits);
