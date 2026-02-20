import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class S3Service {
	private readonly logger = new Logger('S3Service');
	private readonly s3Client: S3Client;
	private readonly bucketName: string;
	private readonly region: string;

	constructor(private configService: ConfigService) {
		this.bucketName = this.configService.get<string>('AWS_BUCKET_NAME');
		this.region = this.configService.get<string>('AWS_BUCKET_REGION');

		this.s3Client = new S3Client({
			region: this.region,
			credentials: {
				accessKeyId: this.configService.get<string>('ACCESS_KEY'),
				secretAccessKey: this.configService.get<string>('SECRET_KEY_AWS'),
			},
		});
	}

	async upload(file: Buffer, key: string, contentType: string): Promise<string> {
		await this.s3Client.send(
			new PutObjectCommand({
				Bucket: this.bucketName,
				Key: key,
				Body: file,
				ContentType: contentType,
			}),
		);

		const url = this.getUrl(key);
		this.logger.log(`Uploaded: ${url}`);
		return url;
	}

	async delete(key: string): Promise<void> {
		await this.s3Client.send(
			new DeleteObjectCommand({
				Bucket: this.bucketName,
				Key: key,
			}),
		);

		this.logger.log(`Deleted: ${key}`);
	}

	async getObject(key: string): Promise<{ body: any; contentType: string }> {
		const resp = await this.s3Client.send(
			new GetObjectCommand({
				Bucket: this.bucketName,
				Key: key,
			}),
		);

		return {
			body: resp.Body,
			contentType: resp.ContentType || 'image/png',
		};
	}

	/** Extract the S3 key from a full S3 URL */
	extractKeyFromUrl(url: string): string | null {
		const prefix = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/`;
		if (url.startsWith(prefix)) {
			return url.slice(prefix.length);
		}
		return null;
	}

	getUrl(key: string): string {
		return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
	}
}
