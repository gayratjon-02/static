import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Centralized configuration for the Concept module.
 * Reads values from environment variables with sensible defaults.
 * All thresholds and limits are configurable without code changes.
 */
@Injectable()
export class ConceptConfigService {
    /** Minimum usage_count to qualify for the "Popular" badge */
    public readonly popularThreshold: number;

    /** Maximum number of recommended concepts to return */
    public readonly recommendedLimit: number;

    /** Maximum file size for concept image upload (bytes) */
    public readonly maxImageSize: number;

    constructor(private configService: ConfigService) {
        this.popularThreshold = parseInt(
            this.configService.get<string>('POPULAR_THRESHOLD') || '50',
            10,
        );
        this.recommendedLimit = parseInt(
            this.configService.get<string>('RECOMMENDED_LIMIT') || '10',
            10,
        );
        this.maxImageSize = parseInt(
            this.configService.get<string>('CONCEPT_MAX_IMAGE_SIZE') || String(10 * 1024 * 1024),
            10,
        );
    }

    /** Public config object returned to frontend */
    public getPublicConfig() {
        return {
            popular_threshold: this.popularThreshold,
            recommended_limit: this.recommendedLimit,
            max_image_size: this.maxImageSize,
        };
    }
}
