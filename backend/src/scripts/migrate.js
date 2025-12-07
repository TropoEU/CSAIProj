import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
const { Pool } = pg;

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Create database connection
const pool = new Pool({
    host: process.env.POSTGRES_HOST === 'postgres' ? 'localhost' : process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB
});

const MIGRATIONS_DIR = path.join(__dirname, '../../../db/migrations');

// Ensure migrations table exists
async function ensureMigrationsTable() {
    const migrationTableSQL = `
        CREATE TABLE IF NOT EXISTS migrations (
            id SERIAL PRIMARY KEY,
            migration_name VARCHAR(255) UNIQUE NOT NULL,
            applied_at TIMESTAMP DEFAULT NOW()
        );
    `;
    await pool.query(migrationTableSQL);
}

// Get list of migration files
function getMigrationFiles() {
    const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql') && !f.includes('create_migrations_table'))
        .sort();
    return files;
}

// Get applied migrations from database
async function getAppliedMigrations() {
    const result = await pool.query('SELECT migration_name FROM migrations ORDER BY migration_name');
    return result.rows.map(row => row.migration_name);
}

// Parse migration file to get UP and DOWN sections
function parseMigrationFile(filename) {
    const filepath = path.join(MIGRATIONS_DIR, filename);
    const content = fs.readFileSync(filepath, 'utf8');

    // Split by -- UP and -- DOWN comments
    const upMatch = content.match(/--\s*UP\s*\n([\s\S]*?)(?:--\s*DOWN|$)/i);
    const downMatch = content.match(/--\s*DOWN\s*\n([\s\S]*?)$/i);

    const up = upMatch ? upMatch[1].trim() : '';
    const down = downMatch ? downMatch[1].trim() : '';

    return { up, down };
}

// Run migration UP
async function runMigrationUp(filename) {
    console.log(`Running migration: ${filename}`);
    const { up } = parseMigrationFile(filename);

    if (!up) {
        console.log(`  ⚠️  No UP section found in ${filename}`);
        return;
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(up);
        await client.query('INSERT INTO migrations (migration_name) VALUES ($1)', [filename]);
        await client.query('COMMIT');
        console.log(`  ✅ ${filename} applied successfully`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`  ❌ Error applying ${filename}:`, error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Run migration DOWN
async function runMigrationDown(filename) {
    console.log(`Rolling back migration: ${filename}`);
    const { down } = parseMigrationFile(filename);

    if (!down) {
        console.log(`  ⚠️  No DOWN section found in ${filename}`);
        return;
    }

    // Remove comment markers from down section
    const downSQL = down.replace(/^--\s*/gm, '');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(downSQL);
        await client.query('DELETE FROM migrations WHERE migration_name = $1', [filename]);
        await client.query('COMMIT');
        console.log(`  ✅ ${filename} rolled back successfully`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`  ❌ Error rolling back ${filename}:`, error.message);
        throw error;
    } finally {
        client.release();
    }
}

// Main migration runner
async function migrate(command = 'up') {
    try {
        console.log('🚀 Starting database migrations...\n');

        // Ensure migrations tracking table exists
        await ensureMigrationsTable();

        const allMigrations = getMigrationFiles();
        const appliedMigrations = await getAppliedMigrations();

        if (command === 'up') {
            const pendingMigrations = allMigrations.filter(m => !appliedMigrations.includes(m));

            if (pendingMigrations.length === 0) {
                console.log('✅ No pending migrations. Database is up to date!');
                return;
            }

            console.log(`Found ${pendingMigrations.length} pending migration(s):\n`);

            for (const migration of pendingMigrations) {
                await runMigrationUp(migration);
            }

            console.log('\n✅ All migrations applied successfully!');
        }
        else if (command === 'down') {
            if (appliedMigrations.length === 0) {
                console.log('No migrations to roll back.');
                return;
            }

            // Roll back the last migration
            const lastMigration = appliedMigrations[appliedMigrations.length - 1];
            await runMigrationDown(lastMigration);

            console.log('\n✅ Last migration rolled back successfully!');
        }
        else if (command === 'status') {
            console.log(`Total migrations: ${allMigrations.length}`);
            console.log(`Applied: ${appliedMigrations.length}`);
            console.log(`Pending: ${allMigrations.length - appliedMigrations.length}\n`);

            console.log('Applied migrations:');
            appliedMigrations.forEach(m => console.log(`  ✅ ${m}`));

            const pending = allMigrations.filter(m => !appliedMigrations.includes(m));
            if (pending.length > 0) {
                console.log('\nPending migrations:');
                pending.forEach(m => console.log(`  ⏳ ${m}`));
            }
        }
        else {
            console.log('Usage: node db/migrate.js [up|down|status]');
            console.log('  up     - Apply all pending migrations (default)');
            console.log('  down   - Roll back the last migration');
            console.log('  status - Show migration status');
        }

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run migrations
const command = process.argv[2] || 'up';
migrate(command);
