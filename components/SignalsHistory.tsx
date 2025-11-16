import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Filter } from 'lucide-react';

export default function SignalsHistory() {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchSignals();
  }, []);

  const fetchSignals = async () => {
    try {
      const response = await fetch('/api/signals');
      const data = await response.json();
      setSignals(data);
    } catch (error) {
      console.error('Failed to fetch signals:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSignals = signals.filter((signal: any) => {
    if (filter === 'all') return true;
    return signal.Signal.toLowerCase() === filter;
  });

  return (
    <div className="space-y-6">
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Trade Signals History</h2>
          
          <div className="flex items-center gap-2">
            <Filter className="text-gray-400" size={18} />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-aquamarine-500"
            >
              <option value="all">All Signals</option>
              <option value="buy">Buy Only</option>
              <option value="sell">Sell Only</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-aquamarine-400"></div>
            <p className="text-gray-400 mt-4">Loading signals...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Ticker</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Date</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Signal</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Price</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {filteredSignals.map((signal: any, idx) => (
                  <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-700/30 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-bold text-aquamarine-400">{signal.Ticker}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-300">{signal.Date}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                        signal.Signal === 'Buy' 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {signal.Signal === 'Buy' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {signal.Signal}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-300 font-mono">${signal.Price?.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-700 rounded-full h-2 max-w-[100px]">
                          <div 
                            className="bg-gradient-to-r from-aquamarine-600 to-cyan-600 h-2 rounded-full"
                            style={{ width: `${signal.Confidence_Pct || 0}%` }}
                          ></div>
                        </div>
                        <span className="text-gray-300 text-sm">{signal.Confidence_Pct}%</span>
                      </div>
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