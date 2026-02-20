import { Injectable, PipeTransform, ArgumentMetadata } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sanitizeHtml = require('sanitize-html');

/**
 * SanitizePipe — strips all HTML tags and dangerous content from
 * string fields in request bodies before they reach the controller.
 *
 * Usage: Apply globally via app.useGlobalPipes() or on specific endpoints.
 *
 * Sanitization rules:
 *   - Strips ALL HTML tags (allowedTags: [])
 *   - Strips ALL attributes
 *   - Encodes special characters
 *   - Trims whitespace
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
    transform(value: any, metadata: ArgumentMetadata) {
        if (metadata.type !== 'body') return value;
        return this.sanitizeValue(value);
    }

    private sanitizeValue(value: any): any {
        if (typeof value === 'string') {
            return sanitizeHtml(value, {
                allowedTags: [],        // strip all HTML
                allowedAttributes: {},  // strip all attributes
            }).trim();
        }
        if (Array.isArray(value)) {
            return value.map((item) => this.sanitizeValue(item));
        }
        if (value !== null && typeof value === 'object') {
            const sanitized: Record<string, any> = {};
            for (const key of Object.keys(value)) {
                sanitized[key] = this.sanitizeValue(value[key]);
            }
            return sanitized;
        }
        return value;
    }
}
