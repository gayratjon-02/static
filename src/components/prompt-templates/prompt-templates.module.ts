import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { PromptTemplatesController } from './prompt-templates.controller';
import { PromptTemplatesService } from './prompt-templates.service';

@Module({
    imports: [DatabaseModule, AuthModule],
    controllers: [PromptTemplatesController],
    providers: [PromptTemplatesService],
    exports: [PromptTemplatesService],
})
export class PromptTemplatesModule {}
