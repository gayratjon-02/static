import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class BulkDownloadDto {
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(50)
	@IsUUID('4', { each: true })
	ids: string[];
}
