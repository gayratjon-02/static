import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { DatabaseModule } from 'src/database/database.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { CanvaModule } from '../canva/canva.module';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    AuthModule,
    CanvaModule,
    ThrottlerModule.forRoot([{
      ttl: 60000,  // 1 minute window
      limit: 10,   // 10 requests per minute default
    }]),
  ],
  controllers: [BillingController, StripeWebhookController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule { }
