"""
Core signal generation and forecasting logic
Extracted from your Tick Signals v43.py
"""

import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from sqlalchemy import text

def calculate_rsi(prices, period=14):
    """Calculate Relative Strength Index (RSI)"""
    delta = prices.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

def generate_enhanced_signals(data):
    """
    Generate buy/sell signals using MA crossover strategy
    (Simplified version - add your full logic here)
    """
    data['Signal'] = 0
    data['SMA20'] = data['Close'].rolling(window=20).mean()
    data['SMA50'] = data['Close'].rolling(window=50).mean()
    data['SMA200'] = data['Close'].rolling(window=200).mean()
    data['RSI'] = calculate_rsi(data['Close'], period=14)
    
    # MACD
    exp12 = data['Close'].ewm(span=12, adjust=False).mean()
    exp26 = data['Close'].ewm(span=26, adjust=False).mean()
    data['MACD'] = exp12 - exp26
    data['MACD_Signal'] = data['MACD'].ewm(span=9, adjust=False).mean()
    data['MACD_Hist'] = data['MACD'] - data['MACD_Signal']
    
    # Buy conditions
    buy_conditions = (
        (data['SMA20'] > data['SMA50']) & 
        (data['SMA20'].shift(1) <= data['SMA50'].shift(1)) &
        (data['SMA50'] >= data['SMA200'] * 0.98) &
        (data['RSI'] < 70) &
        (data['RSI'] > 30) &
        (data['MACD_Hist'] > data['MACD_Hist'].shift(1))
    )
    
    # Sell conditions
    sell_conditions = (
        (data['SMA20'] < data['SMA50']) & 
        (data['SMA20'].shift(1) >= data['SMA50'].shift(1)) &
        ((data['RSI'] > 75) | (data['MACD_Hist'] < 0))
    )
    
    data.loc[buy_conditions, 'Signal'] = 2
    data.loc[sell_conditions, 'Signal'] = -2
    
    return data

def process_ticker_signals(ticker, engine):
    """
    Process a single ticker and generate signals
    Returns: dict with signal_count or None if failed
    """
    try:
        # Fetch stock data
        data = yf.download(ticker, period='2y', progress=False, auto_adjust=True)
        
        if data.empty or len(data) < 200:
            return None
        
        # Generate signals
        data = generate_enhanced_signals(data)
        
        # Alternate signals (only opposite signals)
        is_invested = False
        cleaned_signals = []
        for index, row in data.iterrows():
            signal = row['Signal']
            if not is_invested and signal == 2:
                cleaned_signals.append(signal)
                is_invested = True
            elif is_invested and signal == -2:
                cleaned_signals.append(signal)
                is_invested = False
            else:
                cleaned_signals.append(0)
        data['Signal'] = cleaned_signals
        
        # Store signals in database
        signals_to_store = data[data['Signal'] != 0].copy()
        
        if not signals_to_store.empty:
            with engine.connect() as conn:
                for date, row in signals_to_store.iterrows():
                    signal_type = "Buy" if row['Signal'] == 2 else "Sell"
                    
                    insert_query = text("""
                        INSERT INTO all_signals ("Date", "Ticker", "Signal", "Price", "Confidence_Pct")
                        VALUES (:date, :ticker, :signal, :price, :confidence)
                        ON CONFLICT ("Date", "Ticker") 
                        DO UPDATE SET "Signal" = :signal, "Price" = :price, "Confidence_Pct" = :confidence
                    """)
                    
                    conn.execute(insert_query, {
                        "date": date.strftime('%Y-%m-%d'),
                        "ticker": ticker,
                        "signal": signal_type,
                        "price": float(row['Close']),
                        "confidence": 75  # Simplified - use your confidence calculation
                    })
                
                conn.commit()
            
            return {'signal_count': len(signals_to_store)}
        
        return {'signal_count': 0}
        
    except Exception as e:
        print(f"Error processing {ticker}: {e}")
        return None

def generate_ticker_forecast(ticker, engine):
    """
    Generate forecast for a single ticker
    Returns: dict with forecast info or None
    """
    try:
        # Fetch stock data
        data = yf.download(ticker, period='2y', progress=False, auto_adjust=True)
        
        if data.empty or len(data) < 200:
            return None
        
        # Calculate indicators
        data['SMA50'] = data['Close'].rolling(window=50).mean()
        data['SMA200'] = data['Close'].rolling(window=200).mean()
        data['RSI'] = calculate_rsi(data['Close'], period=14)
        
        # Simple forecast logic (replace with your full logic)
        current_gap = data['SMA50'].iloc[-1] - data['SMA200'].iloc[-1]
        rsi_value = data['RSI'].iloc[-1]
        
        # Determine if there's a forecast signal
        has_forecast = False
        signal = 'NEUTRAL'
        confidence = 0
        
        if current_gap < 0 and abs(current_gap) < data['Close'].iloc[-1] * 0.05:
            if 30 <= rsi_value <= 65:
                has_forecast = True
                signal = 'BUY_FORECAST'
                confidence = 70
        elif current_gap > 0 and abs(current_gap) < data['Close'].iloc[-1] * 0.05:
            if 35 <= rsi_value <= 75:
                has_forecast = True
                signal = 'SELL_FORECAST'
                confidence = 70
        
        if has_forecast:
            # Store forecast in database
            with engine.connect() as conn:
                insert_query = text("""
                    INSERT INTO forecast_signals 
                    ("Ticker", "Date", "Forecast_Signal", "Confidence_%", 
                     "Days_To_Crossover", "Current_Price", "Gap_%", "RSI", 
                     "MACD_Histogram", "Price_ROC_%", "Volume_Trend_%", "Convergence_Rate")
                    VALUES (:ticker, :date, :signal, :conf, :days, :price, :gap, :rsi, :macd, :roc, :vol, :conv)
                    ON CONFLICT ("Ticker", "Date") 
                    DO UPDATE SET 
                        "Forecast_Signal" = :signal,
                        "Confidence_%" = :conf
                """)
                
                conn.execute(insert_query, {
                    "ticker": ticker,
                    "date": datetime.now().strftime('%Y-%m-%d'),
                    "signal": signal,
                    "conf": confidence,
                    "days": 5.0,
                    "price": float(data['Close'].iloc[-1]),
                    "gap": float(abs(current_gap) / data['Close'].iloc[-1] * 100),
                    "rsi": float(rsi_value),
                    "macd": 0.0,
                    "roc": 0.0,
                    "vol": 0.0,
                    "conv": 0.0
                })
                
                conn.commit()
            
            return {
                'has_forecast': True,
                'signal': signal,
                'confidence': confidence
            }
        
        return {'has_forecast': False}
        
    except Exception as e:
        print(f"Error forecasting {ticker}: {e}")
        return None