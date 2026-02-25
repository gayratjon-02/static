import { Module } from '@nestjs/common';
import { BrandController } from './brand.controller';
import { BrandService } from './brand.service';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { S3Module } from '../s3/s3.module';
import { ClaudeService } from '../../libs/services/claude.service';
import { GenerationRulesService } from '../../libs/services/generation-rules.service';

@Module({
	imports: [DatabaseModule, AuthModule, S3Module],
	controllers: [BrandController],
	providers: [BrandService, ClaudeService, GenerationRulesService],
	exports: [BrandService],
})
export class BrandModule {}
