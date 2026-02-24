import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { SystemConfigController } from './system-config.controller';
import { SystemConfigService } from './system-config.service';

@Global()
@Module({
	imports: [DatabaseModule, AuthModule],
	controllers: [SystemConfigController],
	providers: [SystemConfigService],
	exports: [SystemConfigService],
})
export class SystemConfigModule {}
