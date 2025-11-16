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
        "Ticker",
        "Date",
        "Forecast_Signal",
        "Confidence_%",
        "Days_To_Crossover",
        "Current_Price",
        "Gap_%",
        "RSI",
        "MACD_Histogram",
        "Price_ROC_%",
        "Volume_Trend_%",
        "Convergence_Rate"
      FROM forecast_signals 
      WHERE "Date" >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY "Date" DESC, "Confidence_%" DESC 
      LIMIT 100
    `);

    await client.end(); // <-- Disconnect
    
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Forecasts fetch error:', error);
    await client.end(); // <-- Ensure disconnect on error
    res.status(500).json({ error: 'Failed to fetch forecasts' });
  }
}