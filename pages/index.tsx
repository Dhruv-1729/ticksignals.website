import { useState, useEffect } from 'react';
import Head from 'next/head';
import { Search, TrendingUp, Activity } from 'lucide-react';
import Layout from '../components/Layout';
import TickerAnalyzer from '../components/TickerAnalyzer';
import SignalsHistory from '../components/SignalsHistory';
import ForecastHistory from '../components/ForecastHistory';
import ManualScanTrigger from '../components/ManualScanTrigger';

export default function Home() {
  const [activeTab, setActiveTab] = useState('analyzer');
  const [activeSignals, setActiveSignals] = useState(0);

  useEffect(() => {
    // Fetch active signals count
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => setActiveSignals(data.activeSignals))
      .catch(err => console.error('Failed to fetch stats:', err));
  }, []);

  const tabs = [
    { id: 'analyzer', label: 'Ticker Analyzer', icon: Search },
    { id: 'signals', label: 'Trade Signals', icon: TrendingUp },
    { id: 'forecast', label: 'Forecasts', icon: Activity },
  ];

  return (
    <>
      <Head>
        <title>TickSignals - Advanced Stock Analysis</title>
        <meta name="description" content="Professional stock market analysis with AI-powered signals" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Layout>
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-aqua-gradient opacity-10"></div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="text-center animate-fade-in">
              <h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-aquamarine-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent mb-8 pb-2">
                TickSignals
              </h1>
            </div>
          </div>
        </div>

        {/* Stats Bar - Centered Single Card */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 mb-12">
          <div className="flex justify-center">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 border border-aquamarine-800/30 hover:border-aquamarine-600/50 transition-all w-full max-w-md">
              <div className="flex items-center justify-center gap-4">
                <div className="p-4 bg-aquamarine-500/10 rounded-lg">
                  <TrendingUp className="text-aquamarine-400" size={32} />
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-base mb-1">Active Signals</p>
                  <p className="text-4xl font-bold text-white">{activeSignals.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-2 inline-flex gap-2 border border-gray-700/50">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-aquamarine-600 text-white shadow-lg shadow-aquamarine-500/50'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="animate-slide-up">
            {activeTab === 'analyzer' && <TickerAnalyzer />}
            {activeTab === 'signals' && <SignalsHistory />}
            {activeTab === 'forecast' && <ForecastHistory />}
          </div>
        </div>

        {/* Manual Scan Trigger */}
        <ManualScanTrigger />
      </Layout>
    </>
  );
}