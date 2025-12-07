import pg from 'pg';
import { POSTGRES_CONFIG } from './config.js';

const { Pool } = pg;

const pool = new Pool(POSTGRES_CONFIG);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const db = pool;

