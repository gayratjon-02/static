import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { CanvaController } from './canva.controller';
import { CanvaService } from './canva.service';

@Module({
    imports: [DatabaseModule, AuthModule],
    controllers: [CanvaController],
    providers: [CanvaService],
    exports: [CanvaService],
})
export class CanvaModule {}
