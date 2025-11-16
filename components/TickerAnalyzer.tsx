import { useState } from 'react';
import { Search, TrendingUp, TrendingDown, DollarSign, Activity, AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

export default function TickerAnalyzer() {
  const [ticker, setTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [stockData, setStockData] = useState<any>(null);
  const [error, setError] = useState('');

  const analyzeStock = async () => {
    if (!ticker) return;
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: ticker.toUpperCase() }),
      });
      
      if (!response.ok) throw new Error('Failed to analyze stock');
      
      const data = await response.json();
      setStockData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze stock');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === 'Enter' && analyzeStock()}
              placeholder="Enter ticker symbol"
              className="w-full bg-gray-900/50 border border-gray-700 rounded-lg pl-12 pr-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-aquamarine-500 focus:border-transparent transition-all"
            />
          </div>
          <button
            onClick={analyzeStock}
            disabled={loading || !ticker}
            className="px-8 py-4 bg-gradient-to-r from-aquamarine-600 to-cyan-600 text-white font-medium rounded-lg hover:from-aquamarine-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-aquamarine-500/30"
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="text-red-400" size={20} />
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Stock Info Cards */}
      {stockData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <DollarSign size={16} />
                <span>Last Price</span>
              </div>
              <p className="text-2xl font-bold text-white">{stockData.price}</p>
            </div>
            
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <Activity size={16} />
                <span>Market Cap</span>
              </div>
              <p className="text-2xl font-bold text-white">{stockData.marketCap}</p>
            </div>
            
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <TrendingUp size={16} />
                <span>Volume</span>
              </div>
              <p className="text-2xl font-bold text-white">{stockData.volume}</p>
            </div>
            
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <TrendingDown size={16} />
                <span>P/E Ratio</span>
              </div>
              <p className="text-2xl font-bold text-white">{stockData.peRatio}</p>
            </div>
          </div>

          {/* Chart - Full Width, Better Display */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
            <h3 className="text-xl font-bold text-white mb-4">Price Chart</h3>
            <div className="bg-gray-900/50 rounded-lg p-2 -mx-2">
              <Plot
                data={stockData.chart.data}
                layout={{
                  ...stockData.chart.layout,
                  paper_bgcolor: 'rgba(17, 24, 39, 0)',
                  plot_bgcolor: 'rgba(17, 24, 39, 0)',
                  font: { color: '#9CA3AF', family: 'Inter, sans-serif', size: 12 },
                  xaxis: {
                    ...stockData.chart.layout?.xaxis,
                    gridcolor: '#374151',
                    showgrid: true,
                    zeroline: false,
                    showspikes: true,
                    spikecolor: '#9CA3AF',
                    spikethickness: 1,
                    spikemode: 'across',
                    spikedash: 'solid',
                  },
                  yaxis: {
                    ...stockData.chart.layout?.yaxis,
                    gridcolor: '#374151',
                    showgrid: true,
                    zeroline: false,
                    showspikes: true,
                    spikecolor: '#9CA3AF',
                    spikethickness: 1,
                    spikemode: 'across',
                    spikedash: 'solid',
                  },
                  margin: { l: 60, r: 30, t: 30, b: 60 },
                  hovermode: 'x unified',
                  dragmode: 'pan',
                  hoverlabel: {
                    bgcolor: 'rgba(17, 24, 39, 0.95)',
                    bordercolor: '#14b8a6',
                    font: { color: '#F3F4F6', family: 'Inter, sans-serif', size: 11 },
                    align: 'left',
                    namelength: -1,
                  },
                  showlegend: false,
                }}
                config={{ 
                  responsive: true,
                  displayModeBar: true,
                  displaylogo: false,
                  modeBarButtonsToRemove: ['lasso2d', 'select2d'],
                  scrollZoom: true,
                  doubleClick: 'reset',
                }}
                style={{ width: '100%', height: '500px' }}
              />
            </div>
          </div>

          {/* Forecast Analysis - Only if exists and recent */}
          {stockData.forecast && stockData.forecast.isRecent && (
            <div className="bg-gradient-to-br from-aquamarine-500/10 to-cyan-500/10 rounded-xl p-6 border border-aquamarine-500/30 relative">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Activity className="text-aquamarine-400" size={24} />
                  Forecast Analysis
                </h3>
                {stockData.forecast.date && (
                  <p className="text-gray-400 text-sm">
                    {new Date(stockData.forecast.date).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-gray-300">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Signal</p>
                  <p className="font-bold text-lg text-aquamarine-400">{stockData.forecast.signal}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Confidence</p>
                  <p className="font-bold text-lg">{stockData.forecast.confidence}%</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Days to Crossover</p>
                  <p className="font-bold text-lg">{stockData.forecast.days}</p>
                </div>
              </div>
            </div>
          )}

          {/* Recent Signals Table */}
          {stockData.signals && stockData.signals.length > 0 && (
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
              <h3 className="text-xl font-bold text-white mb-4">Recent Signals</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Date</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Type</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockData.signals.map((signal: any, idx: number) => (
                      <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-700/30 transition-colors">
                        <td className="py-3 px-4 text-gray-300">{new Date(signal.Date).toLocaleDateString()}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                            signal.type.includes('Buy') 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {signal.type.includes('Buy') ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            {signal.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-300 font-mono">{signal.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}