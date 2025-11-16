import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../lib/db'; // <-- Import the shared pool

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Do NOT create a new pool here

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

    // DO NOT call pool.end()
    
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Signals fetch error:', error);
    // DO NOT call pool.end()
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
}