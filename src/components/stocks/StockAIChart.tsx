'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  createChart,
  CrosshairMode,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts'
import { supabase } from '@/lib/supabase'
import { format, subDays } from 'date-fns'

type StockRow = {
  symbol?: string
  date: string
  open?: unknown
  high?: unknown
  low?: unknown
  close?: unknown
  volume?: unknown
  [key: string]: unknown
}

type SignalRow = {
  symbol?: string
  date: string
  ma20?: unknown
  rsi?: unknown
  bb_upper?: unknown
  bb_lower?: unknown
  ai_recommendation?: unknown
  confidence?: unknown
  [key: string]: unknown
}

type MergedRow = StockRow & SignalRow & {
  dateKey: string
  openN: number
  highN: number
  lowN: number
  closeN: number
  volumeN: number
  confidenceN: number | null
}

const COLORS = {
  background: '#0b1220',
  panel: '#0f172a',
  border: '#263449',
  grid: '#243247',
  text: '#dbe5f2',
  muted: '#8ea0b8',
  green: '#22c55e',
  red: '#f43f5e',
  yellow: '#fbbf24',
  violet: '#c084fc',
  cyan: '#22d3ee',
  blue: '#60a5fa',
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(/,/g, '').trim())
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function numeric(value: unknown, fallback = 0): number {
  return toFiniteNumber(value) ?? fallback
}

function dateKey(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const raw = String(value)
  // Date-only values are kept as-is to avoid timezone shifting.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : format(parsed, 'yyyy-MM-dd')
}

function normalizeConfidence(value: unknown): number | null {
  const confidence = toFiniteNumber(value)
  if (confidence === null) return null
  return Math.max(0, Math.min(1, confidence > 1 ? confidence / 100 : confidence))
}

function averagePriorVolume(rows: MergedRow[], index: number, period = 20): number | null {
  // Chỉ dùng các phiên trước đó, không dùng volume của chính phiên đang xét
  // hoặc dữ liệu tương lai để tránh look-ahead bias trong phát hiện tín hiệu.
  const previous = rows.slice(Math.max(0, index - period), index)
    .map((row) => row.volumeN)
    .filter((value) => Number.isFinite(value) && value > 0)
  if (!previous.length) return null
  return previous.reduce((sum, value) => sum + value, 0) / previous.length
}

function signedPercent(open: number, close: number): number | null {
  if (!Number.isFinite(open) || open <= 0 || !Number.isFinite(close)) return null
  return ((close - open) / open) * 100
}

function makeMarker(
  time: Time,
  position: 'aboveBar' | 'belowBar',
  color: string,
  shape: 'circle' | 'arrowUp' | 'arrowDown',
  text: string,
): SeriesMarker<Time> {
  return { time, position, color, shape, text, size: 1 }
}

function ControlButton({
  active,
  onClick,
  children,
  accent = 'blue',
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  accent?: 'blue' | 'yellow' | 'pink' | 'green'
}) {
  const activeClass = {
    blue: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
    yellow: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
    pink: 'border-pink-400/40 bg-pink-400/10 text-pink-200',
    green: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  }[accent]

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
        active ? activeClass : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:border-slate-500 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  )
}

