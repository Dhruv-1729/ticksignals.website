"""
Core signal generation and forecasting logic
Improved version with SMA50/200 crossover, Prophet forecasting, and balanced filters
"""

import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from sqlalchemy import text
from prophet import Prophet
import warnings
warnings.filterwarnings('ignore')

def calculate_rsi(prices, period=14):
    """Calculate Relative Strength Index (RSI)"""
    delta = prices.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

def calculate_confidence(data, signal_date, signal_type):
    """
    Calculate confidence based on multiple factors
    Returns confidence percentage (0-95)
    """
    try:
        idx = data.index.get_loc(signal_date)
        row = data.iloc[idx]
        
        confidence = 50  # Base confidence
        
        # RSI factor (optimal range = higher confidence)
        rsi = row.get('RSI', 50)
        if 40 <= rsi <= 60:
            confidence += 15
        elif 30 <= rsi <= 70:
            confidence += 10
        elif 20 <= rsi <= 80:
            confidence += 5
        
        # MACD momentum
        macd_hist = row.get('MACD_Hist', 0)
        if macd_hist > 0:
            confidence += 10
        elif macd_hist < -0.5:
            confidence -= 5
        
        # Volume confirmation (less strict - just check if volume exists)
        volume = row.get('Volume', 0)
        volume_ma = row.get('Volume_MA', volume)
        if volume > volume_ma * 0.7:  # Less strict volume requirement
            confidence += 5
        
        # Trend strength (how far apart are the MAs?)
        sma50 = row.get('SMA50', row.get('Close', 0))
        sma200 = row.get('SMA200', row.get('Close', 0))
        if sma200 > 0:
            ma_gap_pct = abs(sma50 - sma200) / sma200 * 100
            if ma_gap_pct > 5:  # Strong trend
                confidence += 5
            elif ma_gap_pct < 1:  # Very close - less confident
                confidence -= 5
        
        return min(max(confidence, 40), 95)  # Cap between 40-95
    except Exception as e:
        print(f"Error calculating confidence: {e}")
        return 65  # Default confidence

def calculate_days_to_crossover(data):
    """
    Calculate actual days until SMA50/200 crossover based on convergence rate
    """
    try:
        if len(data) < 20:
            return None
        
        current_gap = data['SMA50'].iloc[-1] - data['SMA200'].iloc[-1]
        current_price = data['Close'].iloc[-1]
        
        # If already very close (within 1% of price), return 0
        if abs(current_gap) < current_price * 0.01:
            return 0.0
        
        # Calculate convergence rate over last 20 days
        recent_gaps = []
        lookback = min(30, len(data))
        for i in range(lookback):
            idx = len(data) - 1 - i
            if idx >= 0:
                gap = data['SMA50'].iloc[idx] - data['SMA200'].iloc[idx]
                recent_gaps.append(gap)
        
        if len(recent_gaps) < 5:
            return None
        
        # Calculate average daily convergence rate
        convergence_rate = (recent_gaps[0] - recent_gaps[-1]) / len(recent_gaps)
        
        # If not converging (or diverging), return None
        if abs(convergence_rate) < 0.001:
            return None
        
        # If gap is positive and rate is positive (diverging), or gap negative and rate negative
        if (current_gap > 0 and convergence_rate > 0) or (current_gap < 0 and convergence_rate < 0):
            return None  # Not converging
        
        days_to_cross = abs(current_gap / convergence_rate)
        return max(0.0, min(days_to_cross, 365.0))  # Cap at 1 year
    except Exception as e:
        print(f"Error calculating days to crossover: {e}")
        return None

def generate_enhanced_signals(data):
    """
    Generate buy/sell signals using SMA50/200 crossover with balanced filters
    Less strict than before to generate more signals, but still maintains quality
    """
    data['Signal'] = 0
    
    # Primary: Classic Golden/Death Cross (SMA50/200) - proven and reliable
    data['SMA50'] = data['Close'].rolling(window=50).mean()
    data['SMA200'] = data['Close'].rolling(window=200).mean()
    
    # Secondary indicators for confirmation (less strict)
    data['RSI'] = calculate_rsi(data['Close'], period=14)
    data['Volume_MA'] = data['Volume'].rolling(window=20).mean()
    
    # MACD for momentum confirmation
    exp12 = data['Close'].ewm(span=12, adjust=False).mean()
    exp26 = data['Close'].ewm(span=26, adjust=False).mean()
    data['MACD'] = exp12 - exp26
    data['MACD_Signal'] = data['MACD'].ewm(span=9, adjust=False).mean()
    data['MACD_Hist'] = data['MACD'] - data['MACD_Signal']
    
    # Primary signal: SMA50/200 crossover (like original model)
    buy_crossover = (data['SMA50'] > data['SMA200']) & (data['SMA50'].shift(1) <= data['SMA200'].shift(1))
    sell_crossover = (data['SMA50'] < data['SMA200']) & (data['SMA50'].shift(1) >= data['SMA200'].shift(1))
    
    # Less strict confirmation filters (to generate more signals)
    # Buy: Just need RSI not extremely overbought, and some momentum
    buy_confirmation = (
        (data['RSI'] < 75) &  # Not extremely overbought (less strict than 70)
        (data['RSI'] > 25) &  # Not extremely oversold (less strict than 30)
        (data['MACD_Hist'] > -0.5)  # Not strongly negative momentum (very lenient)
    )
    
    # Sell: RSI overbought OR negative momentum
    sell_confirmation = (
        (data['RSI'] > 65) |  # Overbought OR
        (data['MACD_Hist'] < 0)  # Negative momentum
    )
    
    # Combined signals (less strict overall)
    buy_conditions = buy_crossover & buy_confirmation
    sell_conditions = sell_crossover & sell_confirmation
    
    data.loc[buy_conditions, 'Signal'] = 2
    data.loc[sell_conditions, 'Signal'] = -2
    
    return data

