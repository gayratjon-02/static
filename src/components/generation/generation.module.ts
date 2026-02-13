import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GenerationController } from './generation.controller';
import { GenerationService } from './generation.service';
import { GenerationProcessor } from './generation.processor';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { ClaudeService } from '../../libs/services/claude.service';
import { GeminiService } from '../../libs/services/gemini.service';
import { StorageService } from '../../libs/services/storage.service';
import { GenerationGateway } from '../../socket/generation.gateway';

@Module({
	imports: [
		DatabaseModule,
		AuthModule,
		ThrottlerModule.forRoot([{
			ttl: 60000,
			limit: 3,
		}]),
		BullModule.forRootAsync({
			imports: [ConfigModule],
			useFactory: (configService: ConfigService) => ({
				connection: {
					host: configService.get<string>('REDIS_HOST') || 'localhost',
					port: configService.get<number>('REDIS_PORT') || 6379,
				},
			}),
			inject: [ConfigService],
		}),
		BullModule.registerQueue({
			name: 'generation',
		}),
	],
	controllers: [GenerationController],
	providers: [
		GenerationService,
		GenerationProcessor,
		ClaudeService,
		GeminiService,
		StorageService,
		GenerationGateway,
	],
})
export class GenerationModule {}
