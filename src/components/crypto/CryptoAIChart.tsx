'use client';

<<<<<<< HEAD
import { useCallback, useEffect, useRef, useState } from 'react';
=======
import { useEffect, useRef, useState } from 'react';
>>>>>>> origin/master
import {
  createChart,
  CrosshairMode,
  LineStyle,
<<<<<<< HEAD
  type UTCTimestamp,
} from 'lightweight-charts';

import { supabase } from '@/lib/supabase';

interface WatchedSymbol {
  symbol: string;
  interval: string | null;
  candle_limit: number | null;
}

interface CandleData {
  timestamp: number | string;
  symbol: string;
  open: number | string | null;
  high: number | string | null;
  low: number | string | null;
  close: number | string | null;
  volume: number | string | null;

  ema_20?: number | string | null;
  ema_50?: number | string | null;

  bb_lower?: number | string | null;
  bb_upper?: number | string | null;
  bb_middle?: number | string | null;

  rsi?: number | string | null;
  macd?: number | string | null;
  macd_signal?: number | string | null;

  signal?: string | null;
  volume_spike?: boolean | string | number | null;
  rsi_reversal?: boolean | string | number | null;
  reversal_candle?: boolean | string | number | null;
}

interface NormalizedCandle {
  time: UTCTimestamp;
=======
} from 'lightweight-charts';
import { supabase } from '@/lib/supabase';

interface CandleData {
  timestamp: number;
>>>>>>> origin/master
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
<<<<<<< HEAD

  ema_20: number | null;
  ema_50: number | null;

  bb_lower: number | null;
  bb_upper: number | null;
  bb_middle: number | null;

  rsi: number | null;
  macd: number | null;
  macd_signal: number | null;

  signal: string;
  volume_spike: boolean;
  rsi_reversal: boolean;
  reversal_candle: boolean;
}

interface MarkerItem {
  time: UTCTimestamp;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown' | 'circle' | 'square';
  text: string;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const result = Number(value);

  return Number.isFinite(result) ? result : null;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'y'].includes(
      value.trim().toLowerCase(),
    );
  }

  return false;
}

/**
 * Lightweight Charts sử dụng Unix timestamp tính bằng giây.
 * Hỗ trợ timestamp dạng giây, milliseconds hoặc chuỗi ngày ISO.
 */
function toChartTime(
  value: number | string,
): UTCTimestamp | null {
  let seconds: number;

  if (typeof value === 'number') {
    seconds = value > 1_000_000_000_000
      ? Math.floor(value / 1000)
      : Math.floor(value);
  } else {
    const numericValue = Number(value);

    if (value.trim() !== '' && Number.isFinite(numericValue)) {
      seconds = numericValue > 1_000_000_000_000
        ? Math.floor(numericValue / 1000)
        : Math.floor(numericValue);
    } else {
      const milliseconds = Date.parse(value);

      if (!Number.isFinite(milliseconds)) {
        return null;
      }

      seconds = Math.floor(milliseconds / 1000);
    }
  }

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  return seconds as UTCTimestamp;
}

function normalizeCandle(
  row: CandleData,
): NormalizedCandle | null {
  const time = toChartTime(row.timestamp);

  const open = toNumber(row.open);
  const high = toNumber(row.high);
  const low = toNumber(row.low);
  const close = toNumber(row.close);
  const volume = toNumber(row.volume);

  if (
    time === null ||
    open === null ||
    high === null ||
    low === null ||
    close === null
  ) {
    return null;
  }

  if (
    high < low ||
    high < Math.max(open, close) ||
    low > Math.min(open, close)
  ) {
    return null;
  }

  const signal = String(row.signal ?? '').trim().toUpperCase();

  return {
    time,
    symbol: row.symbol,
    open,
    high,
    low,
    close,
    volume: volume ?? 0,

    ema_20: toNumber(row.ema_20),
    ema_50: toNumber(row.ema_50),

    bb_lower: toNumber(row.bb_lower),
    bb_upper: toNumber(row.bb_upper),
    bb_middle: toNumber(row.bb_middle),

    rsi: toNumber(row.rsi),
    macd: toNumber(row.macd),
    macd_signal: toNumber(row.macd_signal),

    signal,
    volume_spike: toBoolean(row.volume_spike),
    rsi_reversal: toBoolean(row.rsi_reversal),
    reversal_candle: toBoolean(row.reversal_candle),
  };
}

