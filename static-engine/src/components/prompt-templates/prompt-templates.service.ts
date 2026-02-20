import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

export interface PromptTemplateRow {
    _id: string;
    name: string;
    template_type: string;
    content: string;
    version: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

@Injectable()
export class PromptTemplatesService {
    private readonly logger = new Logger(PromptTemplatesService.name);

    constructor(private readonly databaseService: DatabaseService) {}

    /** List all prompt templates (admin). */
    async list(): Promise<PromptTemplateRow[]> {
        const { data, error } = await this.databaseService.client
            .from('prompt_templates')
            .select('_id, name, template_type, content, version, is_active, created_at, updated_at')
            .order('template_type', { ascending: true })
            .order('name', { ascending: true });

        if (error) {
            this.logger.error(`Prompt templates list: ${error.message}`);
            throw new Error('Prompt templates yuklanmadi');
        }
        return (data || []) as PromptTemplateRow[];
    }

    /** Update template content and/or is_active (admin). */
    async update(id: string, payload: { content?: string; is_active?: boolean }): Promise<PromptTemplateRow> {
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (payload.content !== undefined) updates.content = payload.content;
        if (payload.is_active !== undefined) updates.is_active = payload.is_active;

        const { data, error } = await this.databaseService.client
            .from('prompt_templates')
            .update(updates)
            .eq('_id', id)
            .select()
            .single();

        if (error || !data) {
            this.logger.error(`Prompt template update: ${error?.message}`);
            throw new NotFoundException('Shablon topilmadi');
        }
        return data as PromptTemplateRow;
    }
}
