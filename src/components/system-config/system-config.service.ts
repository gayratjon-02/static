import { Injectable, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface ConfigEntry {
	key: string;
	value: unknown;
	description: string | null;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class SystemConfigService implements OnModuleInit {
	private cache = new Map<string, unknown>();
	private lastFetchedAt = 0;

	constructor(private readonly databaseService: DatabaseService) {}

	async onModuleInit(): Promise<void> {
		await this.refreshCache();
	}

	private async refreshCache(): Promise<void> {
		const { data } = await this.databaseService.client
			.from('system_config')
			.select('key, value, description');

		if (data) {
			this.cache.clear();
			for (const row of data) {
				this.cache.set(row.key, row.value);
			}
			this.lastFetchedAt = Date.now();
		}
	}

	private async ensureFresh(): Promise<void> {
		if (Date.now() - this.lastFetchedAt > CACHE_TTL_MS) {
			await this.refreshCache();
		}
	}

	async getNumber(key: string, fallback: number): Promise<number> {
		await this.ensureFresh();
		const raw = this.cache.get(key);
		if (raw === undefined || raw === null) return fallback;
		const parsed = Number(raw);
		return Number.isNaN(parsed) ? fallback : parsed;
	}

	async getString(key: string, fallback: string): Promise<string> {
		await this.ensureFresh();
		const raw = this.cache.get(key);
		return raw !== undefined && raw !== null ? String(raw) : fallback;
	}

	async getAll(): Promise<ConfigEntry[]> {
		await this.ensureFresh();
		const { data } = await this.databaseService.client
			.from('system_config')
			.select('key, value, description')
			.order('key');

		return (data ?? []) as ConfigEntry[];
	}

	async update(key: string, value: unknown): Promise<void> {
		console.log('SystemConfigService: update');

		await this.databaseService.client
			.from('system_config')
			.update({ value, updated_at: new Date().toISOString() })
			.eq('key', key);

		this.cache.set(key, value);
	}
}
