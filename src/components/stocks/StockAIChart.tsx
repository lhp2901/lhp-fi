'use client'

import { useEffect, useRef, useState } from 'react'
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
import { format, subDays } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'

export default function StockAIChart({ symbol }: { symbol: string }) {
  const chartRef = useRef<HTMLDivElement>(null)
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 180), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [showHammer, setShowHammer] = useState(true)
  const [showShark, setShowShark] = useState(true)
  const [showAI, setShowAI] = useState(true)
  
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
      rightOffset: 5,        // Giảm lại, không đẩy chart về phải quá
      barSpacing: 8,         // Giãn/cô khoảng cách giữa các nến
      fixLeftEdge: true,     // ⚠️ Bám sát bên trái
      lockVisibleTimeRangeOnResize: true,
      rightBarStaysOnScroll: true,
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
      color: '#eef2f7ff',
      lineWidth: 2,
      priceScaleId: 'rsi-scale',
      lineStyle: 0,
      lastValueVisible: false,
      priceLineVisible: false,
    })

    chart.priceScale('rsi-scale').applyOptions({
      scaleMargins: { top: 0.9, bottom: 0 },
      borderVisible: false,
    })

    const bbUpperSeries = chart.addLineSeries({
      color: '#c084fc',
      lineWidth: 1,
      lineStyle: 2,
    })

    const bbLowerSeries = chart.addLineSeries({
      color: '#c084fc',
      lineWidth: 1,
      lineStyle: 2,
    })

    const fetchChartData = async () => {
      const { data: prices, error: priceError } = await supabase
        .from('stock_entries')
        .select('*')
        .eq('symbol', symbol.toUpperCase())
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })

      const { data: signals, error: signalError } = await supabase
        .from('ai_signals')
        .select('*')
        .eq('symbol', symbol.toUpperCase())
        .gte('date', startDate)
        .lte('date', endDate)

      if (priceError || signalError || !prices || prices.length === 0) {
        console.error('Lỗi khi lấy dữ liệu:', priceError, signalError)
        return
      }

      const formatDate = (d: string) => d.split('T')[0]

      const mergedData = prices.map((p) => {
        const matchDate = formatDate(p.date)
        const s = signals.find((s) => formatDate(s.date) === matchDate)
        return {
          ...p,
          ...s,
        }
      })

      const candles = mergedData.map((item) => ({
        time: formatDate(item.date),
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      }))

      const avgVol = averageVolume(mergedData)
      const volumes = mergedData
        .filter((item) => item.volume !== undefined)
        .map((item) => {
          const vol = item.volume
          const time = formatDate(item.date)

          let color = '#94a3b8' // slate-400 mặc định

          if (vol > 3 * avgVol) {
            color = '#0ae368ff' // đỏ mạnh: volume quá cao
          } else if (vol > 2 * avgVol) {
            color = '#f97316' // cam: volume tăng đáng kể
          } else if (vol < 0.5 * avgVol) {
            color = '#dc2626' // nhạt: volume thấp đáng kể
          }

          return { time, value: vol, color }
        })

      const ma20 = mergedData
        .filter((item) => item.ma20 !== undefined)
        .map((item) => ({ time: formatDate(item.date), value: item.ma20 }))

      const rsi = mergedData
        .filter((item) => item.rsi !== undefined)
        .map((item) => ({ time: formatDate(item.date), value: item.rsi }))

      const bbUpper = mergedData
        .filter((item) => item.bb_upper !== undefined)
        .map((item) => ({ time: formatDate(item.date), value: item.bb_upper }))

      const bbLower = mergedData
        .filter((item) => item.bb_lower !== undefined)
        .map((item) => ({ time: formatDate(item.date), value: item.bb_lower }))

      const markers: SeriesMarker<Time>[] = mergedData.flatMap((item) => {
        const marks: SeriesMarker<Time>[] = []
        const time = formatDate(item.date)

        const markers: SeriesMarker<Time>[] = mergedData.flatMap((item) => {
        const marks: SeriesMarker<Time>[] = []
        const time = formatDate(item.date)

        const isHighConfidence = item.confidence !== undefined && item.confidence >= 0.85
        const isValidBuy =
          item.ai_recommendation === 'buy' &&
          isHighConfidence &&
          item.rsi !== undefined && item.rsi < 35 &&
          item.volume > 1.5 * averageVolume(mergedData)

        const isValidSell =
          item.ai_recommendation === 'sell' &&
          isHighConfidence &&
          item.rsi !== undefined && item.rsi > 65 &&
          item.volume > 1.5 * averageVolume(mergedData)

        if (showAI && (isValidBuy || isValidSell)) {
          marks.push({
            time,
            position: isValidBuy ? 'belowBar' : 'aboveBar',
            color: isValidBuy ? '#22c55e' : '#ef4444',
            shape: isValidBuy ? 'arrowUp' : 'arrowDown',
            text: `🤖 ${item.ai_recommendation.toUpperCase()} (${Math.round(item.confidence * 100)}%)`,
          })
        }
        return marks
      });
                const avgVol = averageVolume(mergedData)
                const totalRange = item.high - item.low
                const body = Math.abs(item.close - item.open)
                const upperShadow = item.high - Math.max(item.close, item.open)
                const lowerShadow = Math.min(item.close, item.open) - item.low
                const isBullish = item.close > item.open
                const priceChangePct = ((item.close - item.open) / item.open) * 100

                // 🔍 Điều kiện lọc nến nhiễu: bỏ qua nến quá nhỏ hoặc biến động thấp
                if (totalRange < 0.01 * item.open || item.volume < 0.2 * avgVol) return marks
                // 🎯 Hammer: thân nhỏ < 30% toàn nến, râu dưới > 2.5 lần thân, râu trên ngắn, giá tăng
                const isHammer =
                  body / totalRange < 0.3 &&
                  lowerShadow > body * 2.5 &&
                  upperShadow < body * 0.4 &&
                  isBullish &&
                  priceChangePct > 0.5

                if (showHammer && isHammer) {
                  marks.push({
                    time,
                    position: 'belowBar',
                    color: 'gold',
                    shape: 'circle',
                    text: '🔨 Hammer',
                  })
                }
                // 🌠 Shooting Star: thân nhỏ, râu trên dài > 2.5 lần thân, râu dưới ngắn, giá giảm
                const isShootingStar =
                  body / totalRange < 0.3 &&
                  upperShadow > body * 2.5 &&
                  lowerShadow < body * 0.4 &&
                  !isBullish &&
                  priceChangePct < -0.5

                if (showHammer && isShootingStar) {
                  marks.push({
                    time,
                    position: 'aboveBar',
                    color: 'red',
                    shape: 'circle',
                    text: '🌠 Shooting Star',
                  })
                }
                // 🦈 MUA MẠNH: volume > 3.5 lần avg, giá tăng > 3%, không phải nến doji
                const isBigBuy =
                  item.volume > 3.5 * avgVol &&
                  priceChangePct > 3 &&
                  body / totalRange > 0.5 &&
                  isBullish

                if (showShark && isBigBuy) {
                  marks.push({
                    time,
                    position: 'belowBar',
                    color: '#00FFFF',
                    shape: 'circle',
                    text: '🦈 MUA MẠNH',
                  })
                }
                // 🦈 XẢ HÀNG: volume > 3.5 lần avg, giá giảm > 3%, thân lớn, đỏ
                const isBigSell =
                  item.volume > 3.5 * avgVol &&
                  priceChangePct < -3 &&
                  body / totalRange > 0.5 &&
                  !isBullish

                if (showShark && isBigSell) {
                  marks.push({
                    time,
                    position: 'aboveBar',
                    color: '#FF00FF',
                    shape: 'circle',
                    text: '🦈 XẢ HÀNG',
                  })
                }
        return marks
      })
      candleSeries.setData(candles)
      volumeSeries.setData(volumes)
      ma20Series.setData(ma20)
      rsiSeries.setData(rsi)
      bbUpperSeries.setData(bbUpper)
      bbLowerSeries.setData(bbLower)
      candleSeries.setMarkers(markers)
    }

    fetchChartData()
    return () => chart.remove()
  }, [symbol, startDate, endDate, showHammer, showShark, showAI])

