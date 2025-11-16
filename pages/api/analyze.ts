import type { NextApiRequest, NextApiResponse } from 'next';
const yahooFinance = require('yahoo-finance2').default;
import { Client } from 'pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { ticker } = req.body;

    if (!ticker) {
      return res.status(400).json({ error: 'Ticker is required' });
    }

    // Fetch stock quote data
    const quote: any = await yahooFinance.quote(ticker);
    
    // Fetch historical data (1 year)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);
    
    const historicalData: any = await yahooFinance.historical(ticker, {
      period1: startDate,
      period2: endDate,
      interval: '1d',
    });

    // Format chart data for Plotly
    const chartDates = historicalData.map((d: any) => d.date.toISOString().split('T')[0]);
    const chartPrices = historicalData.map((d: any) => d.close);

    // Fetch signals for this ticker from database
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
    });

    interface Signal {
      date: string;
      type: string;
      price: string;
      Date: Date;
    }

    let signals: Signal[] = [];
    let forecast: any = null;

    try {
      await client.connect();

      // Get recent signals for this ticker
      const signalsResult = await client.query(`
        SELECT "Date", "Signal", "Price", "Confidence_Pct"
        FROM all_signals
        WHERE "Ticker" = $1
        ORDER BY "Date" DESC
        LIMIT 10
      `, [ticker.toUpperCase()]);

      signals = signalsResult.rows.map((row: any) => ({
        date: new Date(row.Date).toISOString().split('T')[0],
        type: row.Signal,
        price: `${row.Price.toFixed(2)}`,
        Date: row.Date
      }));

      // Check for recent forecast (last 30 days)
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
      `, [ticker.toUpperCase()]);

      if (forecastResult.rows.length > 0) {
        const f = forecastResult.rows[0];
        forecast = {
          signal: f.Forecast_Signal.replace('_FORECAST', '').replace('_', ' '),
          confidence: f['Confidence_%'],
          days: f.Days_To_Crossover.toFixed(1),
          isRecent: true
        };
      }

      await client.end();
    } catch (dbError) {
      console.error('Database error:', dbError);
      await client.end();
      // Continue without signals/forecast if DB fails
    }

    // Format market cap
    const formatMarketCap = (value: number) => {
      if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
      if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
      if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
      return `${value.toLocaleString()}`;
    };

    const responseData = {
      ticker: ticker.toUpperCase(),
      price: `${quote.regularMarketPrice?.toFixed(2) || 'N/A'}`,
      marketCap: quote.marketCap ? formatMarketCap(quote.marketCap) : 'N/A',
      volume: quote.regularMarketVolume ? quote.regularMarketVolume.toLocaleString() : 'N/A',
      peRatio: quote.trailingPE ? quote.trailingPE.toFixed(2) : 'N/A',
      chart: {
        data: [
          {
            x: chartDates,
            y: chartPrices,
            type: 'scatter',
            mode: 'lines',
            name: `${ticker.toUpperCase()} Price`,
            line: { color: '#14b8a6', width: 2 },
          },
        ],
        layout: {
          title: `${quote.shortName || ticker.toUpperCase()} - 1 Year Chart`,
          xaxis: { title: 'Date' },
          yaxis: { title: 'Price (USD)' },
          autosize: true,
        },
      },
      forecast: forecast,
      signals: signals,
    };

    res.status(200).json(responseData);
  } catch (error: any) {
    console.error('Analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze stock',
      details: error.message 
    });
  }
}