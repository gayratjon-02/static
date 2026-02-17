import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
	private readonly logger = new Logger('StorageService');
	private readonly BUCKET = 'generated-ads';
	private readonly UPLOADS_DIR = path.join(process.cwd(), 'uploads');

	constructor(
		private databaseService: DatabaseService,
		private configService: ConfigService,
	) {
		// uploads papkani yaratish
		if (!fs.existsSync(this.UPLOADS_DIR)) {
			fs.mkdirSync(this.UPLOADS_DIR, { recursive: true });
			this.logger.log(`Created uploads directory: ${this.UPLOADS_DIR}`);
		}
	}

	/**
	 * Rasmni local fayl sistemaga saqlaydi.
	 * Keyinchalik S3/Supabase Storage ga o'tkazish uchun
	 * pastdagi commented kodni yoqish mumkin.
	 * @returns Public URL (local server orqali)
	 */
	async uploadImage(
		userId: string,
		adId: string,
		ratio: string,
		imageBuffer: Buffer,
	): Promise<string> {
		const relativePath = `${userId}/${adId}`;
		const fileName = `${ratio}.png`;
		const dirPath = path.join(this.UPLOADS_DIR, relativePath);
		const filePath = path.join(dirPath, fileName);

		this.logger.log(`Saving image locally: ${relativePath}/${fileName}`);

		// Papka yaratish
		if (!fs.existsSync(dirPath)) {
			fs.mkdirSync(dirPath, { recursive: true });
		}

		// Faylni yozish
		fs.writeFileSync(filePath, imageBuffer);

		// Local URL qaytarish (main.ts da app.useStaticAssets orqali serve qilinadi)
		const port = this.configService.get<string>('PORT_API') || '3007';
		const baseUrl = `http://localhost:${port}`;
		const publicUrl = `${baseUrl}/uploads/${relativePath}/${fileName}`;

		this.logger.log(`Image saved locally: ${publicUrl}`);
		return publicUrl;
	}

	// ============================================
	// S3 / Supabase Storage — keyinchalik yoqish uchun
	// ============================================
	//
	// async uploadImageToSupabase(
	// 	userId: string,
	// 	adId: string,
	// 	ratio: string,
	// 	imageBuffer: Buffer,
	// ): Promise<string> {
	// 	const filePath = `${userId}/${adId}/${ratio}.png`;
	//
	// 	this.logger.log(`Uploading image: ${filePath}`);
	//
	// 	const { data, error } = await this.databaseService.client.storage
	// 		.from(this.BUCKET)
	// 		.upload(filePath, imageBuffer, {
	// 			contentType: 'image/png',
	// 			upsert: true,
	// 		});
	//
	// 	if (error) {
	// 		this.logger.error(`Upload failed: ${error.message}`);
	// 		throw new Error(`Storage upload failed: ${error.message}`);
	// 	}
	//
	// 	// Public URL olish
	// 	const { data: urlData } = this.databaseService.client.storage
	// 		.from(this.BUCKET)
	// 		.getPublicUrl(filePath);
	//
	// 	this.logger.log(`Image uploaded: ${urlData.publicUrl}`);
	// 	return urlData.publicUrl;
	// }
}