return (
  <div className="w-full max-w-[1200px] mx-auto rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl">
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Chart bên trái */}
       <div className="w-full lg:flex-1">
          <div ref={chartRef} className="w-full h-[500px]" />
      </div>

      {/* Bảng điều khiển bên phải */}
      <div className="w-[180px] flex flex-col gap-4">
       {/* Ngày */}
      <div className="flex flex-col gap-2 bg-slate-800 p-4 rounded-lg shadow-md border border-slate-600">
        <label className="text-white font-semibold">📅 Từ ngày:</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => {
            if (e.target.value > endDate) {
              alert('Ngày bắt đầu không được lớn hơn ngày kết thúc!')
              return
            }
            setStartDate(e.target.value)
          }}
          className="bg-white text-black rounded px-2 py-1 border border-slate-400"
        />

        <label className="text-white font-semibold">📆 Đến ngày:</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => {
            if (e.target.value < startDate) {
              alert('Ngày kết thúc phải sau ngày bắt đầu!')
              return
            }
            setEndDate(e.target.value)
          }}
          className="bg-white text-black rounded px-2 py-1 border border-slate-400"
        />
      
        {/* Nút preset thời gian */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              const today = new Date()
              const newStart = new Date()
              newStart.setDate(today.getDate() - 7)
              setStartDate(format(newStart, 'yyyy-MM-dd'))
              setEndDate(format(today, 'yyyy-MM-dd'))
            }}
            className="text-xs text-white bg-slate-700 hover:bg-slate-600 rounded px-2 py-1"
          >
            7 ngày
          </button>
          <button
            onClick={() => {
              const today = new Date()
              const newStart = new Date()
              newStart.setMonth(today.getMonth() - 1)
              setStartDate(format(newStart, 'yyyy-MM-dd'))
              setEndDate(format(today, 'yyyy-MM-dd'))
            }}
            className="text-xs text-white bg-slate-700 hover:bg-slate-600 rounded px-2 py-1"
          >
            1 tháng
          </button>
          <button
            onClick={() => {
              const today = new Date()
              const newStart = new Date()
              newStart.setMonth(today.getMonth() - 3)
              setStartDate(format(newStart, 'yyyy-MM-dd'))
              setEndDate(format(today, 'yyyy-MM-dd'))
            }}
            className="text-xs text-white bg-slate-700 hover:bg-slate-600 rounded px-2 py-1"
          >
            3 tháng
          </button>
          <button
            onClick={() => {
              const today = new Date()
              const newStart = new Date()
              newStart.setMonth(today.getMonth() - 6)
              setStartDate(format(newStart, 'yyyy-MM-dd'))
              setEndDate(format(today, 'yyyy-MM-dd'))
            }}
            className="text-xs text-white bg-slate-700 hover:bg-slate-600 rounded px-2 py-1"
          >
            6 tháng
          </button>
        </div>
        </div>
        {/* Nút điều khiển tín hiệu */}
        <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowHammer(!showHammer)}
                className={`rounded px-2 py-1 transition-all duration-300 ${
                  showHammer
                    ? 'bg-yellow-500 text-black shadow-md shadow-yellow-300'
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
              >
                🔨🌠 Nến đảo chiều
              </button>

              <button
                onClick={() => setShowShark(!showShark)}
                className={`rounded px-2 py-1 transition-all duration-300 ${
                  showShark
                    ? 'bg-pink-500 text-white shadow-md shadow-pink-300'
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
              >
                🦈💣 Cá mập
              </button>

              <button
                onClick={() => setShowAI(!showAI)}
                className={`rounded px-2 py-1 transition-all duration-300 ${
                  showAI
                    ? 'bg-green-500 text-white shadow-md shadow-green-300'
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
              >
                🤖 AI Buy/Sell
              </button>
            </div>
      </div>
    </div>   
  </div>
)
}
function averageVolume(data: { volume?: number }[]): number {
  const valid = data.filter((d) => d.volume !== undefined)
  const sum = valid.reduce((acc, d) => acc + (d.volume || 0), 0)
  return valid.length ? sum / valid.length : 0
}
