import { Module } from '@nestjs/common';
import { ConceptController } from './concept.controller';
import { ConceptService } from './concept.service';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
	imports: [DatabaseModule, AuthModule],
	controllers: [ConceptController],
	providers: [ConceptService],
	exports: [ConceptService],
})
export class ConceptModule {}
