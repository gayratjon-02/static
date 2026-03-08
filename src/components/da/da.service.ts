import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { S3Service } from '../s3/s3.service';

@Injectable()
export class DaService {
    constructor(
        private readonly db: DatabaseService,
        private readonly s3Service: S3Service,
    ) { }

    async getPresets(memberId: string) {
        try {
            // "faqat ular conceptni kora olsin" -> Only returning templates owned by the user.
            const { data: result, error } = await this.db.client
                .from('da_presets')
                .select('*')
                .eq('member_id', memberId)
                .order('created_at', { ascending: false });

            if (error) {
                throw new Error(error.message);
            }

            return {
                total: result ? result.length : 0,
                user_presets: result ? result.length : 0,
                system_presets: 0,
                presets: result || [],
            };
        } catch (err) {
            console.error('getPresets ERROR', err);
            throw new InternalServerErrorException('Failed to fetch DA presets');
        }
    }

    async uploadPreset(params: { file: Express.Multer.File; memberId: string; name: string; description?: string }) {
        const { file, memberId, name, description } = params;

        try {
            // Upload to S3
            // Since s3Service.uploadFile expects (buffer, fileName, mimetype), we pass them.
            // Using a unique file name.
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            const ext = file.originalname.split('.').pop();
            const fileName = `da-templates/${memberId}/${uniqueSuffix}.${ext}`;

            const uploadedUrl = await this.s3Service.upload(file.buffer, fileName, file.mimetype);

            // Save to database
            const { data: newPresets, error } = await this.db.client
                .from('da_presets')
                .insert({
                    member_id: memberId,
                    name: name,
                    description: description || '',
                    is_default: false,
                    image_url: uploadedUrl
                })
                .select();

            if (error || !newPresets || newPresets.length === 0) {
                throw new InternalServerErrorException(error?.message || 'Insert failed');
            }
            const newPreset = newPresets[0];

            return {
                success: true,
                data: {
                    id: newPreset.id,
                    name: newPreset.name,
                    image_url: newPreset.image_url,
                },
            };
        } catch (err) {
            console.error('uploadPreset ERROR', err);
            throw new InternalServerErrorException('Failed to upload DA preset');
        }
    }

    async deletePreset(id: string, memberId: string) {
        try {
            // First check if it belongs to the user
            const { data: presetData, error: findError } = await this.db.client
                .from('da_presets')
                .select('*')
                .eq('id', id)
                .eq('member_id', memberId);

            if (findError || !presetData || presetData.length === 0) {
                throw new NotFoundException('DA preset not found or you do not have permission to delete it');
            }

            const { error: deleteError } = await this.db.client
                .from('da_presets')
                .delete()
                .eq('id', id);

            if (deleteError) {
                throw new InternalServerErrorException(deleteError.message);
            }

            return { message: 'DA preset deleted successfully' };
        } catch (err) {
            if (err instanceof NotFoundException) throw err;
            console.error('deletePreset ERROR', err);
            throw new InternalServerErrorException('Failed to delete DA preset');
        }
    }
}
