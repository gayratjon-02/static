import { Module, ValidationPipe } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_PIPE, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './components/auth/auth.module';
import { MemberModule } from './components/member/member.module';
import { BrandModule } from './components/brand/brand.module';
import { ProductModule } from './components/product/product.module';
import { ConceptModule } from './components/concept/concept.module';
import { GenerationModule } from './components/generation/generation.module';
import { BillingModule } from './components/billing/billing.module';
import { S3Module } from './components/s3/s3.module';
import { EmailModule } from './components/email/email.module';
import { CanvaModule } from './components/canva/canva.module';
import { PromptTemplatesModule } from './components/prompt-templates/prompt-templates.module';
import { SystemConfigModule } from './components/system-config/system-config.module';
import { SanitizePipe } from './libs/pipes/sanitize.pipe';
import { ValidationExceptionFilter } from './libs/filters/validation-exception.filter';
import { LoggingInterceptor } from './libs/interceptor/Logging.interceptor';

@Module({
	controllers: [AppController],
	providers: [
		AppService,
		// ── Global rate limiter ─────────────────────────────────────────────
		{
			provide: APP_GUARD,
			useClass: ThrottlerGuard,
		},
		// ── Global pipes ────────────────────────────────────────────────────
		{
			provide: APP_PIPE,
			useClass: SanitizePipe,
		},
		{
			provide: APP_PIPE,
			useFactory: () =>
				new ValidationPipe({
					whitelist: true,
					forbidNonWhitelisted: true,
					transform: true,
				}),
		},
		// ── Global filter ───────────────────────────────────────────────────
		{
			provide: APP_FILTER,
			useClass: ValidationExceptionFilter,
		},
		// ── Global interceptor ──────────────────────────────────────────────
		{
			provide: APP_INTERCEPTOR,
			useClass: LoggingInterceptor,
		},
	],
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: `.env`,
		}),

		// ── Global throttler: 100 requests per 60 seconds per IP ────────────
		ThrottlerModule.forRoot([
			{
				name: 'default',
				ttl: 60000,      // 60 seconds
				limit: 100,      // 100 requests per window
			},
			{
				name: 'short',
				ttl: 5000,       // 5 seconds
				limit: 20,       // burst protection: max 20 req in 5s
			},
		]),

		DatabaseModule,
		AuthModule,
		MemberModule,
		BrandModule,
		ProductModule,
		ConceptModule,
		GenerationModule,
		BillingModule,
		S3Module,
		EmailModule,
		CanvaModule,
		PromptTemplatesModule,
		SystemConfigModule,
	],
})
export class AppModule { }
