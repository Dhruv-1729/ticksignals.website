import { useState } from 'react';
import { Play, Lock, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import crypto from 'crypto-js';

export default function ManualScanTrigger() {
  const [isOpen, setIsOpen] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentTask, setCurrentTask] = useState<'mass' | 'forecast' | null>(null);

  const CORRECT_PASSWORD_HASH = 'ea4de091b760a4e538140c342585130649e646c54d4939ae7f142bb81d5506fa'; 

  const handleButtonClick = () => {
    if (!isAuthenticated) {
      setShowPasswordPrompt(true);
    } else {
      setIsOpen(!isOpen);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hashedPassword = crypto.SHA256(password).toString();
    
    if (hashedPassword === CORRECT_PASSWORD_HASH) {
      setIsAuthenticated(true);
      setShowPasswordPrompt(false);
      setIsOpen(true);
      setPassword('');
      setError('');
    } else {
      setError('Incorrect password');
      setPassword('');
    }
  };

  const runScan = async (type: 'mass' | 'forecast') => {
    setCurrentTask(type);
    setIsRunning(true);
    setLogs([]);
    
    try {
      const response = await fetch('/api/manual-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanType: type }),
      });

      if (!response.ok) throw new Error('Scan failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No reader available');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (data.log) {
              setLogs(prev => [...prev, data.log]);
            }
            if (data.complete) {
              setLogs(prev => [...prev, '✅ Scan complete! Data synced to database.']);
            }
          }
        }
      }
    } catch (err: any) {
      setLogs(prev => [...prev, `❌ Error: ${err.message}`]);
    } finally {
      setIsRunning(false);
      setCurrentTask(null);
    }
  };

  return (
    <>
      {/* Main Trigger Button */}
      <button
        onClick={handleButtonClick}
        className="fixed bottom-6 right-6 z-50 bg-gray-900 text-orange-500 px-6 py-3 rounded-lg font-semibold shadow-lg border-2 border-orange-500/30 hover:border-orange-500 hover:shadow-orange-500/20 transition-all flex items-center gap-2"
      >
        <Play size={18} />
        Manual Scan Trigger
      </button>

      {/* Password Prompt Modal */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 max-w-md w-full mx-4 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Lock className="text-orange-500" size={24} />
                <h3 className="text-xl font-bold text-white">Authentication Required</h3>
              </div>
              <button
                onClick={() => {
                  setShowPasswordPrompt(false);
                  setError('');
                  setPassword('');
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Enter Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="••••••••"
                  autoFocus
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-orange-600 to-orange-500 text-white py-3 rounded-lg font-semibold hover:from-orange-500 hover:to-orange-400 transition-all"
              >
                Unlock
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Scan Menu */}
      {isOpen && isAuthenticated && (
        <div className="fixed bottom-6 right-6 z-40 w-[440px] h-[316px] bg-gray-800/95 backdrop-blur-sm rounded-xl border border-gray-700 shadow-2xl animate-slide-up overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h3 className="text-lg font-bold text-white">Manual Scan Control</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          {!isRunning && logs.length === 0 ? (
            <div className="flex-1 p-4 space-y-3">
              <button
                onClick={() => runScan('mass')}
                className="w-full bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg p-4 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-aquamarine-500/10 rounded-lg group-hover:bg-aquamarine-500/20 transition-colors">
                    <Play className="text-aquamarine-400" size={20} />
                  </div>
                  <div className="text-left">
                    <h4 className="font-semibold text-white">Mass Run</h4>
                    <p className="text-sm text-gray-400">Process all tickers and generate signals</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => runScan('forecast')}
                className="w-full bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg p-4 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-cyan-500/10 rounded-lg group-hover:bg-cyan-500/20 transition-colors">
                    <Play className="text-cyan-400" size={20} />
                  </div>
                  <div className="text-left">
                    <h4 className="font-semibold text-white">Forecast Run</h4>
                    <p className="text-sm text-gray-400">Generate predictive forecast signals</p>
                  </div>
                </div>
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Running Status */}
              <div className="p-4 border-b border-gray-700 bg-gray-900/50">
                <div className="flex items-center gap-3">
                  {isRunning ? (
                    <Loader2 className="text-orange-500 animate-spin" size={20} />
                  ) : (
                    <CheckCircle className="text-green-500" size={20} />
                  )}
                  <div>
                    <p className="font-semibold text-white">
                      {isRunning ? `Running ${currentTask === 'mass' ? 'Mass' : 'Forecast'} Scan...` : 'Scan Complete'}
                    </p>
                    <p className="text-sm text-gray-400">
                      {isRunning ? 'This may take several minutes' : 'All data has been synced'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Logs */}
              <div className="flex-1 overflow-y-auto p-4 bg-gray-900/30 font-mono text-xs space-y-1">
                {logs.map((log, idx) => (
                  <div key={idx} className="text-gray-300 whitespace-pre-wrap">
                    {log}
                  </div>
                ))}
                {isRunning && <div className="text-orange-500 animate-pulse">▊</div>}
              </div>

              {/* Close Button */}
              {!isRunning && (
                <div className="p-4 border-t border-gray-700">
                  <button
                    onClick={() => {
                      setLogs([]);
                      setCurrentTask(null);
                    }}
                    className="w-full bg-gradient-to-r from-aquamarine-600 to-cyan-600 text-white py-2 rounded-lg font-semibold hover:from-aquamarine-500 hover:to-cyan-500 transition-all"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}