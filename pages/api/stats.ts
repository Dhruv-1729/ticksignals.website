import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Get unique ticker count from signals
    const result = await pool.query(`
      SELECT COUNT(DISTINCT "Ticker") as count
      FROM all_signals
    `);

    await pool.end();
    
    const count = result.rows[0]?.count || 0;
    res.status(200).json({ activeSignals: count });
  } catch (error) {
    console.error('Stats fetch error:', error);
    await pool.end();
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}