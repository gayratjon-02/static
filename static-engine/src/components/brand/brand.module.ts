import { Module } from '@nestjs/common';
import { BrandController } from './brand.controller';
import { BrandService } from './brand.service';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { S3Module } from '../s3/s3.module';

@Module({
	imports: [DatabaseModule, AuthModule, S3Module],
	controllers: [BrandController],
	providers: [BrandService],
	exports: [BrandService],
})
export class BrandModule {}
