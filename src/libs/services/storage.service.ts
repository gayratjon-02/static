import { Injectable, Logger } from '@nestjs/common';
import { S3Service } from '../../components/s3/s3.service';

@Injectable()
export class StorageService {
	private readonly logger = new Logger('StorageService');

	constructor(private s3Service: S3Service) {}

	async uploadImage(
		userId: string,
		adId: string,
		ratio: string,
		imageBuffer: Buffer,
	): Promise<string> {
		const key = `${userId}/${adId}/${ratio}.png`;
		this.logger.log(`Uploading image: ${key}`);
		return this.s3Service.upload(imageBuffer, key, 'image/png');
	}

	async deleteImage(userId: string, adId: string, ratio: string): Promise<void> {
		const key = `${userId}/${adId}/${ratio}.png`;
		this.logger.log(`Deleting image: ${key}`);
		return this.s3Service.delete(key);
	}

	getImageUrl(userId: string, adId: string, ratio: string): string {
		const key = `${userId}/${adId}/${ratio}.png`;
		return this.s3Service.getUrl(key);
	}
}
