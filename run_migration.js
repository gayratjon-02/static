
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Manually parse .env for DATABASE_URL if dotenv is missing
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^DATABASE_URL=(.*)$/);
        if (match) {
            process.env.DATABASE_URL = match[1].replace(/^["'](.*)["']$/, '$1');
        }
    });
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("DATABASE_URL is not defined in .env");
    process.exit(1);
}

const client = new Client({
    connectionString: connectionString,
});

async function runMigration() {
    try {
        await client.connect();
        console.log("Connected to database");

        const sqlPath = path.resolve(__dirname, 'src/schemas/migrations/001_add_batch_id.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log("Running migration...");
        await client.query(sql);
        console.log("Migration completed successfully!");

    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await client.end();
    }
}

runMigration();
