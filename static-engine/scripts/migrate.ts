import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function runMigrations() {
    // 1. Load .env
    const envPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
        console.log(`Loading .env from ${envPath}`);
        const envConfig = fs.readFileSync(envPath, 'utf-8');
        envConfig.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["'](.*)["']$/, '$1');
                process.env[key] = value;
            }
        });
    }

    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL is not set in .env');
        process.exit(1);
    }

    // 2. Connect to DB
    console.log('Connecting to database...');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Required for Supabase in some environments
    });

    try {
        await client.connect();
        console.log('Connected successfully.');

        // 3. Define migrations
        const migrations = [
            'src/schemas/migrations/002_concept_categories_migration.sql',
            'src/schemas/migrations/003_concept_production_fixes.sql'
        ];

        // 4. Run migrations
        for (const migrationFile of migrations) {
            const filePath = path.resolve(__dirname, '../', migrationFile);
            console.log(`\nRunning migration: ${migrationFile}`);
            if (!fs.existsSync(filePath)) {
                console.error(`File not found: ${filePath}`);
                continue;
            }

            const sql = fs.readFileSync(filePath, 'utf-8');
            try {
                await client.query(sql);
                console.log(`✅ Successfully executed ${migrationFile}`);
            } catch (err: any) {
                console.error(`❌ Failed to execute ${migrationFile}:`);
                console.error(err.message);
                // Don't exit, try next one or let user decide? 
                // Usually we stop, but here 002 might fail if table exists partially etc.
                // Let's stop on error to be safe.
                process.exit(1);
            }
        }

        console.log('\nAll migrations finished successfully.');

    } catch (err: any) {
        console.error('Database connection error:', err);
    } finally {
        await client.end();
    }
}

runMigrations();
