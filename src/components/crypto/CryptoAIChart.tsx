'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts';
import { supabase } from '@/lib/supabase';

interface CandleData {
  timestamp: number;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ema_20: number;
  ema_50: number;
  bb_lower: number;
  bb_upper: number;
  bb_middle: number;
  rsi: number;
  macd: number;
  macd_signal: number;
  signal: number;
  volume_spike: boolean;
  rsi_reversal: number;
  reversal_candle: number;
}

interface WatchedSymbol {
  symbol: string;
  interval: string;
  candle_limit: number;
}

export default function CryptoAIChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const [symbols, setSymbols] = useState<WatchedSymbol[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [symbolMap, setSymbolMap] = useState<Record<string, WatchedSymbol>>({});
  const [loading, setLoading] = useState(true);

  const [showIndicators, setShowIndicators] = useState({
    ema: true,
    bb: true,
    rsi: true,
    macd: true,
  });

  useEffect(() => {
    const fetchSymbols = async () => {
      const { data, error } = await supabase
        .from('watched_symbols')
        .select('symbol, interval, candle_limit')
        .eq('active', true);

      if (error) return console.error('Lỗi fetch symbols:', error);
      if (!data || data.length === 0) return;

      const map = Object.fromEntries(data.map((s) => [s.symbol, s]));
      setSymbolMap(map);
      setSymbols(data);
      setSelectedSymbol(data[0].symbol);
    };
    fetchSymbols();
  }, []);

  useEffect(() => {
    if (!selectedSymbol || !symbolMap[selectedSymbol]) return;
    const fetchData = async () => {
      setLoading(true);
      const s = symbolMap[selectedSymbol];
      const intervalMin = parseInt(s.interval) || 15;
      const from = Math.floor(Date.now() / 1000) - s.candle_limit * intervalMin * 60;

      const { data, error } = await supabase
        .from('training_dataset')
        .select('*')
        .eq('symbol', s.symbol)
        .gte('timestamp', from)
        .order('timestamp');

      if (error || !data) return console.error('Lỗi fetch data:', error);

      const normalized = data.map((d: any) => ({
        ...d,
        open: parseFloat(d.open),
        high: parseFloat(d.high),
        low: parseFloat(d.low),
        close: parseFloat(d.close),
        volume: parseFloat(d.volume),
        timestamp: Math.floor(Number(d.timestamp))
      })).filter(d => !isNaN(d.open) && !isNaN(d.high) && !isNaN(d.low) && !isNaN(d.close));

      drawChart(normalized);
      setLoading(false);
    };
    fetchData();
  }, [selectedSymbol, symbolMap, showIndicators]);

  const drawChart = (data: CandleData[]) => {
    if (!chartContainerRef.current) return;
    chartContainerRef.current.innerHTML = '';
    chartRef.current?.remove();

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 600,
      layout: { background: { color: '#0f172a' }, textColor: '#cbd5e1' },
      grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#334155', alignLabels: true, autoScale: true, scaleMargins: { top: 0.05, bottom: 0.25 } },
      timeScale: { borderColor: '#334155', timeVisible: true },
    });
    chartRef.current = chart;

    const candles = data.map(d => ({ time: d.timestamp, open: d.open, high: d.high, low: d.low, close: d.close }));
    const volumes = data.map(d => ({ time: d.timestamp, value: d.volume, color: d.close > d.open ? '#22c55e' : '#ef4444' }));

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e', downColor: '#ef4444',
      borderUpColor: '#22c55e', borderDownColor: '#ef4444',
      wickUpColor: '#22c55e', wickDownColor: '#ef4444',
    });
    candleSeries.setData(candles);

    chart.addPriceScale('volume', { scaleMargins: { top: 0.85, bottom: 0 } });
    chart.addHistogramSeries({
      priceScaleId: 'volume',
      color: '#94a3b8',
      priceFormat: { type: 'volume' },
      scaleMargins: { top: 0.8, bottom: 0 },
    }).setData(volumes);

    if (showIndicators.ema) {
      chart.addLineSeries({ color: '#38bdf8', lineWidth: 2 }).setData(data.map(d => ({ time: d.timestamp, value: d.ema_20 })));
      chart.addLineSeries({ color: '#facc15', lineWidth: 2 }).setData(data.map(d => ({ time: d.timestamp, value: d.ema_50 })));
    }

    if (showIndicators.bb) {
      chart.addLineSeries({ color: '#f87171', lineWidth: 1, lineStyle: LineStyle.Dotted }).setData(data.map(d => ({ time: d.timestamp, value: d.bb_upper })));
      chart.addLineSeries({ color: '#4ade80', lineWidth: 1, lineStyle: LineStyle.Dotted }).setData(data.map(d => ({ time: d.timestamp, value: d.bb_lower })));
    }

    if (showIndicators.rsi) {
      chart.addPriceScale('rsi', { scaleMargins: { top: 0.25, bottom: 0.15 } });
      chart.addLineSeries({ color: '#e879f9', lineWidth: 2, priceScaleId: 'rsi' })
        .setData(data.map(d => ({ time: d.timestamp, value: d.rsi })));
    }

    if (showIndicators.macd) {
      chart.addPriceScale('macd', { scaleMargins: { top: 0.15, bottom: 0.05 } });
      chart.addLineSeries({ color: '#f472b6', lineWidth: 2, priceScaleId: 'macd' })
        .setData(data.map(d => ({ time: d.timestamp, value: d.macd })));
      chart.addLineSeries({ color: '#60a5fa', lineWidth: 2, lineStyle: LineStyle.Dashed, priceScaleId: 'macd' })
        .setData(data.map(d => ({ time: d.timestamp, value: d.macd_signal })));
    }

    candleSeries.setMarkers([
      ...data.filter(d => d.signal === 1).map(d => ({ time: d.timestamp, position: 'belowBar', color: '#22c55e', shape: 'arrowUp', text: 'BUY' })),
      ...data.filter(d => d.signal === -1).map(d => ({ time: d.timestamp, position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', text: 'SELL' })),
      ...data.filter(d => d.volume_spike).map(d => ({ time: d.timestamp, position: 'aboveBar', color: '#0ea5e9', shape: 'circle', text: 'Spike' })),
      ...data.filter(d => d.reversal_candle).map(d => ({ time: d.timestamp, position: 'aboveBar', color: '#f43f5e', shape: 'circle', text: 'Reversal' })),
    ]);

    chart.timeScale().fitContent();
    window.addEventListener('resize', () => {
      chart.applyOptions({ width: chartContainerRef.current?.clientWidth || 600 });
    });
  };

  return (
    <div className="bg-slate-900 p-4 rounded-xl text-white">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold">📈 Crypto AI Chart {selectedSymbol && `(${selectedSymbol})`}</h2>
          <select
            className="mt-1 bg-slate-800 border border-slate-600 px-2 py-1 rounded text-white"
            value={selectedSymbol ?? ''}
            onChange={(e) => setSelectedSymbol(e.target.value)}
          >
            {symbols.map((s) => (
              <option key={s.symbol} value={s.symbol}>{s.symbol}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {['ema', 'bb', 'rsi', 'macd'].map(indicator => (
            <label key={indicator}>
              <input
                type="checkbox"
                checked={showIndicators[indicator as keyof typeof showIndicators]}
                onChange={() =>
                  setShowIndicators(prev => ({
                    ...prev,
                    [indicator]: !prev[indicator as keyof typeof showIndicators],
                  }))
                }
              /> {indicator.toUpperCase()}
            </label>
          ))}
        </div>
      </div>
      {loading ? (
        <p>Đang tải dữ liệu...</p>
      ) : (
        <div ref={chartContainerRef} style={{ width: '100%', height: 600 }} />
      )}
    </div>
  );
}
