import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { CanvaController } from './canva.controller';
import { CanvaService } from './canva.service';
import { CanvaOAuthService } from './canva-oauth.service';
import { CanvaDesignService } from './canva-design.service';
import { CanvaEditService } from './canva-edit.service';

@Module({
    imports: [DatabaseModule, AuthModule],
    controllers: [CanvaController],
    providers: [CanvaService, CanvaOAuthService, CanvaDesignService, CanvaEditService],
    exports: [CanvaService, CanvaOAuthService, CanvaDesignService, CanvaEditService],
})
export class CanvaModule {}
