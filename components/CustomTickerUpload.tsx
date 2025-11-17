import { useState, useRef } from 'react';
import { Upload, FileText, X, Loader2, CheckCircle, AlertCircle, TrendingUp, Download } from 'lucide-react';

interface TickerResult {
  ticker: string;
  success: boolean;
  data?: any;
  error?: string;
}

export default function CustomTickerUpload() {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [tickers, setTickers] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<TickerResult[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const parseTickersFromFile = (fileContent: string): string[] => {
    const lines = fileContent.split('\n');
    const parsedTickers: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue; // Skip empty lines and comments
      
      // Handle CSV format (first column)
      if (trimmed.includes(',')) {
        const ticker = trimmed.split(',')[0].trim().toUpperCase();
        if (ticker && /^[A-Z]{1,5}$/.test(ticker)) {
          parsedTickers.push(ticker);
        }
      } else {
        // Handle plain text format (one ticker per line)
        const ticker = trimmed.toUpperCase();
        if (ticker && /^[A-Z]{1,5}$/.test(ticker)) {
          parsedTickers.push(ticker);
        }
      }
    }
    
    return [...new Set(parsedTickers)]; // Remove duplicates
  };

  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setError('');
    setResults([]);
    
    try {
      const text = await selectedFile.text();
      const parsed = parseTickersFromFile(text);
      
      if (parsed.length === 0) {
        setError('No valid tickers found in file. Please ensure the file contains ticker symbols (one per line or CSV format).');
        setFile(null);
        return;
      }
      
      setTickers(parsed);
    } catch (err: any) {
      setError(`Failed to read file: ${err.message}`);
      setFile(null);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      e.currentTarget.classList.add('border-aquamarine-500', 'bg-aquamarine-500/10');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      e.currentTarget.classList.remove('border-aquamarine-500', 'bg-aquamarine-500/10');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    e.currentTarget.classList.remove('border-aquamarine-500', 'bg-aquamarine-500/10');
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const processTickers = async () => {
    if (tickers.length === 0) return;
    
    setIsProcessing(true);
    setResults([]);
    setProgress({ current: 0, total: tickers.length });
    setError('');
    
    try {
      const response = await fetch('/api/bulk-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to process tickers');
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) throw new Error('No response stream available');
      
      const newResults: TickerResult[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.result) {
                newResults.push(data.result);
                setResults([...newResults]);
                setProgress({ current: newResults.length, total: tickers.length });
              }
              
              if (data.error) {
                newResults.push({ ticker: data.ticker || 'Unknown', success: false, error: data.error });
                setResults([...newResults]);
                setProgress({ current: newResults.length, total: tickers.length });
              }
              
              if (data.complete) {
                setIsProcessing(false);
              }
            } catch (parseErr) {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process tickers');
      setIsProcessing(false);
    }
  };

  const exportResults = () => {
    if (results.length === 0) return;
    
    const csv = [
      ['Ticker', 'Status', 'Price', 'Market Cap', 'Volume', 'P/E Ratio', 'Signal', 'Confidence', 'Error'].join(','),
      ...results.map(r => {
        if (r.success && r.data) {
          return [
            r.ticker,
            'Success',
            r.data.price || 'N/A',
            r.data.marketCap || 'N/A',
            r.data.volume || 'N/A',
            r.data.peRatio || 'N/A',
            r.data.forecast?.signal || 'N/A',
            r.data.forecast?.confidence || 'N/A',
            ''
          ].join(',');
        } else {
          return [r.ticker, 'Failed', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', r.error || 'Unknown error'].join(',');
        }
      })
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ticker-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetUpload = () => {
    setFile(null);
    setTickers([]);
    setResults([]);
    setProgress({ current: 0, total: 0 });
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const successfulResults = results.filter(r => r.success);
  const failedResults = results.filter(r => !r.success);

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-3 md:px-4 py-2 bg-gradient-to-r from-aquamarine-600 to-cyan-600 text-white font-medium rounded-lg hover:from-aquamarine-500 hover:to-cyan-500 transition-all shadow-lg shadow-aquamarine-500/30 text-sm md:text-base whitespace-nowrap"
      >
        <Upload size={16} className="md:w-[18px] md:h-[18px]" />
        <span className="hidden sm:inline">Upload Custom Tickers</span>
        <span className="sm:hidden">Upload</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-aquamarine-500/10 rounded-lg">
                  <Upload className="text-aquamarine-400" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Upload Custom Tickers</h3>
                  <p className="text-sm text-gray-400">Upload a file with ticker symbols for bulk analysis</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  resetUpload();
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* File Upload Area */}
              {!file && !isProcessing && (
                <div
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-gray-600 rounded-xl p-12 text-center hover:border-aquamarine-500/50 transition-colors cursor-pointer bg-gray-900/30"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.csv,.tsv"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 bg-aquamarine-500/10 rounded-full">
                      <Upload className="text-aquamarine-400" size={32} />
                    </div>
                    <div>
                      <p className="text-white font-medium mb-1">Drag and drop your file here</p>
                      <p className="text-gray-400 text-sm">or click to browse</p>
                    </div>
                    <p className="text-gray-500 text-xs mt-2">
                      Supports .txt, .csv files. One ticker per line or CSV format.
                    </p>
                  </div>
                </div>
              )}

              {/* File Selected */}
              {file && !isProcessing && results.length === 0 && (
                <div className="space-y-4">
                  <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="text-aquamarine-400" size={24} />
                      <div>
                        <p className="text-white font-medium">{file.name}</p>
                        <p className="text-gray-400 text-sm">
                          {tickers.length} ticker{tickers.length !== 1 ? 's' : ''} found
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={resetUpload}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {tickers.length > 0 && (
                    <div className="bg-gray-900/30 rounded-lg p-4 border border-gray-700">
                      <p className="text-gray-400 text-sm mb-2">Preview (first 10 tickers):</p>
                      <div className="flex flex-wrap gap-2">
                        {tickers.slice(0, 10).map((ticker, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-aquamarine-500/10 text-aquamarine-400 rounded-full text-sm font-mono"
                          >
                            {ticker}
                          </span>
                        ))}
                        {tickers.length > 10 && (
                          <span className="px-3 py-1 text-gray-400 rounded-full text-sm">
                            +{tickers.length - 10} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={processTickers}
                      className="flex-1 bg-gradient-to-r from-aquamarine-600 to-cyan-600 text-white py-3 rounded-lg font-semibold hover:from-aquamarine-500 hover:to-cyan-500 transition-all flex items-center justify-center gap-2"
                    >
                      <TrendingUp size={18} />
                      Analyze {tickers.length} Ticker{tickers.length !== 1 ? 's' : ''}
                    </button>
                    <button
                      onClick={resetUpload}
                      className="px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Processing */}
              {isProcessing && (
                <div className="space-y-4">
                  <div className="bg-gray-900/50 rounded-lg p-6 border border-gray-700">
                    <div className="flex items-center gap-3 mb-4">
                      <Loader2 className="text-aquamarine-400 animate-spin" size={24} />
                      <div className="flex-1">
                        <p className="text-white font-medium">Processing tickers...</p>
                        <p className="text-gray-400 text-sm">
                          {progress.current} of {progress.total} completed
                        </p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-aquamarine-600 to-cyan-600 h-full transition-all duration-300"
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Results */}
              {results.length > 0 && !isProcessing && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-bold text-white mb-1">Analysis Results</h4>
                      <p className="text-sm text-gray-400">
                        {successfulResults.length} successful, {failedResults.length} failed
                      </p>
                    </div>
                    <button
                      onClick={exportResults}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
                    >
                      <Download size={18} />
                      Export CSV
                    </button>
                  </div>

                  {/* Results Table */}
                  <div className="bg-gray-900/30 rounded-lg border border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full">
                        <thead className="bg-gray-800/50 sticky top-0">
                          <tr>
                            <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Ticker</th>
                            <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Status</th>
                            <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Price</th>
                            <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Signal</th>
                            <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Confidence</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {results.map((result, idx) => (
                            <tr key={idx} className="hover:bg-gray-800/30 transition-colors">
                              <td className="py-3 px-4 text-white font-mono">{result.ticker}</td>
                              <td className="py-3 px-4">
                                {result.success ? (
                                  <span className="inline-flex items-center gap-1 text-green-400">
                                    <CheckCircle size={16} />
                                    Success
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-red-400">
                                    <AlertCircle size={16} />
                                    Failed
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-gray-300">
                                {result.success && result.data ? result.data.price : 'N/A'}
                              </td>
                              <td className="py-3 px-4 text-gray-300">
                                {result.success && result.data?.forecast
                                  ? result.data.forecast.signal
                                  : result.error || 'N/A'}
                              </td>
                              <td className="py-3 px-4 text-gray-300">
                                {result.success && result.data?.forecast
                                  ? `${result.data.forecast.confidence}%`
                                  : 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsOpen(false);
                      resetUpload();
                    }}
                    className="w-full bg-gradient-to-r from-aquamarine-600 to-cyan-600 text-white py-3 rounded-lg font-semibold hover:from-aquamarine-500 hover:to-cyan-500 transition-all"
                  >
                    Close
                  </button>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-center gap-3">
                  <AlertCircle className="text-red-400" size={20} />
                  <p className="text-red-400">{error}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

