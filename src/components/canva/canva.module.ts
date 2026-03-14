import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { CanvaController } from './canva.controller';
import { CanvaService } from './canva.service';
import { CanvaOAuthService } from './canva-oauth.service';

@Module({
    imports: [DatabaseModule, AuthModule],
    controllers: [CanvaController],
    providers: [CanvaService, CanvaOAuthService],
    exports: [CanvaService, CanvaOAuthService],
})
export class CanvaModule {}
