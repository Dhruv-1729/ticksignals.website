import type { NextApiRequest, NextApiResponse } from 'next';
import { Client } from 'pg'; // <-- Use Client

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Create a new client for each request
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect(); // <-- Connect
    
    const result = await client.query(`
      SELECT COUNT(DISTINCT "Ticker") as count
      FROM all_signals
    `);
    
    await client.end(); // <-- Disconnect
    
    const count = result.rows[0]?.count || 0;
    res.status(200).json({ activeSignals: count });
  } catch (error) {
    console.error('Stats fetch error:', error);
    await client.end(); // <-- Ensure disconnect on error
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}