import { Pool } from 'pg';

// This creates one pool that will be reused across all API calls.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default pool;