import { Module } from '@nestjs/common';
import { BrandController } from './brand.controller';
import { BrandService } from './brand.service';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
	imports: [DatabaseModule, AuthModule],
	controllers: [BrandController],
	providers: [BrandService],
	exports: [BrandService],
})
export class BrandModule {}