def process_ticker_signals(ticker, engine):
    """
    Process a single ticker and generate signals
    Returns: dict with signal_count or None if failed
    """
    try:
        # Fetch stock data - use longer period for better SMA200 calculation
        data = yf.download(ticker, period='3y', progress=False, auto_adjust=True)
        
        if data.empty or len(data) < 200:
            return None
        
        # Generate signals
        data = generate_enhanced_signals(data)
        
        # Alternate signals (only opposite signals) - like original model
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
                    
                    # Calculate dynamic confidence
                    confidence = calculate_confidence(data, date, signal_type)
                    
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
                        "confidence": confidence
                    })
                
                conn.commit()
            
            return {'signal_count': len(signals_to_store)}
        
        return {'signal_count': 0}
        
    except Exception as e:
        print(f"Error processing {ticker}: {e}")
        return None

def generate_ticker_forecast(ticker, engine):
    """
    Generate forecast for a single ticker using Prophet
    Returns: dict with forecast info or None
    """
    try:
        # Fetch stock data - use longer period for Prophet
        data = yf.download(ticker, period='3y', progress=False, auto_adjust=True)
        
        if data.empty or len(data) < 200:
            return None
        
        # Calculate indicators
        data['SMA50'] = data['Close'].rolling(window=50).mean()
        data['SMA200'] = data['Close'].rolling(window=200).mean()
        data['RSI'] = calculate_rsi(data['Close'], period=14)
        
        # MACD
        exp12 = data['Close'].ewm(span=12, adjust=False).mean()
        exp26 = data['Close'].ewm(span=26, adjust=False).mean()
        data['MACD'] = exp12 - exp26
        data['MACD_Signal'] = data['MACD'].ewm(span=9, adjust=False).mean()
        data['MACD_Hist'] = data['MACD'] - data['MACD_Signal']
        
        # Volume
        data['Volume_MA'] = data['Volume'].rolling(window=20).mean()
        
        # Calculate current gap and convergence
        current_gap = data['SMA50'].iloc[-1] - data['SMA200'].iloc[-1]
        current_price = data['Close'].iloc[-1]
        rsi_value = data['RSI'].iloc[-1]
        macd_hist = data['MACD_Hist'].iloc[-1]
        
        # Calculate days to crossover
        days_to_cross = calculate_days_to_crossover(data)
        
        # Use Prophet for forecasting
        has_forecast = False
        signal = 'NEUTRAL'
        confidence = 0
        
        try:
            # Prepare data for Prophet
            df_prophet = data.reset_index()
            df_prophet = df_prophet[['Date', 'Close']].copy()
            df_prophet.columns = ['ds', 'y']
            df_prophet['ds'] = pd.to_datetime(df_prophet['ds'])
            
            # Filter out NaN values
            df_prophet = df_prophet.dropna()
            
            if len(df_prophet) > 100:  # Need sufficient data
                # Fit Prophet model
                model = Prophet(
                    daily_seasonality=False,
                    weekly_seasonality=True,
                    yearly_seasonality=True,
                    changepoint_prior_scale=0.05  # Less sensitive to changes
                )
                model.fit(df_prophet)
                
                # Forecast 60 days ahead
                future = model.make_future_dataframe(periods=60)
                forecast = model.predict(future)
                
                # Get forecasted price in 30 days
                forecast_30d = forecast[forecast['ds'] == (df_prophet['ds'].max() + timedelta(days=30))]
                if not forecast_30d.empty:
                    forecast_price = forecast_30d['yhat'].iloc[0]
                    forecast_lower = forecast_30d['yhat_lower'].iloc[0]
                    forecast_upper = forecast_30d['yhat_upper'].iloc[0]
                    
                    # Calculate expected SMA50 and SMA200 in 30 days (simplified projection)
                    # This is an approximation - in reality we'd need to project the full series
                    price_change_pct = (forecast_price - current_price) / current_price
                    
                    # Simple projection: assume MAs move proportionally
                    projected_sma50 = data['SMA50'].iloc[-1] * (1 + price_change_pct * 0.7)
                    projected_sma200 = data['SMA200'].iloc[-1] * (1 + price_change_pct * 0.5)
                    projected_gap = projected_sma50 - projected_sma200
                    
                    # Determine forecast signal
                    gap_pct = abs(current_gap) / current_price * 100 if current_price > 0 else 0
                    
                    # Forecast conditions (less strict)
                    if current_gap < 0 and gap_pct < 8:  # SMA50 below SMA200, gap < 8%
                        if 25 <= rsi_value <= 70:  # RSI in reasonable range
                            if days_to_cross and days_to_cross < 90:  # Crossover expected soon
                                has_forecast = True
                                signal = 'BUY_FORECAST'
                                # Confidence based on multiple factors
                                confidence = 60
                                if 40 <= rsi_value <= 60:
                                    confidence += 10
                                if macd_hist > -0.5:
                                    confidence += 5
                                if days_to_cross < 30:
                                    confidence += 10
                                confidence = min(confidence, 85)
                    
                    elif current_gap > 0 and gap_pct < 8:  # SMA50 above SMA200, gap < 8%
                        if 30 <= rsi_value <= 75:  # RSI in reasonable range
                            if days_to_cross and days_to_cross < 90:  # Crossover expected soon
                                has_forecast = True
                                signal = 'SELL_FORECAST'
                                # Confidence based on multiple factors
                                confidence = 60
                                if rsi_value > 65:
                                    confidence += 10
                                if macd_hist < 0:
                                    confidence += 5
                                if days_to_cross < 30:
                                    confidence += 10
                                confidence = min(confidence, 85)
        except Exception as e:
            print(f"Prophet forecast error for {ticker}: {e}")
            # Fallback to simple logic if Prophet fails
            gap_pct = abs(current_gap) / current_price * 100 if current_price > 0 else 0
            if gap_pct < 5:
                if current_gap < 0 and 30 <= rsi_value <= 65:
                    has_forecast = True
                    signal = 'BUY_FORECAST'
                    confidence = 65
                elif current_gap > 0 and 35 <= rsi_value <= 75:
                    has_forecast = True
                    signal = 'SELL_FORECAST'
                    confidence = 65
        
        if has_forecast:
            # Calculate additional metrics
            gap_pct = abs(current_gap) / current_price * 100 if current_price > 0 else 0
            
            # Price Rate of Change (30 days)
            if len(data) >= 30:
                price_roc = ((data['Close'].iloc[-1] - data['Close'].iloc[-30]) / data['Close'].iloc[-30]) * 100
            else:
                price_roc = 0.0
            
            # Volume trend
            if len(data) >= 20:
                recent_vol = data['Volume'].iloc[-10:].mean()
                older_vol = data['Volume'].iloc[-20:-10].mean()
                if older_vol > 0:
                    volume_trend = ((recent_vol - older_vol) / older_vol) * 100
                else:
                    volume_trend = 0.0
            else:
                volume_trend = 0.0
            
            # Convergence rate
            if days_to_cross:
                convergence_rate = abs(current_gap) / days_to_cross if days_to_cross > 0 else 0.0
            else:
                convergence_rate = 0.0
            
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
                        "Confidence_%" = :conf,
                        "Days_To_Crossover" = :days,
                        "Gap_%" = :gap,
                        "RSI" = :rsi,
                        "MACD_Histogram" = :macd,
                        "Price_ROC_%" = :roc,
                        "Volume_Trend_%" = :vol,
                        "Convergence_Rate" = :conv
                """)
                
                conn.execute(insert_query, {
                    "ticker": ticker,
                    "date": datetime.now().strftime('%Y-%m-%d'),
                    "signal": signal,
                    "conf": confidence,
                    "days": float(days_to_cross) if days_to_cross else None,
                    "price": float(current_price),
                    "gap": float(gap_pct),
                    "rsi": float(rsi_value),
                    "macd": float(macd_hist),
                    "roc": float(price_roc),
                    "vol": float(volume_trend),
                    "conv": float(convergence_rate)
                })
                
                conn.commit()
            
            return {
                'has_forecast': True,
                'signal': signal,
                'confidence': confidence,
                'days_to_cross': days_to_cross
            }
        
        return {'has_forecast': False}
        
    except Exception as e:
        print(f"Error forecasting {ticker}: {e}")
        return None
