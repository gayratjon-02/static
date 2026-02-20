import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { LoggingInterceptor } from './libs/interceptor/Logging.interceptor';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { SanitizePipe } from './libs/pipes/sanitize.pipe';

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule, {
		rawBody: true,
		bodyParser: true,
	});

	// ── Security headers (Helmet) ──────────────────────────────────────────
	app.use(
		helmet({
			contentSecurityPolicy: {
				directives: {
					defaultSrc: ["'self'"],
					scriptSrc: ["'self'"],
					styleSrc: ["'self'", "'unsafe-inline'"],
					imgSrc: ["'self'", 'data:', 'https://*.amazonaws.com'],
					connectSrc: ["'self'"],
					fontSrc: ["'self'"],
					objectSrc: ["'none'"],
					frameSrc: ["'none'"],
					upgradeInsecureRequests: [],
				},
			},
			hsts: {
				maxAge: 31536000,       // 1 year
				includeSubDomains: true,
				preload: true,
			},
			referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
			frameguard: { action: 'deny' },
			noSniff: true,
			xssFilter: true,
		}),
	);

	// ── Global validation ──────────────────────────────────────────────────
	app.useGlobalPipes(
		new SanitizePipe(),              // strip HTML from all string body fields
		new ValidationPipe({
			whitelist: true,             // strip unknown properties
			forbidNonWhitelisted: true,  // reject requests with extra fields
			transform: true,
		}),
	);
	app.useGlobalInterceptors(new LoggingInterceptor());

	// ── Body size limits ───────────────────────────────────────────────────
	app.useBodyParser('json', { limit: '10mb' });
	app.useBodyParser('urlencoded', { limit: '10mb', extended: true });
	app.useBodyParser('raw', { limit: '10mb' });

	// ── CORS ───────────────────────────────────────────────────────────────
	app.enableCors({
		origin: [
			'http://167.172.90.235:4010',
			'https://167.172.90.235:4010',
			'http://localhost:3000',
			'http://localhost:4010',
		],
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'Authorization'],
		credentials: true,
	});

	await app.listen(process.env.PORT_API ?? 3000, () => {
		console.log(`API server is running on port ${process.env.PORT_API ?? 3000}`);
	});
}
bootstrap();
