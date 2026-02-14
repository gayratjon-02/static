import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { LoggingInterceptor } from './libs/interceptor/Logging.interceptor';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule);
	app.useGlobalPipes(new ValidationPipe());
	app.useGlobalInterceptors(new LoggingInterceptor());
	app.enableCors({ origin: true, credentials: true });

	// Serve uploaded files statically
	app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

	await app.listen(process.env.PORT_API ?? 3000, () => {
		console.log(`API server is running on port ${process.env.PORT_API ?? 3000}`);
	});
}
bootstrap();

