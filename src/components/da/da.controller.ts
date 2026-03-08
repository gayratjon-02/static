import {
    Controller,
    Get,
    Post,
    Param,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    Req,
    Body,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/guards/auth.guard';
import { Request } from 'express';
import { DaService } from './da.service';

@Controller('da')
@UseGuards(AuthGuard)
export class DaController {
    constructor(private readonly daService: DaService) { }

    /**
     * GET /da/presets
     * Fetch all system presets (is_default = true) + the current user's presets
     */
    @Get('presets')
    async getPresets(@Req() req: any) {
        const memberId = req.user.sub;
        return this.daService.getPresets(memberId);
    }

    /**
     * POST /da/upload
     * Upload a new DA image to S3 and save it as a user-owned preset record
     */
    @Post('upload')
    @UseInterceptors(FileInterceptor('image'))
    async uploadPreset(
        @UploadedFile() file: Express.Multer.File,
        @Req() req: any,
        @Body('name') name?: string,
        @Body('description') description?: string,
    ) {
        if (!file) {
            throw new BadRequestException('Image file is required');
        }

        const memberId = req.user.sub;
        return this.daService.uploadPreset({
            file,
            memberId,
            name: name || 'Custom DA Preset',
            description,
        });
    }

    /**
     * POST /da/presets/delete/:id
     * Delete a specific DA preset created by the user
     */
    @Post('presets/delete/:id')
    async deletePreset(@Param('id') id: string, @Req() req: any) {
        const memberId = req.user.sub;
        return this.daService.deletePreset(id, memberId);
    }
}
