import { Module } from '@nestjs/common';
import { DaController } from './da.controller';
import { DaService } from './da.service';
import { S3Module } from '../s3/s3.module';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [S3Module, DatabaseModule, AuthModule],
    controllers: [DaController],
    providers: [DaService],
    exports: [DaService],
})
export class DaModule { }
