import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class StorageService {
	private readonly logger = new Logger('StorageService');
	private readonly BUCKET = 'generated-ads';

	constructor(private databaseService: DatabaseService) {}

	/**
	 * Rasmni Supabase Storage'ga yuklaydi
	 * @returns Public URL
	 */
	async uploadImage(
		userId: string,
		adId: string,
		ratio: string,
		imageBuffer: Buffer,
	): Promise<string> {
		const filePath = `${userId}/${adId}/${ratio}.png`;

		this.logger.log(`Uploading image: ${filePath}`);

		const { data, error } = await this.databaseService.client.storage
			.from(this.BUCKET)
			.upload(filePath, imageBuffer, {
				contentType: 'image/png',
				upsert: true,
			});

		if (error) {
			this.logger.error(`Upload failed: ${error.message}`);
			throw new Error(`Storage upload failed: ${error.message}`);
		}

		// Public URL olish
		const { data: urlData } = this.databaseService.client.storage
			.from(this.BUCKET)
			.getPublicUrl(filePath);

		this.logger.log(`Image uploaded: ${urlData.publicUrl}`);
		return urlData.publicUrl;
	}
}
