import type { NextApiRequest, NextApiResponse } from 'next';
import { Client } from 'pg'; // <-- Use Client

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect(); // <-- Connect

    const result = await client.query(`
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

    await client.end(); // <-- Disconnect
    
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Signals fetch error:', error);
    await client.end(); // <-- Ensure disconnect on error
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
}