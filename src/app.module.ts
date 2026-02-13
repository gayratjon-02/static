import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './components/auth/auth.module';
import { MemberModule } from './components/member/member.module';
import { BrandModule } from './components/brand/brand.module';
import { ProductModule } from './components/product/product.module';
import { ConceptModule } from './components/concept/concept.module';
import { GenerationModule } from './components/generation/generation.module';

@Module({
	controllers: [AppController],
	providers: [AppService],
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
      envFilePath: `.env`,
		}),

		DatabaseModule,

		AuthModule,

		MemberModule,

		BrandModule,

		ProductModule,

		ConceptModule,

		GenerationModule,
	],
})
export class AppModule {}
