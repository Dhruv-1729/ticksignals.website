from flask import Flask, request, jsonify
import yfinance as yf
import datetime
import json

app = Flask(__name__)

# Vercel will route requests to /api/analyze to this function
@app.route('/api/analyze', methods=['POST'])
def analyze():
    try:
        # Get ticker from the JSON body
        body = request.get_json()
        ticker = body.get('ticker')

        if not ticker:
            return jsonify({"error": "Ticker is required"}), 400

        # --- Real Data Fetching ---
        
        # 1. Get quote data
        stock = yf.Ticker(ticker)
        quote = stock.info

        # 2. Get 1 year of chart data
        one_year_ago = (datetime.datetime.now() - datetime.timedelta(days=365)).strftime('%Y-%m-%d')
        chart_data = stock.history(start=one_year_ago, interval='1d')

        # 3. Format data for Plotly
        # Reset index to get 'Date' as a column
        chart_data_reset = chart_data.reset_index()
        chart_x = chart_data_reset['Date'].dt.strftime('%Y-%m-%d').tolist()
        chart_y = chart_data_reset['Close'].tolist()

        # 4. Create the response object
        real_data = {
            "ticker": quote.get('symbol'),
            "price": f"${quote.get('regularMarketPrice', 0):.2f}",
            "marketCap": f"{quote.get('marketCap', 0):,}",
            "volume": f"{quote.get('regularMarketVolume', 0):,}",
            "peRatio": f"{quote.get('trailingPE', 'N/A'):.2f}" if quote.get('trailingPE') else "N/A",
            "chart": {
                "data": [
                    {
                        "x": chart_x,
                        "y": chart_y,
                        "type": "scatter",
                        "mode": "lines",
                        "name": "Price",
                        "line": {"color": "#14b8a6"} # aquamarine
                    }
                ],
                "layout": {
                    "title": f"{quote.get('longName', ticker)} Price Chart",
                    "xaxis": {"title": "Date"},
                    "yaxis": {"title": "Price (USD)"},
                    "autosize": True
                }
            },
            # You can add your real forecast/signal logic here
            "forecast": None, 
            "signals": []
        }
        
        # --- End Real Data Fetching ---

        return jsonify(real_data), 200

    except Exception as e:
        print(f"Error: {e}") # For Vercel logs
        return jsonify({"error": str(e)}), 500

# This is the entry point for Vercel
if __name__ == '__main__':
    app.run(debug=True)