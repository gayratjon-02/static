import { Body, Controller, Get, Param, Patch, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { PromptTemplatesService } from './prompt-templates.service';
import { UpdatePromptTemplateDto } from './dto/update-prompt-template.dto';

@Controller('prompt-templates')
export class PromptTemplatesController {
    constructor(private readonly service: PromptTemplatesService) {}

    @UseGuards(AuthGuard)
    @Get()
    async list(@AuthMember() auth: any) {
        if (!auth?.admin_role) throw new UnauthorizedException('Admin access required');
        return this.service.list();
    }

    @UseGuards(AuthGuard)
    @Patch(':id')
    async update(
        @Param('id') id: string,
        @Body() dto: UpdatePromptTemplateDto,
        @AuthMember() auth: any,
    ) {
        if (!auth?.admin_role) throw new UnauthorizedException('Admin access required');
        return this.service.update(id, {
            content: dto.content,
            is_active: dto.is_active,
        });
    }
}
