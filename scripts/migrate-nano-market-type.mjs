import 'dotenv/config';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
const pool = new pg.Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});
try {
  if (process.argv.includes('--local-only') && !['localhost','127.0.0.1','[::1]'].includes(new URL(process.env.DATABASE_URL).hostname)) throw new Error('Local migration skipped: database is remote.');
  await pool.query(await readFile(new URL('../database/migrations/20261004_market_types.sql',import.meta.url),'utf8'));
  await pool.query(await readFile(new URL('../database/migrations/20261004_nano_market_type.sql',import.meta.url),'utf8'));
  await pool.query(await readFile(new URL('../database/migrations/20261004_nano_market_types.sql',import.meta.url),'utf8'));
  console.log('Nano Market Type migration completed.');
} finally {await pool.end();}