export default function StockAIChart({ symbol }: { symbol: string }) {
  const chartRef = useRef<HTMLDivElement>(null)
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 180), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [showHammer, setShowHammer] = useState(true)
  const [showShark, setShowShark] = useState(true)
  const [showAI, setShowAI] = useState(true)
  const [showMA, setShowMA] = useState(true)
  const [showBB, setShowBB] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rowCount, setRowCount] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const normalizedSymbol = symbol.trim().toUpperCase()

  const chartOptions = useMemo(() => ({
    layout: {
      background: { color: COLORS.panel },
      textColor: COLORS.text,
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    },
    grid: {
      vertLines: { color: COLORS.grid },
      horzLines: { color: COLORS.grid },
    },
    crosshair: { mode: CrosshairMode.Normal },
    rightPriceScale: {
      borderColor: COLORS.border,
      scaleMargins: { top: 0.08, bottom: 0.28 },
    },
    timeScale: {
      borderColor: COLORS.border,
      rightOffset: 5,
      barSpacing: 8,
      fixLeftEdge: true,
      lockVisibleTimeRangeOnResize: true,
      rightBarStaysOnScroll: true,
      timeVisible: false,
    },
    handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
  }), [])

  useEffect(() => {
    const host = chartRef.current
    if (!host) return

    const chart = createChart(host, {
      ...chartOptions,
      width: Math.max(host.clientWidth, 320),
      height: 520,
    })

    const candles = chart.addCandlestickSeries({
      upColor: COLORS.green,
      downColor: COLORS.red,
      borderUpColor: COLORS.green,
      borderDownColor: COLORS.red,
      wickUpColor: COLORS.green,
      wickDownColor: COLORS.red,
      priceLineVisible: true,
      lastValueVisible: true,
    })

    const volume = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      lastValueVisible: false,
      priceLineVisible: false,
    })
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
      borderVisible: false,
    })

    const ma20 = chart.addLineSeries({
      color: COLORS.yellow,
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      title: 'MA20',
    })

    const rsi = chart.addLineSeries({
      color: '#e2e8f0',
      lineWidth: 1,
      priceScaleId: 'rsi',
      lastValueVisible: false,
      priceLineVisible: false,
      title: 'RSI',
    })
    chart.priceScale('rsi').applyOptions({
      scaleMargins: { top: 0.9, bottom: 0 },
      borderVisible: false,
      visible: false,
    })

    const upperBB = chart.addLineSeries({
      color: COLORS.violet,
      lineWidth: 1,
      lineStyle: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      title: 'BB Upper',
    })
    const lowerBB = chart.addLineSeries({
      color: COLORS.violet,
      lineWidth: 1,
      lineStyle: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      title: 'BB Lower',
    })

    let disposed = false
    let requestVersion = 0

    const fetchChartData = async () => {
      const version = ++requestVersion
      setLoading(true)
      setError('')

      try {
        // Select * để tránh PostgREST báo lỗi khi schema thực tế không có một
        // trường chỉ báo tùy chọn. Lọc ngày/symbol phía client sau khi chuẩn hóa.
        const [priceResult, signalResult] = await Promise.all([
          supabase
            .from('stock_entries')
            .select('*')
            .eq('symbol', normalizedSymbol)
            .limit(10000),
          // AI signal là lớp bổ sung: nếu bảng/lược đồ này lỗi, biểu đồ giá
          // vẫn được dựng; lỗi được ghi rõ ra console để truy vết.
          supabase
            .from('ai_signals')
            .select('*')
            .eq('symbol', normalizedSymbol)
            .limit(10000),
        ])

        if (disposed || version !== requestVersion) return
        if (priceResult.error) throw priceResult.error

        const priceRows = ((priceResult.data ?? []) as StockRow[])
          .filter((row) => {
            const key = dateKey(row.date ?? row.trade_date ?? row.timestamp ?? row.created_at)
            return key !== null && key >= startDate && key <= endDate
          })
          .sort((a, b) =>
            String(dateKey(a.date ?? a.trade_date ?? a.timestamp ?? a.created_at) ?? '')
              .localeCompare(String(dateKey(b.date ?? b.trade_date ?? b.timestamp ?? b.created_at) ?? '')),
          )

        const signalRows = signalResult.error
          ? (console.warn('[StockAIChart] ai_signals không tải được; tiếp tục chart giá:', signalResult.error), [] as SignalRow[])
          : ((signalResult.data ?? []) as SignalRow[]).filter((row) => {
              const key = dateKey(row.date ?? row.trade_date ?? row.timestamp ?? row.created_at)
              return key !== null && key >= startDate && key <= endDate
            }) as SignalRow[]
        if (!priceRows.length) {
          setRowCount(0)
          setError(`Chưa có dữ liệu giá cho ${normalizedSymbol} trong khoảng thời gian đã chọn.`)
          candles.setData([])
          volume.setData([])
          ma20.setData([])
          rsi.setData([])
          upperBB.setData([])
          lowerBB.setData([])
          candles.setMarkers([])
          return
        }

        // Map signals by normalized session date; deterministic selection when duplicates exist.
        const signalByDate = new Map<string, SignalRow>()
        for (const row of signalRows) {
          const key = dateKey(row.date ?? row.trade_date ?? row.timestamp ?? row.created_at)
          if (key) signalByDate.set(key, {
            ...row,
            ma20: row.ma20 ?? row.ma_20 ?? row.sma20,
            rsi: row.rsi ?? row.rsi_14 ?? row.rsi14,
            bb_upper: row.bb_upper ?? row.upper_band ?? row.bollinger_upper,
            bb_lower: row.bb_lower ?? row.lower_band ?? row.bollinger_lower,
            ai_recommendation: row.ai_recommendation ?? row.recommendation ?? row.signal ?? row.action,
            confidence: row.confidence ?? row.probability ?? row.score,
          })
        }

        const merged: MergedRow[] = priceRows
          .map((row) => {
            const rowDate = row.date ?? row.trade_date ?? row.timestamp ?? row.created_at
            const key = dateKey(rowDate)
            const openN = toFiniteNumber(row.open ?? row.open_price ?? row.o)
            const highN = toFiniteNumber(row.high ?? row.high_price ?? row.h)
            const lowN = toFiniteNumber(row.low ?? row.low_price ?? row.l)
            const closeN = toFiniteNumber(row.close ?? row.close_price ?? row.adj_close ?? row.c)
            const volumeN = toFiniteNumber(row.volume ?? row.vol ?? row.total_volume ?? row.total_vol)
            if (!key || openN === null || highN === null || lowN === null || closeN === null) return null

            const signal = signalByDate.get(key) ?? ({} as SignalRow)
            return {
              ...row,
              ...signal,
              dateKey: key,
              openN,
              highN: Math.max(highN, openN, closeN),
              lowN: Math.min(lowN, openN, closeN),
              closeN,
              volumeN: volumeN !== null && volumeN >= 0 ? volumeN : 0,
              confidenceN: normalizeConfidence(signal.confidence),
            } as MergedRow
          })
          .filter((row): row is MergedRow => row !== null)
          .sort((a, b) => a.dateKey.localeCompare(b.dateKey))

        // Keep one row per session. Supabase date fields may contain timestamps.
        const uniqueRows = Array.from(new Map(merged.map((row) => [row.dateKey, row])).values())
        const candleData = uniqueRows.map((row) => ({
          time: row.dateKey as Time,
          open: row.openN,
          high: row.highN,
          low: row.lowN,
          close: row.closeN,
        }))

        const volumes = uniqueRows.map((row, index) => {
          const baseline = averagePriorVolume(uniqueRows, index, 20)
          const ratio = baseline && baseline > 0 ? row.volumeN / baseline : null
          let color = row.closeN >= row.openN ? '#3b9e79' : '#c75b6b'
          if (ratio !== null && ratio >= 3) color = '#00d084'
          else if (ratio !== null && ratio >= 2) color = '#f97316'
          else if (ratio !== null && ratio < 0.5) color = '#64748b'
          return { time: row.dateKey as Time, value: row.volumeN, color }
        })

        const maData = uniqueRows.flatMap((row) => {
          const value = toFiniteNumber(row.ma20)
          return value === null ? [] : [{ time: row.dateKey as Time, value }]
        })
        const rsiData = uniqueRows.flatMap((row) => {
          const value = toFiniteNumber(row.rsi)
          return value === null || value < 0 || value > 100 ? [] : [{ time: row.dateKey as Time, value }]
        })
        const upperData = uniqueRows.flatMap((row) => {
          const value = toFiniteNumber(row.bb_upper)
          return value === null ? [] : [{ time: row.dateKey as Time, value }]
        })
        const lowerData = uniqueRows.flatMap((row) => {
          const value = toFiniteNumber(row.bb_lower)
          return value === null ? [] : [{ time: row.dateKey as Time, value }]
        })

        const markers: SeriesMarker<Time>[] = []
        uniqueRows.forEach((row, index) => {
          const time = row.dateKey as Time
          const baseline = averagePriorVolume(uniqueRows, index, 20)
          const volumeRatio = baseline && baseline > 0 ? row.volumeN / baseline : null
          const range = row.highN - row.lowN
          if (range <= 0 || row.openN <= 0) return

          const body = Math.abs(row.closeN - row.openN)
          const safeBody = Math.max(body, row.openN * 0.0001)
          const upperWick = row.highN - Math.max(row.openN, row.closeN)
          const lowerWick = Math.min(row.openN, row.closeN) - row.lowN
          const changePct = signedPercent(row.openN, row.closeN)
          const bullish = row.closeN > row.openN
          const bearish = row.closeN < row.openN
          const bodyRatio = body / range

          // Candlestick patterns are heuristic confirmations, not standalone trading signals.
          const hammer = bodyRatio <= 0.32 &&
            lowerWick >= safeBody * 2 &&
            upperWick <= safeBody * 0.6 &&
            lowerWick / range >= 0.45 &&
            (changePct ?? 0) > 0
          const shootingStar = bodyRatio <= 0.32 &&
            upperWick >= safeBody * 2 &&
            lowerWick <= safeBody * 0.6 &&
            upperWick / range >= 0.45 &&
            (changePct ?? 0) < 0

          if (showHammer && volumeRatio !== null && volumeRatio >= 0.6) {
            if (hammer) markers.push(makeMarker(time, 'belowBar', COLORS.yellow, 'circle', 'Hammer'))
            if (shootingStar) markers.push(makeMarker(time, 'aboveBar', COLORS.red, 'circle', 'Shooting Star'))
          }

          const highVolume = volumeRatio !== null && volumeRatio >= 3
          const strongBull = highVolume && (changePct ?? 0) >= 3 && bodyRatio >= 0.5 && bullish
          const strongBear = highVolume && (changePct ?? 0) <= -3 && bodyRatio >= 0.5 && bearish
          if (showShark && strongBull) {
            markers.push(makeMarker(time, 'belowBar', COLORS.cyan, 'arrowUp', 'Volume spike • BUY'))
          }
          if (showShark && strongBear) {
            markers.push(makeMarker(time, 'aboveBar', '#e879f9', 'arrowDown', 'Volume spike • SELL'))
          }

          const confidence = row.confidenceN
          const recommendation = String(row.ai_recommendation ?? '').toLowerCase()
          const rsiValue = toFiniteNumber(row.rsi)
          const aiBuy = recommendation === 'buy' &&
            confidence !== null && confidence >= 0.85 &&
            rsiValue !== null && rsiValue <= 40 &&
            volumeRatio !== null && volumeRatio >= 1.2
          const aiSell = recommendation === 'sell' &&
            confidence !== null && confidence >= 0.85 &&
            rsiValue !== null && rsiValue >= 60 &&
            volumeRatio !== null && volumeRatio >= 1.2

          if (showAI && (aiBuy || aiSell)) {
            markers.push(makeMarker(
              time,
              aiBuy ? 'belowBar' : 'aboveBar',
              aiBuy ? COLORS.green : COLORS.red,
              aiBuy ? 'arrowUp' : 'arrowDown',
              `AI ${aiBuy ? 'BUY' : 'SELL'} ${(confidence! * 100).toFixed(0)}%`,
            ))
          }
        })

        candles.setData(candleData)
        volume.setData(volumes)
        ma20.setData(showMA ? maData : [])
        rsi.setData(rsiData)
        upperBB.setData(showBB ? upperData : [])
        lowerBB.setData(showBB ? lowerData : [])
        candles.setMarkers(markers.sort((a, b) => String(a.time).localeCompare(String(b.time))))
        chart.timeScale().fitContent()
        setRowCount(uniqueRows.length)
        setLastUpdated(new Date())
      } catch (fetchError) {
        if (disposed || version !== requestVersion) return
        console.error('[StockAIChart] Failed to load chart data:', fetchError)
        const detail = fetchError && typeof fetchError === 'object' && 'message' in fetchError
          ? String((fetchError as { message?: unknown }).message ?? '')
          : String(fetchError ?? '')
        setError(detail
          ? `Không tải được dữ liệu từ stock_entries: ${detail}`
          : 'Không tải được dữ liệu từ stock_entries. Xem Console để biết lỗi Supabase chi tiết.')
      } finally {
        if (!disposed && version === requestVersion) setLoading(false)
      }
    }

    void fetchChartData()

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      chart.applyOptions({ width: Math.max(320, Math.floor(entry.contentRect.width)) })
    })
    resizeObserver.observe(host)

    return () => {
      disposed = true
      resizeObserver.disconnect()
      chart.remove()
    }
  }, [normalizedSymbol, startDate, endDate, showHammer, showShark, showAI, showMA, showBB, chartOptions])

  const applyRange = (months: number | 'week') => {
    const today = new Date()
    const from = new Date(today)
    if (months === 'week') from.setDate(today.getDate() - 7)
    else from.setMonth(today.getMonth() - months)
    setStartDate(format(from, 'yyyy-MM-dd'))
    setEndDate(format(today, 'yyyy-MM-dd'))
  }

  const dateRangeInvalid = startDate > endDate

  return (
    <section className="mx-auto w-full max-w-[1600px] space-y-4 rounded-2xl border border-slate-800 bg-[#080e18] p-3 text-slate-100 shadow-2xl sm:p-5">
      <header className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-400">LHP • Technical Intelligence</p>
          <h2 className="mt-1 text-xl font-bold sm:text-2xl">
            Stock AI Chart <span className="text-sky-300">{normalizedSymbol || '—'}</span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Candlestick • Volume profile signals • MA20 • Bollinger Bands • AI markers
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className={`h-2 w-2 rounded-full ${loading ? 'animate-pulse bg-amber-400' : error ? 'bg-rose-400' : 'bg-emerald-400'}`} />
          {loading ? 'Đang tải dữ liệu' : error ? 'Có lỗi dữ liệu' : `${rowCount.toLocaleString('vi-VN')} phiên`}
          {lastUpdated && !loading && <span>• Cập nhật {lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>}
        </div>
      </header>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 p-2 sm:p-3">
          {error && (
            <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </div>
          )}
          <div ref={chartRef} className="h-[420px] w-full sm:h-[520px]" />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-800 pt-3 text-[11px] text-slate-400">
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />Tăng</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500" />Giảm</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />MA20</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-violet-400" />Bollinger</span>
          </div>
        </div>

        <aside className="space-y-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-300">Khoảng thời gian</h3>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-slate-400">
                Từ ngày
                <input
                  type="date"
                  value={startDate}
                  max={endDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                />
              </label>
              <label className="text-[11px] text-slate-400">
                Đến ngày
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                />
              </label>
            </div>
            {dateRangeInvalid && <p className="mt-2 text-xs text-rose-300">Ngày bắt đầu phải trước ngày kết thúc.</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <ControlButton active={false} onClick={() => applyRange('week')}>7 ngày</ControlButton>
              <ControlButton active={false} onClick={() => applyRange(1)}>1 tháng</ControlButton>
              <ControlButton active={false} onClick={() => applyRange(3)}>3 tháng</ControlButton>
              <ControlButton active={false} onClick={() => applyRange(6)}>6 tháng</ControlButton>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-300">Hiển thị lớp dữ liệu</h3>
            <div className="flex flex-col gap-2">
              <ControlButton active={showMA} accent="yellow" onClick={() => setShowMA((value) => !value)}>MA20</ControlButton>
              <ControlButton active={showBB} accent="blue" onClick={() => setShowBB((value) => !value)}>Bollinger Bands</ControlButton>
              <ControlButton active={showHammer} accent="yellow" onClick={() => setShowHammer((value) => !value)}>Hammer / Shooting Star</ControlButton>
              <ControlButton active={showShark} accent="pink" onClick={() => setShowShark((value) => !value)}>Volume spike signals</ControlButton>
              <ControlButton active={showAI} accent="green" onClick={() => setShowAI((value) => !value)}>AI BUY / SELL</ControlButton>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-300">Đọc tín hiệu</h3>
            <p className="text-xs leading-5 text-slate-400">
              Marker là bộ lọc heuristic từ dữ liệu giá, khối lượng và chỉ báo. Các ngưỡng volume được so với trung bình 20 phiên trước đó, không bao gồm phiên hiện tại. Tín hiệu không đảm bảo hiệu quả giao dịch.
            </p>
          </div>
        </aside>
      </div>
    </section>
  )
}
