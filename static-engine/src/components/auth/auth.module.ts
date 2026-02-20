import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { DatabaseModule } from '../../database/database.module';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { CreditsGuard } from './guards/credits.guard';

@Module({
  imports: [DatabaseModule],
  providers: [AuthService, AuthGuard, RolesGuard, CreditsGuard],
  exports: [AuthService],
})
export class AuthModule {}