function validLineValue(
  time: UTCTimestamp,
  value: number | null,
): { time: UTCTimestamp; value: number } | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return { time, value };
}

export default function CryptoAIChart() {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);

  const [symbols, setSymbols] = useState<WatchedSymbol[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [candles, setCandles] = useState<NormalizedCandle[]>([]);

  const [loadingSymbols, setLoadingSymbols] = useState(true);
  const [loadingCandles, setLoadingCandles] = useState(false);
  const [error, setError] = useState('');

  /*
   * Load danh sách mã đang được theo dõi.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadSymbols() {
      setLoadingSymbols(true);
      setError('');

      try {
        const { data, error: queryError } = await supabase
          .from('watched_symbols')
          .select('symbol, interval, candle_limit')
          .eq('active', true);

        if (queryError) {
          throw queryError;
        }

        const rows = (data ?? []) as WatchedSymbol[];

        if (cancelled) {
          return;
        }

        setSymbols(rows);

        setSelectedSymbol((current) => {
          if (current && rows.some((item) => item.symbol === current)) {
            return current;
          }

          return rows[0]?.symbol ?? '';
        });
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error
              ? err.message
              : 'Không thể tải danh sách mã theo dõi.';

          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoadingSymbols(false);
        }
      }
    }

    void loadSymbols();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Load dữ liệu nến từ training_dataset.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadCandles() {
      if (!selectedSymbol) {
        setCandles([]);
        return;
      }

      setLoadingCandles(true);
      setError('');

      try {
        const selected = symbols.find(
          (item) => item.symbol === selectedSymbol,
        );

        const limit = Math.min(
          Math.max(
            Number(selected?.candle_limit) || 500,
            1,
          ),
          5000,
        );

        const { data, error: queryError } = await supabase
          .from('training_dataset')
          .select('*')
          .eq('symbol', selectedSymbol)
          .order('timestamp', { ascending: false })
          .limit(limit);

        if (queryError) {
          throw queryError;
        }

        const normalized = ((data ?? []) as CandleData[])
          .map(normalizeCandle)
          .filter(
            (item): item is NormalizedCandle => item !== null,
          );

        /*
         * Query lấy dữ liệu mới nhất trước.
         * Đảo lại để biểu đồ nhận dữ liệu theo thứ tự thời gian tăng dần.
         */
        normalized.sort(
          (a, b) => Number(a.time) - Number(b.time),
        );

        /*
         * Loại timestamp trùng để tránh lỗi dữ liệu biểu đồ.
         */
        const unique = new Map<number, NormalizedCandle>();

        for (const item of normalized) {
          unique.set(Number(item.time), item);
        }

        const result = Array.from(unique.values()).sort(
          (a, b) => Number(a.time) - Number(b.time),
        );

        if (!cancelled) {
          setCandles(result);

          if (result.length === 0) {
            setError(
              `Không tìm thấy dữ liệu nến hợp lệ cho ${selectedSymbol}.`,
            );
          }
        }
      } catch (err) {
        if (!cancelled) {
          setCandles([]);

          const message =
            err instanceof Error
              ? err.message
              : 'Không thể tải dữ liệu biểu đồ.';

          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoadingCandles(false);
        }
      }
    }

    void loadCandles();

    return () => {
      cancelled = true;
    };
  }, [selectedSymbol, symbols]);

  /*
   * Khởi tạo biểu đồ bằng API Lightweight Charts 3.8.0.
   */
  useEffect(() => {
    const container = chartContainerRef.current;

    if (!container) {
      return;
    }

    const chart = createChart(container, {
      width: container.clientWidth || 800,
      height: 600,

      layout: {
        backgroundColor: '#0f172a',
        textColor: '#cbd5e1',
        fontSize: 12,
      },

      grid: {
        vertLines: {
          color: '#1e293b',
        },
        horzLines: {
          color: '#1e293b',
        },
      },

      crosshair: {
        mode: CrosshairMode.Normal,
      },

      rightPriceScale: {
        borderColor: '#334155',
      },

      timeScale: {
        borderColor: '#334155',
        timeVisible: true,
        secondsVisible: false,
      },

      localization: {
        locale: 'vi-VN',
      },
    });

    chartRef.current = chart;

    /*
     * Nến giá.
     */
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    /*
     * EMA20 và EMA50.
     */
    const ema20Series = chart.addLineSeries({
      color: '#38bdf8',
      lineWidth: 2,
      title: 'EMA20',
      lastValueVisible: true,
      priceLineVisible: false,
    });

    const ema50Series = chart.addLineSeries({
      color: '#f59e0b',
      lineWidth: 2,
      title: 'EMA50',
      lastValueVisible: true,
      priceLineVisible: false,
    });

    /*
     * Bollinger Bands.
     */
    const bbUpperSeries = chart.addLineSeries({
      color: '#a78bfa',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: 'BB Upper',
      priceLineVisible: false,
    });

    const bbMiddleSeries = chart.addLineSeries({
      color: '#818cf8',
      lineWidth: 1,
      title: 'BB Middle',
      priceLineVisible: false,
    });

    const bbLowerSeries = chart.addLineSeries({
      color: '#a78bfa',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: 'BB Lower',
      priceLineVisible: false,
    });

    /*
     * Volume dùng price scale riêng.
     */
    const volumeSeries = chart.addHistogramSeries({
      priceScaleId: 'volume',
      priceFormat: {
        type: 'volume',
      },
      lastValueVisible: false,
      priceLineVisible: false,
    });

    /*
     * RSI dùng custom price scale.
     */
    const rsiSeries = chart.addLineSeries({
      priceScaleId: 'rsi',
      color: '#e879f9',
      lineWidth: 2,
      title: 'RSI',
      lastValueVisible: true,
      priceLineVisible: false,
    });

    /*
     * MACD và MACD Signal dùng chung một custom price scale.
     */
    const macdSeries = chart.addLineSeries({
      priceScaleId: 'macd',
      color: '#38bdf8',
      lineWidth: 2,
      title: 'MACD',
      lastValueVisible: true,
      priceLineVisible: false,
    });

    const macdSignalSeries = chart.addLineSeries({
      priceScaleId: 'macd',
      color: '#fb923c',
      lineWidth: 2,
      title: 'MACD Signal',
      lastValueVisible: true,
      priceLineVisible: false,
    });

    /*
     * Cấu hình các price scale sau khi series đã được tạo.
     */
    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chart.priceScale('rsi').applyOptions({
      scaleMargins: {
        top: 0.75,
        bottom: 0.1,
      },
    });

    chart.priceScale('macd').applyOptions({
      scaleMargins: {
        top: 0.75,
        bottom: 0.1,
      },
    });

    /*
     * Lưu series để cập nhật dữ liệu khi đổi mã.
     */
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      chart.applyOptions({
        width: Math.max(1, Math.floor(entry.contentRect.width)),
      });
    });

    resizeObserver.observe(container);

    /*
     * Lưu API series trên chart object để effect dữ liệu bên dưới
     * có thể truy cập mà không phải tạo lại biểu đồ.
     */
    (
      chart as unknown as {
        __cryptoSeries?: Record<string, unknown>;
      }
    ).__cryptoSeries = {
      candleSeries,
      ema20Series,
      ema50Series,
      bbUpperSeries,
      bbMiddleSeries,
      bbLowerSeries,
      volumeSeries,
      rsiSeries,
      macdSeries,
      macdSignalSeries,
    };

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  /*
   * Cập nhật dữ liệu khi tải xong hoặc đổi mã.
   */
  const updateChart = useCallback(() => {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    const series = (
      chart as unknown as {
        __cryptoSeries?: Record<string, any>;
      }
    ).__cryptoSeries;

    if (!series) {
      return;
    }

    const {
      candleSeries,
      ema20Series,
      ema50Series,
      bbUpperSeries,
      bbMiddleSeries,
      bbLowerSeries,
      volumeSeries,
      rsiSeries,
      macdSeries,
      macdSignalSeries,
    } = series;

    const candleData = candles.map((item) => ({
      time: item.time,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
    }));

    candleSeries.setData(candleData);

    ema20Series.setData(
      candles
        .map((item) => validLineValue(item.time, item.ema_20))
        .filter(Boolean),
    );

    ema50Series.setData(
      candles
        .map((item) => validLineValue(item.time, item.ema_50))
        .filter(Boolean),
    );

    bbUpperSeries.setData(
      candles
        .map((item) => validLineValue(item.time, item.bb_upper))
        .filter(Boolean),
    );

    bbMiddleSeries.setData(
      candles
        .map((item) => validLineValue(item.time, item.bb_middle))
        .filter(Boolean),
    );

    bbLowerSeries.setData(
      candles
        .map((item) => validLineValue(item.time, item.bb_lower))
        .filter(Boolean),
    );

    volumeSeries.setData(
      candles.map((item) => ({
        time: item.time,
        value: item.volume,
        color:
          item.close >= item.open
            ? 'rgba(34, 197, 94, 0.55)'
            : 'rgba(239, 68, 68, 0.55)',
      })),
    );

    rsiSeries.setData(
      candles
        .map((item) => validLineValue(item.time, item.rsi))
        .filter(Boolean),
    );

    macdSeries.setData(
      candles
        .map((item) => validLineValue(item.time, item.macd))
        .filter(Boolean),
    );

    macdSignalSeries.setData(
      candles
        .map((item) =>
          validLineValue(item.time, item.macd_signal),
        )
        .filter(Boolean),
    );

    /*
     * Tạo marker cho tín hiệu giao dịch.
     */
    const markers: MarkerItem[] = [];

    for (const item of candles) {
      if (item.signal === 'BUY') {
        markers.push({
          time: item.time,
          position: 'belowBar',
          color: '#22c55e',
          shape: 'arrowUp',
          text: 'BUY',
        });
      }

      if (item.signal === 'SELL') {
        markers.push({
          time: item.time,
          position: 'aboveBar',
          color: '#ef4444',
          shape: 'arrowDown',
          text: 'SELL',
        });
      }

      if (item.volume_spike) {
        markers.push({
          time: item.time,
          position: 'aboveBar',
          color: '#f59e0b',
          shape: 'circle',
          text: 'VOL',
        });
      }

      if (item.rsi_reversal || item.reversal_candle) {
        markers.push({
          time: item.time,
          position:
            item.close >= item.open
              ? 'belowBar'
              : 'aboveBar',
          color: '#a78bfa',
          shape: 'square',
          text: 'REV',
        });
      }
    }

    markers.sort(
      (a, b) => Number(a.time) - Number(b.time),
    );

    /*
     * Lightweight Charts 3.8.0 hỗ trợ setMarkers trên series.
     */
    candleSeries.setMarkers(markers);

    chart.timeScale().fitContent();
  }, [candles]);

  useEffect(() => {
    updateChart();
  }, [updateChart]);

  const selectedConfig = symbols.find(
    (item) => item.symbol === selectedSymbol,
  );

  return (
    <section className="rounded-xl bg-slate-900 p-4 text-white">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            Crypto AI Chart
          </h2>

          <p className="text-sm text-slate-400">
            {selectedSymbol || 'Chưa chọn mã'}
            {selectedConfig?.interval
              ? ` · ${selectedConfig.interval}`
              : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedSymbol}
            onChange={(event) => {
              setSelectedSymbol(event.target.value);
            }}
            disabled={loadingSymbols || symbols.length === 0}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            aria-label="Chọn mã giao dịch"
          >
            {symbols.length === 0 && (
              <option value="">
                Không có mã đang theo dõi
              </option>
            )}

            {symbols.map((item) => (
              <option key={item.symbol} value={item.symbol}>
                {item.symbol}
              </option>
            ))}
          </select>

          {(loadingSymbols || loadingCandles) && (
            <span className="text-sm text-blue-400">
              Đang tải...
            </span>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      {!loadingCandles && candles.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded bg-slate-800 px-2 py-1 text-sky-300">
            EMA20
          </span>

          <span className="rounded bg-slate-800 px-2 py-1 text-amber-300">
            EMA50
          </span>

          <span className="rounded bg-slate-800 px-2 py-1 text-violet-300">
            Bollinger Bands
          </span>

          <span className="rounded bg-slate-800 px-2 py-1 text-green-300">
            BUY
          </span>

          <span className="rounded bg-slate-800 px-2 py-1 text-red-300">
            SELL
          </span>
        </div>
      )}

      <div
        ref={chartContainerRef}
        className="w-full"
        style={{
          width: '100%',
          height: 600,
          minWidth: 0,
        }}
      />

      <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-slate-400">
        <span>
          Số nến: {candles.length}
        </span>

        <span>
          {candles.length > 0
            ? `Cập nhật theo dữ liệu ${selectedSymbol}`
            : 'Chưa có dữ liệu biểu đồ'}
        </span>
      </div>
    </section>
  );
}
=======
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
>>>>>>> origin/master
