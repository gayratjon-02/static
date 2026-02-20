import { Module } from '@nestjs/common';
import { ConceptController } from './concept.controller';
import { ConceptService } from './concept.service';
import { ConceptConfigService } from './concept-config.service';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { S3Module } from '../s3/s3.module';

@Module({
	imports: [DatabaseModule, AuthModule, S3Module],
	controllers: [ConceptController],
	providers: [ConceptService, ConceptConfigService],
	exports: [ConceptService],
})
export class ConceptModule { }
