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
    
    // Create a map of dates to prices for signal positioning
    const dateToPriceMap: { [key: string]: number } = {};
    historicalData.forEach((d: any, idx: number) => {
      const dateStr = d.date.toISOString().split('T')[0];
      dateToPriceMap[dateStr] = d.close;
    });

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

      signals = signalsResult.rows.map((row: any) => {
        const signalDate = new Date(row.Date).toISOString().split('T')[0];
        // Find the closest price from historical data
        let signalPrice = dateToPriceMap[signalDate];
        let chartDate = signalDate;
        
        // If exact date not found, find the closest date
        if (!signalPrice) {
          const signalDateObj = new Date(signalDate);
          let closestDate = chartDates[0];
          let minDiff = Math.abs(new Date(chartDates[0]).getTime() - signalDateObj.getTime());
          
          for (const date of chartDates) {
            const diff = Math.abs(new Date(date).getTime() - signalDateObj.getTime());
            if (diff < minDiff) {
              minDiff = diff;
              closestDate = date;
            }
          }
          chartDate = closestDate;
          signalPrice = dateToPriceMap[closestDate] || row.Price;
        }
        
        return {
          date: chartDate,
          type: row.Signal,
          price: `${row.Price.toFixed(2)}`,
          Date: row.Date,
          chartPrice: signalPrice
        };
      });

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
          date: new Date(f.Date).toISOString().split('T')[0],
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

    // Prepare signal markers for chart
    const buySignals = signals.filter((s: any) => s.type.includes('Buy'));
    const sellSignals = signals.filter((s: any) => s.type.includes('Sell'));
    
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
            hovertemplate: '<b>%{fullData.name}</b><br>Date: %{x}<br>Price: $%{y:.2f}<extra></extra>',
          },
          // Buy signals (green up arrows)
          ...(buySignals.length > 0 ? [{
            x: buySignals.map((s: any) => s.date),
            y: buySignals.map((s: any) => s.chartPrice),
            type: 'scatter',
            mode: 'markers+text',
            name: 'Buy Signals',
            marker: {
              symbol: 'triangle-up',
              size: 12,
              color: '#10b981',
              line: { color: '#10b981', width: 1 }
            },
            text: '',
            textposition: 'top center',
            hovertemplate: '<b>Buy Signal</b><br>Date: %{x}<br>Price: $%{y:.2f}<extra></extra>',
            showlegend: false,
          }] : []),
          // Sell signals (red down arrows)
          ...(sellSignals.length > 0 ? [{
            x: sellSignals.map((s: any) => s.date),
            y: sellSignals.map((s: any) => s.chartPrice),
            type: 'scatter',
            mode: 'markers+text',
            name: 'Sell Signals',
            marker: {
              symbol: 'triangle-down',
              size: 12,
              color: '#ef4444',
              line: { color: '#ef4444', width: 1 }
            },
            text: '',
            textposition: 'bottom center',
            hovertemplate: '<b>Sell Signal</b><br>Date: %{x}<br>Price: $%{y:.2f}<extra></extra>',
            showlegend: false,
          }] : []),
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