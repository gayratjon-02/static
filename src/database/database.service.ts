import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class DatabaseService {
	private supabase: SupabaseClient;

	constructor(private configService: ConfigService) {
		const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
		const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY');

		this.supabase = createClient(supabaseUrl, supabaseKey);
	}

	get client(): SupabaseClient {
		return this.supabase;
	}
}
