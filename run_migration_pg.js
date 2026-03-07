const { Client } = require('pg');
const fs = require('fs');

const connectionString = 'postgresql://postgres:MoreThan0202MoreThan@db.bkjfitcdsioxmfymsmuf.supabase.co:5432/postgres';

async function runMigration() {
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        const sql = fs.readFileSync('/Users/gayratjon/Desktop/static-engine/static-engine/supabase/migrations/20260307171522_create_admin_invites.sql', 'utf8');

        await client.query(sql);
        console.log('Migration applied successfully.');
    } catch (err) {
        console.error('Error applying migration:', err);
    } finally {
        await client.end();
    }
}

runMigration();
