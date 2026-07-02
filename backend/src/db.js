import pg from 'pg';
import config from './config.js';

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message);
});

export default pool;
