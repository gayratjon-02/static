import { Module } from '@nestjs/common';
import { DaController } from './da.controller';
import { DaService } from './da.service';
import { S3Module } from '../s3/s3.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
    imports: [S3Module, DatabaseModule],
    controllers: [DaController],
    providers: [DaService],
    exports: [DaService],
})
export class DaModule { }
