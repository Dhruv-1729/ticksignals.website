import type { NextApiRequest, NextApiResponse } from 'next';
import YahooFinance from 'yahoo-finance2';
import { Client } from 'pg';

const yahooFinance = new YahooFinance();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tickers } = req.body;

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return res.status(400).json({ error: 'Tickers array is required' });
    }

    if (tickers.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 tickers allowed per request' });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Process each ticker
    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i].toUpperCase().trim();
      
      try {
        // Fetch stock quote data
        const quote: any = await yahooFinance.quote(ticker);
        
        // Fetch historical data (2 years for faster processing)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 2);
        
        const historicalData: any = await yahooFinance.historical(ticker, {
          period1: startDate,
          period2: endDate,
          interval: '1d',
        });

        // Format market cap
        const formatMarketCap = (value: number) => {
          if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
          if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
          if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
          return `${value.toLocaleString()}`;
        };

        // Fetch forecast from database
        let forecast: any = null;
        const client = new Client({
          connectionString: process.env.DATABASE_URL,
        });

        try {
          await client.connect();

          const forecastResult = await client.query(`
            SELECT 
              "Forecast_Signal",
              "Confidence_%",
              "Days_To_Crossover",
              "Date"
            FROM forecast_signals
            WHERE "Ticker" = $1
            AND "Date" >= CURRENT_DATE - INTERVAL '30 days'
            ORDER BY "Date" DESC
            LIMIT 1
          `, [ticker]);

          if (forecastResult.rows.length > 0) {
            const f = forecastResult.rows[0];
            forecast = {
              signal: f.Forecast_Signal.replace('_FORECAST', '').replace('_', ' '),
              confidence: f['Confidence_%'],
              days: f.Days_To_Crossover.toFixed(1),
              date: new Date(f.Date).toISOString().split('T')[0],
              isRecent: true
            };
          }

          await client.end();
        } catch (dbError) {
          console.error('Database error for ticker', ticker, ':', dbError);
          await client.end();
          // Continue without forecast if DB fails
        }

        const result = {
          ticker: ticker,
          success: true,
          data: {
            ticker: ticker,
            price: `${quote.regularMarketPrice?.toFixed(2) || 'N/A'}`,
            marketCap: quote.marketCap ? formatMarketCap(quote.marketCap) : 'N/A',
            volume: quote.regularMarketVolume ? quote.regularMarketVolume.toLocaleString() : 'N/A',
            peRatio: quote.trailingPE ? quote.trailingPE.toFixed(2) : 'N/A',
            forecast: forecast,
          }
        };

        // Send result via SSE
        res.write(`data: ${JSON.stringify({ result })}\n\n`);

      } catch (tickerError: any) {
        // Send error for this ticker
        const errorResult = {
          ticker: ticker,
          success: false,
          error: tickerError.message || 'Failed to analyze ticker'
        };
        
        res.write(`data: ${JSON.stringify({ result: errorResult })}\n\n`);
      }
    }

    // Send completion signal
    res.write(`data: ${JSON.stringify({ complete: true })}\n\n`);
    res.end();

  } catch (error: any) {
    console.error('Bulk analysis error:', error);
    
    // Send error as SSE
    res.write(`data: ${JSON.stringify({ 
      error: error.message || 'Failed to process bulk analysis',
      complete: true,
      error: true 
    })}\n\n`);
    
    res.end();
  }
}

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

