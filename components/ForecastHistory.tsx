import { useState, useEffect } from 'react';
import { Activity, Star, TrendingUp, TrendingDown } from 'lucide-react';

export default function ForecastHistory() {
  const [forecasts, setForecasts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchForecasts();
  }, []);

  const fetchForecasts = async () => {
    try {
      const response = await fetch('/api/forecasts');
      const data = await response.json();
      setForecasts(data);
    } catch (error) {
      console.error('Failed to fetch forecasts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSignalBadge = (signal: string) => {
    const isStrong = signal.includes('STRONG');
    const isBuy = signal.includes('BUY');
    
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
        isStrong
          ? isBuy
            ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white'
            : 'bg-gradient-to-r from-red-600 to-rose-600 text-white'
          : isBuy
            ? 'bg-green-500/20 text-green-400'
            : 'bg-red-500/20 text-red-400'
      }`}>
        {isStrong && <Star size={14} />}
        {isBuy ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        {signal.replace('_FORECAST', '').replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
        <div className="flex items-center gap-3 mb-6">
          <Activity className="text-aquamarine-400" size={28} />
          <h2 className="text-2xl font-bold text-white">Forecast Signals</h2>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-aquamarine-400"></div>
            <p className="text-gray-400 mt-4">Loading forecasts...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Ticker</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Date</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Forecast</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Confidence</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Days</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Price</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">RSI</th>
                </tr>
              </thead>
              <tbody>
                {forecasts.map((forecast: any, idx) => (
                  <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-700/30 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-bold text-aquamarine-400">{forecast.Ticker}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-300">{forecast.Date}</td>
                    <td className="py-3 px-4">
                      {getSignalBadge(forecast.Forecast_Signal)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-700 rounded-full h-2 max-w-[100px]">
                          <div 
                            className="bg-gradient-to-r from-aquamarine-600 to-cyan-600 h-2 rounded-full"
                            style={{ width: `${forecast['Confidence_%'] || 0}%` }}
                          ></div>
                        </div>
                        <span className="text-gray-300 text-sm font-medium">{forecast['Confidence_%']}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-300">{forecast.Days_To_Crossover?.toFixed(1)}</td>
                    <td className="py-3 px-4 text-gray-300 font-mono">${forecast.Current_Price?.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span className={`text-sm ${
                        forecast.RSI > 70 ? 'text-red-400' :
                        forecast.RSI < 30 ? 'text-green-400' :
                        'text-gray-400'
                      }`}>
                        {forecast.RSI?.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}