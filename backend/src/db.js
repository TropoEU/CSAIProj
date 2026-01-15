import pg from 'pg';
import { POSTGRES_CONFIG } from './config.js';

const { Pool } = pg;

const pool = new Pool(POSTGRES_CONFIG);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Test connection on startup
pool
  .query('SELECT 1')
  .then(() => console.log('PostgreSQL Connected'))
  .catch((err) => console.error('PostgreSQL Connection Error:', err.message));

export const db = pool;
