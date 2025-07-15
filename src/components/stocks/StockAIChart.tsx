'use client'

import { useEffect, useRef } from 'react'
import {
  createChart,
  CrosshairMode,
  type ISeriesApi,
  type SeriesMarker,
  type SeriesMarkerPosition,
  type SeriesMarkerShape,
  type Time,
} from 'lightweight-charts'
import { supabase } from '@/lib/supabase'

export default function StockAIChart({ symbol }: { symbol: string }) {
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!chartRef.current) return

    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: 500,
      layout: {
        background: { color: '#0f172a' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#334155' },
        horzLines: { color: '#334155' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        scaleMargins: { top: 0.1, bottom: 0.3 },
      },
      timeScale: {
        borderColor: '#334155',
        timeVisible: true,
      },
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#16a34a',
      downColor: '#dc2626',
      borderUpColor: '#16a34a',
      borderDownColor: '#dc2626',
      wickUpColor: '#16a34a',
      wickDownColor: '#dc2626',
    })

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      scaleMargins: { top: 0.8, bottom: 0 },
    })

    const ma20Series = chart.addLineSeries({
      color: '#facc15',
      lineWidth: 2,
      priceScaleId: 'right',
    })

    const rsiSeries = chart.addLineSeries({
      color: '#60a5fa',
      lineWidth: 1,
      priceScaleId: 'left',
    })

    const fetchChartData = async () => {
      const { data, error } = await supabase
        .from('ai_signals')
        .select('date, close, volume, ma20, rsi, ai_recommendation')
        .eq('symbol', symbol.toUpperCase())
        .order('date', { ascending: true })

      if (error || !data || data.length === 0) return console.error('Không có dữ liệu:', error)

      const candles = data.map((item) => ({
        time: item.date,
        open: item.close - 0.5,
        high: item.close + 0.5,
        low: item.close - 0.5,
        close: item.close,
      }))

      const volumes = data.map((item) => ({
        time: item.date,
        value: item.volume,
        color: item.volume > 2 * averageVolume(data) ? '#f97316' : '#64748b',
      }))

      const ma20 = data.map((item) => ({
        time: item.date,
        value: item.ma20,
      }))

      const rsi = data.map((item) => ({
        time: item.date,
        value: item.rsi,
      }))

      const markers: SeriesMarker<Time>[] = data
        .filter((item) => item.ai_recommendation === 'buy' || item.ai_recommendation === 'sell')
        .map((item) => ({
          time: item.date,
          position: (item.ai_recommendation === 'buy' ? 'belowBar' : 'aboveBar') as SeriesMarkerPosition,
          color: item.ai_recommendation === 'buy' ? '#22c55e' : '#ef4444',
          shape: (item.ai_recommendation === 'buy' ? 'arrowUp' : 'arrowDown') as SeriesMarkerShape,
          text: `🤖 ${item.ai_recommendation.toUpperCase()}`,
        }))

      candleSeries.setData(candles)
      volumeSeries.setData(volumes)
      ma20Series.setData(ma20)
      rsiSeries.setData(rsi)
      candleSeries.setMarkers(markers)
    }

    fetchChartData()
    return () => chart.remove()
  }, [symbol])

  return (
    <div className="w-full rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl">
      <div ref={chartRef} className="w-full h-[500px]" />
    </div>
  )
}

function averageVolume(data: { volume: number }[]): number {
  const sum = data.reduce((acc, d) => acc + d.volume, 0)
  return sum / data.length
}
