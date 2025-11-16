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
    const result = await pool.query(`
      SELECT 
        "Date", 
        "Ticker", 
        "Signal", 
        "Price", 
        "Confidence_Pct"
      FROM all_signals 
      ORDER BY "Date" DESC, "Confidence_Pct" DESC 
      LIMIT 100
    `);

    await pool.end();
    
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Signals fetch error:', error);
    await pool.end();
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
}