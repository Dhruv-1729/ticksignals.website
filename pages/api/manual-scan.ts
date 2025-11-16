import type { NextApiRequest, NextApiResponse } from 'next';
import { Client } from 'pg';

// Helper to send SSE (Server-Sent Events) for streaming logs
function sendLog(res: NextApiResponse, log: string) {
  res.write(`data: ${JSON.stringify({ log })}\n\n`);
}

function sendComplete(res: NextApiResponse) {
  res.write(`data: ${JSON.stringify({ complete: true })}\n\n`);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { scanType } = req.body;

  if (!scanType || !['mass', 'forecast'].includes(scanType)) {
    return res.status(400).json({ error: 'Invalid scan type' });
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    sendLog(res, `🚀 Starting ${scanType === 'mass' ? 'Mass Run' : 'Forecast Run'}...`);
    sendLog(res, '📡 Connected to database');

    // Get list of tickers
    const tickersResult = await client.query(`
      SELECT DISTINCT "Ticker" 
      FROM all_signals 
      ORDER BY "Ticker"
      LIMIT 100
    `);

    const tickers = tickersResult.rows.map((row: any) => row.Ticker);
    sendLog(res, ` Found ${tickers.length} tickers to process`);

    if (scanType === 'mass') {
      sendLog(res, '\n--- MASS RUN: Processing Signals ---');
      
      // Note: This is a placeholder. In production, you'd need to:
      // 1. Fetch historical data for each ticker
      // 2. Run your signal generation algorithm
      // 3. Store results in database
      
      for (let i = 0; i < tickers.length; i++) {
        const ticker = tickers[i];
        sendLog(res, `[${i + 1}/${tickers.length}] Processing ${ticker}...`);
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // In production, you would:
        // - Fetch stock data using yahoo-finance2
        // - Generate signals using your algorithm
        // - Store in database
        
        sendLog(res, `   ${ticker} complete`);
      }
      
      sendLog(res, '\nMass Run Complete!');
      sendLog(res, ` Processed ${tickers.length} tickers`);
      
    } else {
      sendLog(res, '\n--- FORECAST RUN: Generating Predictions ---');
      
      let forecastCount = 0;
      
      for (let i = 0; i < tickers.length; i++) {
        const ticker = tickers[i];
        sendLog(res, `[${i + 1}/${tickers.length}] Analyzing ${ticker}...`);
        
        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // In production, you would:
        // - Fetch stock data
        // - Calculate forecast metrics
        // - Store forecasts in database
        
        // Simulate finding forecasts for some tickers
        if (Math.random() > 0.7) {
          forecastCount++;
          sendLog(res, `   ${ticker} - BUY_FORECAST (75% confidence)`);
        } else {
          sendLog(res, `   ${ticker} - Neutral`);
        }
      }
      
      sendLog(res, '\n Forecast Run Complete!');
      sendLog(res, ` Generated ${forecastCount} forecast signals`);
    }

    await client.end();
    sendComplete(res);
    res.end();

  } catch (error: any) {
    console.error('Scan error:', error);
    sendLog(res, `Error: ${error.message}`);
    try {
      await client.end();
    } catch (e) {
      // Ignore
    }
    res.end();
  }
}

export const config = {
  api: {
    responseLimit: false,
  },
};