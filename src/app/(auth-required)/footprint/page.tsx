
'use client'
import TradeSignalPanel from "@/components/footprint/TradeSignalPanel";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

type JsonObject = Record<string, any>

type FootprintLevel = {
  price: number
  bid: number
  ask: number
  volume: number
  delta: number
  cumulativeDelta: number
}

type FootprintTrade = {
  id: string
  time: string
  timestamp: number
  price: number
  volume: number
  side: string
}

type FootprintCandle = {
  time: string
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  bidVolume: number
  askVolume: number
  delta: number
  levels: FootprintLevel[]
}

type StreamStatus = {
  connected?: boolean
  running?: boolean
  status?: string
  message?: string
  [key: string]: any
}

type ChartMode = 'footprint' | 'candles'
type FootprintMode = 'bid-ask' | 'delta' | 'volume'

const API_BASE = (
  process.env.NEXT_PUBLIC_LHP_AI_SERVER_URL ||
  (process.env.NODE_ENV === 'development'
    ? 'http://127.0.0.1:10000'
    : 'https://lhp-ai-server.onrender.com')
).replace(/\/+$/, '')


const DEFAULT_SYMBOLS = [
  'FPT',
  'SSI',
  'HPG',
  'VCB',
  'VND',
  'DXG',
  'GEX',
  'MWG',
  'CTG',
  'TCB',
  'MBB',
  'STB',
  'VIC',
  'VHM',
  'DGC',
  'VNM',
  'HSG',
  'NVL',
  'PDR',
  'VNINDEX',
  'VN30',
]

const TIMEFRAMES = [
  { label: '1m', value: '1m' },
  { label: '3m', value: '3m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1H', value: '1H' },
]

const COLORS = {
  background: '#080d14',
  panel: '#101722',
  panelAlt: '#0c121b',
  border: '#243044',
  text: '#e2e8f0',
  muted: '#8491a5',
  green: '#10b981',
  red: '#f43f5e',
  blue: '#38bdf8',
  yellow: '#fbbf24',
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }

  return fallback
}

function firstValue(
  obj: JsonObject,
  keys: string[],
  fallback?: unknown,
): unknown {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) {
      return obj[key]
    }
  }

  return fallback
}

function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(value) ? value : 0)
}

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '—'

  return formatNumber(value, value % 1 === 0 ? 0 : 2)
}

function toTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value)

    if (Number.isFinite(parsed)) return parsed

    const numeric = Number(value)

    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric < 1e12 ? numeric * 1000 : numeric
    }
  }

  return 0
}

function formatTime(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '—'
  }

  const raw = String(value)

  if (/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    return raw
  }

  const timestamp = toTimestamp(value)

  if (!timestamp) return raw

  return new Date(timestamp).toLocaleTimeString('vi-VN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function findArray(data: any, keys: string[]): any[] {
  if (Array.isArray(data)) return data

  if (!data || typeof data !== 'object') return []

  for (const key of keys) {
    if (Array.isArray(data[key])) return data[key]
  }

  if (data.data && data.data !== data) {
    const nested = findArray(data.data, keys)
    if (nested.length) return nested
  }

  if (data.result && data.result !== data) {
    const nested = findArray(data.result, keys)
    if (nested.length) return nested
  }

  return []
}

function normalizeSymbols(data: any): string[] {
  const rows = findArray(data, [
    'symbols',
    'items',
    'stocks',
    'results',
  ])

  const values = rows
    .map((item: any) => {
      if (typeof item === 'string') return item

      if (item && typeof item === 'object') {
        return firstValue(item, [
          'symbol',
          'ticker',
          'code',
          'stock_code',
        ])
      }

      return undefined
    })
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)

  return [...new Set([...values, ...DEFAULT_SYMBOLS])]
}

function normalizeLevels(data: any): FootprintLevel[] {
  const rows = findArray(data, [
    'levels',
    'price_levels',
    'footprint',
    'rows',
    'clusters',
  ])

  const mapped = rows
    .map((row: any) => {
      if (!row || typeof row !== 'object') return null

      const price = asNumber(
        firstValue(row, [
          'price',
          'price_level',
          'p',
          'level',
        ]),
        Number.NaN,
      )

      if (!Number.isFinite(price)) return null

      const bid = asNumber(
        firstValue(row, [
          'bid',
          'sell',
          'sell_volume',
          'bid_volume',
          'aggressive_sell',
          'bidVol',
        ]),
      )

      const ask = asNumber(
        firstValue(row, [
          'ask',
          'buy',
          'buy_volume',
          'ask_volume',
          'aggressive_buy',
          'askVol',
        ]),
      )

      const volume = asNumber(
        firstValue(row, [
          'volume',
          'total_volume',
          'total',
          'vol',
        ]),
        bid + ask,
      )

      return {
        price,
        bid,
        ask,
        volume,
        delta: asNumber(row.delta, ask - bid),
        cumulativeDelta: asNumber(
          firstValue(row, [
            'cumulativeDelta',
            'cumulative_delta',
            'cum_delta',
          ]),
        ),
      } as FootprintLevel
    })
    .filter((row): row is FootprintLevel => row !== null)

  mapped.sort((a, b) => b.price - a.price)

  let cumulative = 0

  return mapped.map((row) => {
    cumulative += row.delta

    return {
      ...row,
      cumulativeDelta:
        row.cumulativeDelta !== 0
          ? row.cumulativeDelta
          : cumulative,
    }
  })
}

function normalizeTrades(data: any): FootprintTrade[] {
  const rows = findArray(data, [
    'trades',
    'items',
    'ticks',
    'results',
  ])

  return rows.slice(-200).reverse().map((row: any, index: number) => {
    const rawTime = firstValue(row, [
      'timestamp',
      'time',
      'trade_time',
      'created_at',
    ])

    return {
      id: String(
        row.id ??
          row.trade_id ??
          `${rawTime}-${row.price}-${index}`,
      ),
      time: formatTime(rawTime),
      timestamp: toTimestamp(rawTime),
      price: asNumber(
        firstValue(row, [
          'price',
          'trade_price',
          'match_price',
        ]),
      ),
      volume: asNumber(
        firstValue(row, [
          'volume',
          'quantity',
          'qty',
          'trade_volume',
        ]),
      ),
      side: String(
        firstValue(
          row,
          [
            'side',
            'aggressor_side',
            'trade_side',
            'direction',
          ],
          'UNKNOWN',
        ),
      ).toUpperCase(),
    }
  })
}

function normalizeCandles(data: any): FootprintCandle[] {
  const rows = findArray(data, [
    'candles',
    'ohlc',
    'bars',
    'items',
    'results',
  ])

  return rows.slice(-100).map((row: any) => {
    const rawTime = firstValue(row, [
      'timestamp',
      'time',
      'start_time',
      'datetime',
    ])

    const levels = normalizeLevels({
      levels: firstValue(row, [
        'levels',
        'price_levels',
        'footprint',
        'clusters',
      ], []),
    })

    const open = asNumber(firstValue(row, ['open', 'o']))
    const high = asNumber(firstValue(row, ['high', 'h']), open)
    const low = asNumber(firstValue(row, ['low', 'l']), open)
    const close = asNumber(firstValue(row, ['close', 'c']), open)

    const bidVolume = asNumber(
      firstValue(row, ['bid_volume', 'bidVolume', 'total_bid']),
      levels.reduce((sum, level) => sum + level.bid, 0),
    )

    const askVolume = asNumber(
      firstValue(row, ['ask_volume', 'askVolume', 'total_ask']),
      levels.reduce((sum, level) => sum + level.ask, 0),
    )

    return {
      time: formatTime(rawTime),
      timestamp: toTimestamp(rawTime),
      open,
      high,
      low,
      close,
      volume: asNumber(
        firstValue(row, ['volume', 'vol', 'v']),
        levels.reduce((sum, level) => sum + level.volume, 0),
      ),
      bidVolume,
      askVolume,
      delta: asNumber(
        firstValue(row, ['delta', 'net_delta']),
        askVolume - bidVolume,
      ),
      levels,
    }
  })
}

function normalizePayload(data: any): JsonObject {
  if (!data || typeof data !== 'object') return {}

  if (
    data.data &&
    typeof data.data === 'object' &&
    !Array.isArray(data.data)
  ) {
    return { ...data.data, ...data }
  }

  return data
}

function isPositiveSide(side: string): boolean {
  return [
    'BUY',
    'B',
    'BUYER',
    'ASK',
    'AGGRESSIVE_BUY',
    '1',
  ].includes(side)
}

function isNegativeSide(side: string): boolean {
  return [
    'SELL',
    'S',
    'SELLER',
    'BID',
    'AGGRESSIVE_SELL',
    '-1',
  ].includes(side)
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${formatNumber(value)}`
}

function Panel({
  title,
  subtitle,
  right,
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  right?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-[#101722] ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold text-slate-100">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-1 text-xs text-slate-500">
              {subtitle}
            </p>
          )}
        </div>

        {right}
      </div>

      {children}
    </section>
  )
}

function Metric({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string
  value: string
  sub?: string
  tone?: 'neutral' | 'green' | 'red' | 'blue' | 'yellow'
}) {
  const toneClass = {
    neutral: 'text-slate-100',
    green: 'text-emerald-400',
    red: 'text-rose-400',
    blue: 'text-sky-400',
    yellow: 'text-amber-400',
  }[tone]

  return (
    <div className="min-w-0 rounded-xl border border-slate-800 bg-[#101722] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>

      <div
        className={`mt-2 truncate text-lg font-bold tabular-nums ${toneClass}`}
      >
        {value}
      </div>

      {sub && (
        <div className="mt-1 truncate text-[11px] text-slate-500">
          {sub}
        </div>
      )}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center px-5 py-8 text-center text-sm text-slate-500">
      {text}
    </div>
  )
}

function FootprintChart({
  candles,
  mode,
  footprintMode,
  showVolume,
  showPoc,
}: {
  candles: FootprintCandle[]
  mode: ChartMode
  footprintMode: FootprintMode
  showVolume: boolean
  showPoc: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState(0)
  const dragRef = useRef<{
    x: number
    offset: number
  } | null>(null)

  const [containerWidth, setContainerWidth] = useState(900)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) setContainerWidth(width)
    })

    observer.observe(host)

    return () => observer.disconnect()
  }, [])

  const visibleCount = Math.max(
    4,
    Math.floor((containerWidth - 76) / (mode === 'footprint' ? 108 : 18) / zoom),
  )

  const visibleCandles = useMemo(() => {
    const end = Math.max(0, candles.length - offset)
    const start = Math.max(0, end - visibleCount)

    return candles.slice(start, end)
  }, [candles, offset, visibleCount])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    const width = Math.max(containerWidth, 320)
    const height = 540
    const ratio = window.devicePixelRatio || 1

    canvas.width = width * ratio
    canvas.height = height * ratio
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, width, height)

    context.fillStyle = COLORS.background
    context.fillRect(0, 0, width, height)

    const left = 12
    const right = 70
    const top = 20
    const bottom = showVolume ? 105 : 40

    const chartWidth = width - left - right
    const chartHeight = height - top - bottom
    const priceWidth = chartWidth
    const priceHeight = chartHeight

    if (!visibleCandles.length) {
      context.fillStyle = COLORS.muted
      context.font = '13px sans-serif'
      context.textAlign = 'center'
      context.fillText(
        'Chưa có dữ liệu nến từ backend',
        width / 2,
        height / 2,
      )
      return
    }

    const allPrices = visibleCandles.flatMap((candle) => [
      candle.high,
      candle.low,
      candle.open,
      candle.close,
      ...candle.levels.map((level) => level.price),
    ]).filter(Number.isFinite)

    let minPrice = Math.min(...allPrices)
    let maxPrice = Math.max(...allPrices)

    if (minPrice === maxPrice) {
      minPrice -= 1
      maxPrice += 1
    }

    const padding = (maxPrice - minPrice) * 0.06
    minPrice -= padding
    maxPrice += padding

    const priceToY = (price: number) =>
      top +
      ((maxPrice - price) / (maxPrice - minPrice)) * priceHeight

    const maxVol = Math.max(
      1,
      ...visibleCandles.map((candle) => candle.volume),
    )

    const step = priceWidth / visibleCandles.length

    // Horizontal price grid.
    context.font = '10px monospace'
    context.textAlign = 'right'
    context.textBaseline = 'middle'

    for (let i = 0; i <= 8; i++) {
      const price =
        maxPrice - ((maxPrice - minPrice) * i) / 8
      const y = priceToY(price)

      context.strokeStyle = '#1e293b'
      context.lineWidth = 1
      context.beginPath()
      context.moveTo(left, y)
      context.lineTo(width - right, y)
      context.stroke()

      context.fillStyle = COLORS.muted
      context.fillText(formatPrice(price), width - 8, y)
    }

    // Volume Profile for the visible range.
    if (mode === 'footprint') {
      const profile = new Map<number, number>()

      for (const candle of visibleCandles) {
        for (const level of candle.levels) {
          profile.set(
            level.price,
            (profile.get(level.price) || 0) + level.volume,
          )
        }
      }

      const profileMax = Math.max(1, ...profile.values())
      const profileWidth = Math.min(90, chartWidth * 0.12)

      for (const [price, volume] of profile.entries()) {
        const y = priceToY(price)

        context.fillStyle = 'rgba(56,189,248,0.12)'
        context.fillRect(
          width - right - profileWidth,
          y - 3,
          (volume / profileMax) * profileWidth,
          6,
        )
      }
    }

    // POC: maximum-volume price level per candle.
    visibleCandles.forEach((candle, index) => {
      const x = left + step * index + step / 2

      if (showPoc && candle.levels.length) {
        const poc = candle.levels.reduce((best, current) =>
          current.volume > best.volume ? current : best,
        )

        const y = priceToY(poc.price)

        context.strokeStyle = 'rgba(251,191,36,0.8)'
        context.setLineDash([3, 3])
        context.beginPath()
        context.moveTo(x - step * 0.35, y)
        context.lineTo(x + step * 0.35, y)
        context.stroke()
        context.setLineDash([])
      }

      const bullish = candle.close >= candle.open
      const candleColor = bullish ? COLORS.green : COLORS.red

      if (mode === 'candles') {
        const bodyWidth = Math.max(3, Math.min(12, step * 0.55))

        context.strokeStyle = candleColor
        context.lineWidth = 1
        context.beginPath()
        context.moveTo(x, priceToY(candle.high))
        context.lineTo(x, priceToY(candle.low))
        context.stroke()

        const bodyTop = priceToY(Math.max(candle.open, candle.close))
        const bodyBottom = priceToY(Math.min(candle.open, candle.close))
        const bodyHeight = Math.max(1, bodyBottom - bodyTop)

        context.fillStyle = candleColor
        context.fillRect(
          x - bodyWidth / 2,
          bodyTop,
          bodyWidth,
          bodyHeight,
        )
      } else {
        const bodyTop = priceToY(Math.max(candle.open, candle.close))
        const bodyBottom = priceToY(Math.min(candle.open, candle.close))
        const bodyWidth = Math.max(3, Math.min(18, step * 0.42))

        context.strokeStyle = candleColor
        context.lineWidth = 1.5
        context.beginPath()
        context.moveTo(x, priceToY(candle.high))
        context.lineTo(x, priceToY(candle.low))
        context.stroke()

        context.fillStyle = bullish
          ? 'rgba(16,185,129,0.22)'
          : 'rgba(244,63,94,0.22)'

        context.fillRect(
          x - bodyWidth / 2,
          bodyTop,
          bodyWidth,
          Math.max(1, bodyBottom - bodyTop),
        )

        const levels = [...candle.levels].sort(
          (a, b) => b.price - a.price,
        )

        if (levels.length) {
          const rowHeight = Math.max(
            11,
            Math.min(
              23,
              priceHeight / Math.max(1, levels.length),
            ),
          )

          const cellWidth = Math.max(
            34,
            Math.min(48, step * 0.44),
          )

          const totalWidth = cellWidth * 2 + 3

          levels.forEach((level) => {
            const y = priceToY(level.price)
            const cellY = y - rowHeight / 2

            if (y < top || y > top + priceHeight) return

            if (footprintMode === 'bid-ask') {
              const bidAlpha = Math.min(
                0.8,
                0.12 + level.bid / Math.max(1, maxVol) * 2,
              )

              const askAlpha = Math.min(
                0.8,
                0.12 + level.ask / Math.max(1, maxVol) * 2,
              )

              context.fillStyle = `rgba(244,63,94,${bidAlpha})`
              context.fillRect(
                x - totalWidth / 2,
                cellY,
                cellWidth,
                rowHeight - 1,
              )

              context.fillStyle = `rgba(16,185,129,${askAlpha})`
              context.fillRect(
                x - totalWidth / 2 + cellWidth + 3,
                cellY,
                cellWidth,
                rowHeight - 1,
              )

              context.fillStyle = '#fecdd3'
              context.textAlign = 'center'
              context.textBaseline = 'middle'
              context.font = '10px monospace'
              context.fillText(
                formatNumber(level.bid),
                x - totalWidth / 2 + cellWidth / 2,
                y,
              )

              context.fillStyle = '#a7f3d0'
              context.fillText(
                formatNumber(level.ask),
                x - totalWidth / 2 + cellWidth + 3 + cellWidth / 2,
                y,
              )
            } else if (footprintMode === 'delta') {
              const magnitude = Math.min(
                0.85,
                0.15 + Math.abs(level.delta) / Math.max(1, maxVol) * 3,
              )

              context.fillStyle =
                level.delta > 0
                  ? `rgba(16,185,129,${magnitude})`
                  : level.delta < 0
                    ? `rgba(244,63,94,${magnitude})`
                    : 'rgba(148,163,184,0.15)'

              context.fillRect(
                x - totalWidth / 2,
                cellY,
                totalWidth,
                rowHeight - 1,
              )

              context.fillStyle = '#f8fafc'
              context.font = '10px monospace'
              context.textAlign = 'center'
              context.fillText(
                signed(level.delta),
                x,
                y,
              )
            } else {
              context.fillStyle = 'rgba(56,189,248,0.3)'
              context.fillRect(
                x - totalWidth / 2,
                cellY,
                totalWidth,
                rowHeight - 1,
              )

              context.fillStyle = '#e0f2fe'
              context.font = '10px monospace'
              context.textAlign = 'center'
              context.fillText(
                formatNumber(level.volume),
                x,
                y,
              )
            }
          })
        } else {
          // If candle-level footprint data is unavailable,
          // retain the OHLC chart and show the candle delta.
          context.fillStyle = COLORS.text
          context.textAlign = 'center'
          context.font = '10px monospace'
          context.fillText(
            `Δ ${signed(candle.delta)}`,
            x,
            priceToY(candle.close) - 14,
          )
        }
      }

      if (showVolume) {
        const volumeHeight =
          (candle.volume / maxVol) * (bottom - 20)

        const volumeTop = height - 23 - volumeHeight

        context.fillStyle = bullish
          ? 'rgba(16,185,129,0.45)'
          : 'rgba(244,63,94,0.45)'

        context.fillRect(
          x - Math.max(2, step * 0.24),
          volumeTop,
          Math.max(4, step * 0.48),
          volumeHeight,
        )
      }

      if (step >= 42 || index === visibleCandles.length - 1) {
        context.fillStyle = COLORS.muted
        context.font = '10px monospace'
        context.textAlign = 'center'

        context.fillText(
          candle.time,
          x,
          height - 7,
        )
      }
    })

    // Volume divider.
    if (showVolume) {
      context.strokeStyle = COLORS.border
      context.beginPath()
      context.moveTo(left, height - bottom)
      context.lineTo(width - right, height - bottom)
      context.stroke()
    }
  }, [
    candles,
    visibleCandles,
    mode,
    footprintMode,
    showVolume,
    showPoc,
    containerWidth,
  ])

  const zoomIn = () => setZoom((value) => Math.min(2.5, value + 0.2))
  const zoomOut = () => setZoom((value) => Math.max(0.5, value - 0.2))

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#0c121b] px-3 py-2">
        <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-emerald-500" />
            Nến tăng
          </span>

          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-rose-500" />
            Nến giảm
          </span>

          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-amber-400" />
            POC
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={zoomOut}
            className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
          >
            −
          </button>

          <span className="min-w-12 text-center text-xs text-slate-400">
            {Math.round(zoom * 100)}%
          </span>

          <button
            type="button"
            onClick={zoomIn}
            className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
          >
            +
          </button>

          <button
            type="button"
            onClick={() => {
              setZoom(1)
              setOffset(0)
            }}
            className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
          >
            Reset
          </button>
        </div>
      </div>

      <div
        ref={hostRef}
        className="overflow-hidden"
        onWheel={(event) => {
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            setZoom((value) =>
              Math.max(
                0.5,
                Math.min(2.5, value + (event.deltaY < 0 ? 0.1 : -0.1)),
              ),
            )
          } else {
            setOffset((value) =>
              Math.max(
                0,
                Math.min(candles.length, value + (event.deltaY > 0 ? 1 : -1)),
              ),
            )
          }
        }}
        onPointerDown={(event) => {
          dragRef.current = {
            x: event.clientX,
            offset,
          }

          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (!dragRef.current) return

          const distance = event.clientX - dragRef.current.x
          const unit = Math.max(
            8,
            containerWidth / Math.max(1, visibleCount),
          )

          const shift = Math.round(distance / unit)

          setOffset(
            Math.max(
              0,
              Math.min(
                candles.length,
                dragRef.current.offset + shift,
              ),
            ),
          )
        }}
        onPointerUp={() => {
          dragRef.current = null
        }}
        onPointerCancel={() => {
          dragRef.current = null
        }}
      >
        <canvas
          ref={canvasRef}
          className="block max-w-none touch-pan-y"
          aria-label="Biểu đồ nến và Footprint"
        />
      </div>

      <div className="border-t border-slate-800 px-3 py-2 text-[10px] text-slate-500">
        Kéo ngang để dịch chuyển biểu đồ. Cuộn để xem lịch sử. Giữ Ctrl
        hoặc Cmd và cuộn để zoom.
      </div>
    </div>
  )
}

export default function FootprintPage() {
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_SYMBOLS)
  const [symbol, setSymbol] = useState('FPT')
  const [symbolInput, setSymbolInput] = useState('')
  const [timeframe, setTimeframe] = useState('1m')
  const [showTradeSignal, setShowTradeSignal] = useState(false);
  const [payload, setPayload] = useState<JsonObject>({})
  const [levels, setLevels] = useState<FootprintLevel[]>([])
  const [trades, setTrades] = useState<FootprintTrade[]>([])
  const [candles, setCandles] = useState<FootprintCandle[]>([])
  const [streamStatus, setStreamStatus] = useState<StreamStatus>({})

  const [loading, setLoading] = useState(true)
  const [requestError, setRequestError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [busy, setBusy] = useState(false)

  const [chartMode, setChartMode] = useState<ChartMode>('footprint')
  const [footprintMode, setFootprintMode] =
    useState<FootprintMode>('bid-ask')

  const [showVolume, setShowVolume] = useState(true)
  const [showPoc, setShowPoc] = useState(true)
  const [showTrades, setShowTrades] = useState(true)
  const [showProfile, setShowProfile] = useState(true)

  const requestLock = useRef(false)
  const mounted = useRef(false)
  const activeSymbol = useRef(symbol)
  const activeTimeframe = useRef(timeframe)

  useEffect(() => {
    activeSymbol.current = symbol
    activeTimeframe.current = timeframe
  }, [symbol, timeframe])

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const response = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(init?.headers || {}),
        },
        cache: 'no-store',
      })

      const text = await response.text()

      let body: any = {}

      try {
        body = text ? JSON.parse(text) : {}
      } catch {
        body = { message: text }
      }

      if (!response.ok) {
        throw new Error(
          body?.error ||
            body?.message ||
            `HTTP ${response.status}`,
        )
      }

      return body
    },
    [],
  )

  const loadSymbols = useCallback(async () => {
    try {
      const data = await api('/api/footprint/symbols')

      if (!mounted.current) return

      setSymbols(normalizeSymbols(data))
    } catch {
      // Giữ danh sách mã mặc định nếu API danh sách chưa sẵn sàng.
    }
  }, [api])

  const loadAll = useCallback(
    async (currentSymbol: string, currentTimeframe: string) => {
      if (requestLock.current) return

      requestLock.current = true

      try {
        const encoded = encodeURIComponent(currentSymbol)
        const tf = encodeURIComponent(currentTimeframe)

        const results = await Promise.allSettled([
          api(`/api/footprint/${encoded}`),
          api(`/api/footprint/${encoded}/trades`),
          api(
            `/api/footprint/${encoded}/candles?timeframe=${tf}`,
          ),
          api('/api/footprint/stream/status'),
        ])

        if (
          !mounted.current ||
          activeSymbol.current !== currentSymbol ||
          activeTimeframe.current !== currentTimeframe
        ) {
          return
        }

        const [
          bookResult,
          tradesResult,
          candlesResult,
          statusResult,
        ] = results

        if (bookResult.status === 'fulfilled') {
          const data = normalizePayload(bookResult.value)

          setPayload(data)
          setLevels(normalizeLevels(data))
          setRequestError('')
        } else {
          setRequestError(
            bookResult.reason?.message ||
              'Không tải được dữ liệu Footprint.',
          )
        }

        if (tradesResult.status === 'fulfilled') {
          setTrades(normalizeTrades(tradesResult.value))
        }

        if (candlesResult.status === 'fulfilled') {
          setCandles(normalizeCandles(candlesResult.value))
        }

        if (statusResult.status === 'fulfilled') {
          setStreamStatus(normalizePayload(statusResult.value))
        }

        setLastUpdated(new Date())
      } catch (error: any) {
        if (mounted.current) {
          setRequestError(
            error?.message || 'Không kết nối được backend.',
          )
        }
      } finally {
        requestLock.current = false

        if (mounted.current) setLoading(false)
      }
    },
    [api],
  )

  useEffect(() => {
    mounted.current = true
    void loadSymbols()

    return () => {
      mounted.current = false
    }
  }, [loadSymbols])

  useEffect(() => {
    setLoading(true)
    void loadAll(symbol, timeframe)

    if (!autoRefresh) return

    const timer = window.setInterval(() => {
      void loadAll(symbol, timeframe)
    }, 1500)

    return () => window.clearInterval(timer)
  }, [symbol, timeframe, autoRefresh, loadAll])

  const applySymbol = (value: string) => {
    const next = value.trim().toUpperCase()
    if (!next) return

    setSymbol(next)
    setSymbolInput('')
    setActionMessage('')
  }

  const controlStream = async (action: 'start' | 'stop') => {
    setBusy(true)

    setActionMessage(
      action === 'start'
        ? 'Đang yêu cầu backend khởi động stream...'
        : 'Đang yêu cầu backend dừng stream...',
    )

    try {
      const result = await api(
        `/api/footprint/stream/${action}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            symbol,
            symbols: [symbol],
          }),
        },
      )

      setActionMessage(
        result?.message ||
          `Đã gửi yêu cầu ${action === 'start' ? 'khởi động' : 'dừng'} stream.`,
      )

      await loadAll(symbol, timeframe)
    } catch (error: any) {
      setActionMessage(
        `${action === 'start' ? 'Không khởi động' : 'Không dừng'} được stream: ${
          error?.message || 'Lỗi không xác định'
        }`,
      )
    } finally {
      setBusy(false)
    }
  }

  const totalBid = useMemo(
    () => levels.reduce((sum, row) => sum + row.bid, 0),
    [levels],
  )

  const totalAsk = useMemo(
    () => levels.reduce((sum, row) => sum + row.ask, 0),
    [levels],
  )

  const totalVolume = useMemo(
    () =>
      levels.reduce(
        (sum, row) => sum + (row.volume || row.bid + row.ask),
        0,
      ),
    [levels],
  )

  const totalDelta = useMemo(
    () => levels.reduce((sum, row) => sum + row.delta, 0),
    [levels],
  )

  const candleVolume = useMemo(
    () => candles.reduce((sum, candle) => sum + candle.volume, 0),
    [candles],
  )

  const candleDelta = useMemo(
    () => candles.reduce((sum, candle) => sum + candle.delta, 0),
    [candles],
  )

  const cumulativeDelta = asNumber(
    firstValue(payload, [
      'cumulative_delta',
      'cumulativeDelta',
      'cum_delta',
    ]),
    Number.NaN,
  )

  const lastCandle = candles[candles.length - 1]

  const lastPrice = asNumber(
    firstValue(payload, [
      'last_price',
      'lastPrice',
      'price',
      'close',
    ]),
    lastCandle?.close || 0,
  )

  const referencePrice = asNumber(
    firstValue(payload, [
      'reference_price',
      'referencePrice',
      'ref_price',
    ]),
  )

  const change = asNumber(
    firstValue(payload, ['change', 'price_change']),
    lastPrice && referencePrice
      ? lastPrice - referencePrice
      : 0,
  )

  const changePercent = asNumber(
    firstValue(payload, [
      'change_percent',
      'changePercent',
      'pct_change',
    ]),
    referencePrice ? (change / referencePrice) * 100 : 0,
  )

  const statusText = String(
    firstValue(
      streamStatus,
      ['status', 'state', 'message'],
      'Chưa xác định',
    ),
  )

  const isConnected =
    streamStatus.connected === true ||
    streamStatus.running === true ||
    ['connected', 'running', 'active', 'started', 'online'].includes(
      statusText.toLowerCase(),
    )

  const tradeCount = asNumber(
    firstValue(streamStatus, [
      'trade_count',
      'trades_received',
      'received_count',
    ]),
    trades.length,
  )

 const profile = useMemo(() => {
  const volumeByPrice = new Map<number, number>();

  for (const level of levels) {
    const price = Number(level.price);
    const bid = Number(level.bid ?? 0);
    const ask = Number(level.ask ?? 0);

    const volume = Number.isFinite(Number(level.volume))
      ? Number(level.volume)
      : bid + ask;

    if (
      !Number.isFinite(price) ||
      !Number.isFinite(volume) ||
      volume < 0
    ) {
      continue;
    }

    volumeByPrice.set(
      price,
      (volumeByPrice.get(price) ?? 0) + volume
    );
  }

  return Array.from(volumeByPrice, ([price, volume]) => ({
    price,
    volume,
  })).sort((a, b) => a.price - b.price);
}, [levels]);

  const maxProfile = Math.max(
    1,
    ...profile.map((item) => item.volume),
  )

  const pocPrice = profile[0]?.price

  return (
    <main className="min-h-screen bg-[#080d14] p-3 text-slate-100 sm:p-5">
      <div className="mx-auto max-w-[1900px] space-y-4">
        <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-[#101722] p-4 xl:flex-row xl:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-sky-500/15 px-2 py-1 text-xs font-black text-sky-400">
                LHP-FI
              </span>

              <span className="text-[10px] font-semibold tracking-[0.2em] text-slate-500">
                ORDER FLOW TERMINAL
              </span>

              <span
                className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                  isConnected
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-amber-500/10 text-amber-400'
                }`}
              >
                {isConnected ? '● LIVE' : '● OFFLINE / UNKNOWN'}
              </span>
            </div>

            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              Footprint <span className="text-sky-400">Market</span>
            </h1>

            <p className="mt-1 text-xs text-slate-500">
              Phân tích dòng tiền, Volume, Bid × Ask và Delta theo từng mức giá.
            </p>
          </div>
                
          <div className="flex flex-wrap items-center gap-2">
            <button
            type="button"
            onClick={() => setShowTradeSignal((prev) => !prev)}
            aria-expanded={showTradeSignal}
            className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
              showTradeSignal
                ? 'border-sky-400/40 bg-sky-500/15 text-sky-400'
                : 'border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {showTradeSignal ? '✕ Ẩn tín hiệu' : '◈ Tín hiệu giao dịch'}
          </button>
            <button
              type="button"
              onClick={() => void loadAll(symbol, timeframe)}
              disabled={loading}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold hover:bg-slate-800 disabled:opacity-50"
            >
              ↻ Làm mới
            </button>

            <button
              type="button"
              onClick={() => setAutoRefresh((value) => !value)}
              className={`rounded-lg px-3 py-2 text-xs font-bold ${
                autoRefresh
                  ? 'bg-sky-500 text-slate-950'
                  : 'border border-slate-700 text-slate-300'
              }`}
            >
              {autoRefresh ? '● AUTO ON' : 'AUTO OFF'}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => void controlStream('start')}
              className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              ▶ START
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => void controlStream('stop')}
              className="rounded-lg border border-rose-500/40 px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
            >
              ■ STOP
            </button>
          </div>
        </header>
         {showTradeSignal && (
          <div className="mt-3 rounded-2xl border border-slate-800 bg-[#101722] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">
                TRADE SIGNAL
              </h2>

              <button
                type="button"
                onClick={() => setShowTradeSignal(false)}
                className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ✕ Đóng
              </button>
            </div>

            <TradeSignalPanel
              symbol={symbol}
              candle={lastCandle}
              profile={levels}
            />
          </div>
        )}     
        {actionMessage && (
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">
            {actionMessage}
          </div>
        )}

        {requestError && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <div className="font-bold">
              Không tải được dữ liệu Footprint
            </div>
            <div className="mt-1 break-words">{requestError}</div>
            <div className="mt-2 text-xs text-rose-200/70">
              Kiểm tra backend, endpoint API và cấu trúc JSON trả về.
            </div>
          </div>
        )}

        <section className="grid grid-cols-1 gap-3 rounded-xl border border-slate-800 bg-[#101722] p-3 md:grid-cols-2 xl:grid-cols-[180px_1fr_auto_auto]">
          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Mã giao dịch
            </label>

            <select
              value={symbol}
              onChange={(event) => applySymbol(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#080d14] px-3 py-2.5 text-sm font-black outline-none focus:border-sky-500"
            >
              {symbols.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}

              {!symbols.includes(symbol) && (
                <option value={symbol}>{symbol}</option>
              )}
            </select>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              applySymbol(symbolInput)
            }}
          >
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Tìm mã
            </label>

            <div className="flex gap-2">
              <input
                value={symbolInput}
                onChange={(event) => setSymbolInput(event.target.value)}
                placeholder="Nhập mã cổ phiếu..."
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-[#080d14] px-3 py-2.5 text-sm uppercase outline-none focus:border-sky-500"
              />

              <button
                type="submit"
                className="rounded-lg bg-slate-700 px-4 text-xs font-bold hover:bg-slate-600"
              >
                CHỌN
              </button>
            </div>
          </form>

          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Timeframe
            </label>

            <div className="flex flex-wrap gap-1.5">
              {TIMEFRAMES.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  onClick={() => setTimeframe(item.value)}
                  className={`rounded-lg px-3 py-2.5 text-xs font-bold ${
                    timeframe === item.value
                      ? 'bg-sky-500 text-slate-950'
                      : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setShowVolume((value) => !value)}
              className={`rounded-lg px-3 py-2.5 text-xs font-bold ${
                showVolume
                  ? 'bg-slate-700 text-white'
                  : 'border border-slate-700 text-slate-400'
              }`}
            >
              VOL
            </button>

            <button
              type="button"
              onClick={() => setShowPoc((value) => !value)}
              className={`rounded-lg px-3 py-2.5 text-xs font-bold ${
                showPoc
                  ? 'bg-amber-400/15 text-amber-400'
                  : 'border border-slate-700 text-slate-400'
              }`}
            >
              POC
            </button>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Metric
            label="Symbol"
            value={symbol}
            sub={`Timeframe ${timeframe}`}
            tone="blue"
          />

          <Metric
            label="Last Price"
            value={lastPrice ? formatPrice(lastPrice) : '—'}
            sub={lastCandle ? `Nến ${lastCandle.time}` : 'Giá mới nhất'}
          />

          <Metric
            label="Change"
            value={`${change > 0 ? '+' : ''}${formatPrice(change)}`}
            sub={`${changePercent > 0 ? '+' : ''}${formatNumber(changePercent, 2)}%`}
            tone={change > 0 ? 'green' : change < 0 ? 'red' : 'neutral'}
          />

          <Metric
            label="Footprint Volume"
            value={formatNumber(totalVolume)}
            sub={`${levels.length} mức giá`}
          />

          <Metric
            label="Net Delta"
            value={signed(totalDelta)}
            sub={`Bid ${formatNumber(totalBid)} / Ask ${formatNumber(totalAsk)}`}
            tone={totalDelta > 0 ? 'green' : totalDelta < 0 ? 'red' : 'neutral'}
          />

          <Metric
            label="Cumulative Delta"
            value={
              Number.isFinite(cumulativeDelta)
                ? signed(cumulativeDelta)
                : '—'
            }
            sub="Theo dữ liệu backend"
            tone={
              cumulativeDelta > 0
                ? 'green'
                : cumulativeDelta < 0
                  ? 'red'
                  : 'neutral'
            }
          />
        </section>
     
        <Panel
          title="MARKET CHART"
          subtitle={`${symbol} · ${timeframe} · Biểu đồ nến và Footprint`}
          right={
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setChartMode('footprint')}
                className={`rounded-lg px-3 py-2 text-xs font-bold ${
                  chartMode === 'footprint'
                    ? 'bg-sky-500 text-slate-950'
                    : 'border border-slate-700 text-slate-300'
                }`}
              >
                FOOTPRINT
              </button>

              <button
                type="button"
                onClick={() => setChartMode('candles')}
                className={`rounded-lg px-3 py-2 text-xs font-bold ${
                  chartMode === 'candles'
                    ? 'bg-sky-500 text-slate-950'
                    : 'border border-slate-700 text-slate-300'
                }`}
              >
                CANDLES
              </button>

              {chartMode === 'footprint' && (
                <select
                  value={footprintMode}
                  onChange={(event) =>
                    setFootprintMode(event.target.value as FootprintMode)
                  }
                  className="rounded-lg border border-slate-700 bg-[#080d14] px-3 py-2 text-xs"
                >
                  <option value="bid-ask">Bid × Ask</option>
                  <option value="delta">Delta</option>
                  <option value="volume">Volume</option>
                </select>
              )}
            </div>
          }
        >
          {candles.length === 0 ? (
            <EmptyState
              text={
                loading
                  ? 'Đang tải dữ liệu nến...'
                  : 'Chưa có dữ liệu nến. Kiểm tra API candles của backend.'
              }
            />
          ) : (
            <FootprintChart
              candles={candles}
              mode={chartMode}
              footprintMode={footprintMode}
              showVolume={showVolume}
              showPoc={showPoc}
            />
          )}

          <div className="grid grid-cols-2 gap-3 border-t border-slate-800 p-3 md:grid-cols-4">
            <Metric
              label="Nến đang tải"
              value={formatNumber(candles.length)}
            />

            <Metric
              label="Volume lịch sử"
              value={formatNumber(candleVolume)}
            />

            <Metric
              label="Delta các nến"
              value={signed(candleDelta)}
              tone={
                candleDelta > 0
                  ? 'green'
                  : candleDelta < 0
                    ? 'red'
                    : 'neutral'
              }
            />

            <Metric
              label="POC"
              value={
                pocPrice !== undefined
                  ? formatPrice(pocPrice)
                  : '—'
              }
              sub="Từ các mức giá có dữ liệu Volume Profile"
              tone="yellow"
            />
          </div>
        </Panel>

        <section className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.7fr)]">
          <Panel
            title="FOOTPRINT LADDER"
            subtitle="Bid × Ask · Delta tại từng mức giá"
          >
            {levels.length === 0 ? (
              <EmptyState text="Backend chưa trả về levels hoặc price_levels." />
            ) : (
              <div className="max-h-[620px] overflow-auto">
                <table className="w-full min-w-[520px] border-collapse text-xs tabular-nums">
                  <thead className="sticky top-0 z-10 bg-[#0c121b] text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-3 text-right">Bid</th>
                      <th className="px-3 py-3 text-center">Price</th>
                      <th className="px-3 py-3 text-left">Ask</th>
                      <th className="px-3 py-3 text-right">Delta</th>
                      <th className="px-3 py-3 text-right">Volume</th>
                    </tr>
                  </thead>

                  <tbody>
                    {levels.map((row, index) => {
                      const maxCell = Math.max(
                        1,
                        ...levels.map((level) =>
                          Math.max(level.bid, level.ask),
                        ),
                      )

                      const bidWidth = (row.bid / maxCell) * 100
                      const askWidth = (row.ask / maxCell) * 100

                      return (
                        <tr
                          key={`${row.price}-${index}`}
                          className="border-t border-slate-800/70 hover:bg-white/[0.025]"
                        >
                          <td className="relative overflow-hidden px-3 py-2.5 text-right text-rose-300">
                            <div
                              className="absolute inset-y-1 right-0 rounded-l bg-rose-500/20"
                              style={{ width: `${bidWidth}%` }}
                            />

                            <span className="relative font-semibold">
                              {formatNumber(row.bid)}
                            </span>
                          </td>

                          <td className="whitespace-nowrap border-x border-slate-800 bg-[#0c121b] px-3 py-2.5 text-center font-bold">
                            {formatPrice(row.price)}
                          </td>

                          <td className="relative overflow-hidden px-3 py-2.5 text-left text-emerald-300">
                            <div
                              className="absolute inset-y-1 left-0 rounded-r bg-emerald-500/20"
                              style={{ width: `${askWidth}%` }}
                            />

                            <span className="relative font-semibold">
                              {formatNumber(row.ask)}
                            </span>
                          </td>

                          <td
                            className={`px-3 py-2.5 text-right font-bold ${
                              row.delta > 0
                                ? 'text-emerald-400'
                                : row.delta < 0
                                  ? 'text-rose-400'
                                  : 'text-slate-400'
                            }`}
                          >
                            {signed(row.delta)}
                          </td>

                          <td className="px-3 py-2.5 text-right text-slate-300">
                            {formatNumber(row.volume)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>

                  <tfoot className="sticky bottom-0 border-t border-slate-700 bg-[#0c121b] font-bold">
                    <tr>
                      <td className="px-3 py-3 text-right text-rose-300">
                        {formatNumber(totalBid)}
                      </td>

                      <td className="px-3 py-3 text-center">
                        TOTAL
                      </td>

                      <td className="px-3 py-3 text-left text-emerald-300">
                        {formatNumber(totalAsk)}
                      </td>

                      <td
                        className={`px-3 py-3 text-right ${
                          totalDelta >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {signed(totalDelta)}
                      </td>

                      <td className="px-3 py-3 text-right">
                        {formatNumber(totalVolume)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="VOLUME PROFILE"
            subtitle="Phân bổ Volume theo giá trong dữ liệu đang tải"
            right={
              <button
                type="button"
                onClick={() => setShowProfile((value) => !value)}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs"
              >
                {showProfile ? 'Ẩn' : 'Hiện'}
              </button>
            }
          >
            {!showProfile ? (
              <EmptyState text="Volume Profile đang được ẩn." />
            ) : profile.length === 0 ? (
              <EmptyState text="Chưa có Volume Profile từ dữ liệu Footprint." />
            ) : (
              <div className="space-y-2 p-4">
                {profile.map((item, index) => {
                  const width =
                    (item.volume / maxProfile) * 100

                  const isPoc = item.price === pocPrice

                  return (
                    <div
                      key={`${item.price}-${index}`}
                      className="grid grid-cols-[70px_minmax(0,1fr)_75px] items-center gap-2 text-[11px]"
                    >
                      <span
                        className={`text-right ${
                          isPoc
                            ? 'font-bold text-amber-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {formatPrice(item.price)}
                      </span>

                      <div className="h-5 overflow-hidden rounded-sm bg-slate-800/60">
                        <div
                          className={`h-full rounded-sm ${
                            isPoc
                              ? 'bg-amber-400/80'
                              : 'bg-sky-500/70'
                          }`}
                          style={{ width: `${width}%` }}
                        />
                      </div>

                      <span className="text-right tabular-nums text-slate-300">
                        {formatNumber(item.volume)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="border-t border-slate-800 px-4 py-3 text-[10px] leading-5 text-slate-500">
              POC là mức giá có Volume cao nhất trong tập dữ liệu Profile
              đang hiển thị. Đây không mặc định là POC của toàn bộ phiên.
            </div>
          </Panel>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <Panel
            title="TIME & SALES"
            subtitle="Các giao dịch gần nhất do backend cung cấp"
            right={
              <button
                type="button"
                onClick={() => setShowTrades((value) => !value)}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs"
              >
                {showTrades ? 'Ẩn' : 'Hiện'}
              </button>
            }
          >
            {!showTrades ? (
              <EmptyState text="Time & Sales đang được ẩn." />
            ) : trades.length === 0 ? (
              <EmptyState text="Chưa có giao dịch từ backend." />
            ) : (
              <div className="max-h-[430px] overflow-auto">
                <table className="w-full min-w-[420px] text-xs tabular-nums">
                  <thead className="sticky top-0 bg-[#0c121b] text-[10px] uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-3 text-left">Time</th>
                      <th className="px-3 py-3 text-right">Price</th>
                      <th className="px-3 py-3 text-right">Volume</th>
                      <th className="px-3 py-3 text-center">Side</th>
                    </tr>
                  </thead>

                  <tbody>
                    {trades.map((trade) => {
                      const buy = isPositiveSide(trade.side)
                      const sell = isNegativeSide(trade.side)

                      return (
                        <tr
                          key={trade.id}
                          className="border-t border-slate-800/70"
                        >
                          <td className="px-3 py-2.5 text-slate-400">
                            {trade.time}
                          </td>

                          <td
                            className={`px-3 py-2.5 text-right font-bold ${
                              buy
                                ? 'text-emerald-400'
                                : sell
                                  ? 'text-rose-400'
                                  : 'text-slate-200'
                            }`}
                          >
                            {formatPrice(trade.price)}
                          </td>

                          <td className="px-3 py-2.5 text-right">
                            {formatNumber(trade.volume)}
                          </td>

                          <td className="px-3 py-2.5 text-center">
                            <span
                              className={`rounded px-2 py-1 text-[10px] font-bold ${
                                buy
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : sell
                                    ? 'bg-rose-500/15 text-rose-400'
                                    : 'bg-slate-700 text-slate-300'
                              }`}
                            >
                              {buy ? 'BUY' : sell ? 'SELL' : 'UNKNOWN'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="SYSTEM STATUS"
            subtitle="Trạng thái kết nối và dữ liệu"
          >
            <div className="space-y-3 p-4 text-xs">
              {[
                ['Backend', API_BASE],
                ['Symbol', symbol],
                ['Timeframe', timeframe],
                ['Stream', statusText],
                ['Trades received', formatNumber(tradeCount)],
                ['Footprint levels', formatNumber(levels.length)],
                ['Candles', formatNumber(candles.length)],
                [
                  'Last update',
                  lastUpdated
                    ? lastUpdated.toLocaleTimeString('vi-VN', {
                        hour12: false,
                      })
                    : '—',
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-start justify-between gap-4 border-b border-slate-800 pb-3 last:border-0"
                >
                  <span className="text-slate-500">{label}</span>

                  <span className="max-w-[65%] break-all text-right font-semibold text-slate-200">
                    {value}
                  </span>
                </div>
              ))}

              <div className="rounded-lg border border-slate-700 bg-[#0c121b] p-3 text-[11px] leading-5 text-slate-400">
                <div className="mb-1 font-bold text-slate-200">
                  Data integrity
                </div>

                Giao diện chỉ hiển thị dữ liệu backend cung cấp. Auto Refresh
                không tự sinh tick mới. Nếu cần cập nhật từng giao dịch,
                backend phải duy trì kết nối nguồn dữ liệu và chuyển dữ liệu
                mới tới trình duyệt.
              </div>
            </div>
          </Panel>
        </section>

        <details className="rounded-xl border border-slate-800 bg-[#101722]">
          <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-slate-300">
            JSON DEBUG · Backend payload
          </summary>

          <pre className="max-h-96 overflow-auto border-t border-slate-800 p-4 text-[11px] leading-5 text-slate-400">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </details>

        <footer className="pb-4 text-center text-[10px] text-slate-600">
          LHP-FI Footprint Terminal · Order Flow Analytics · Data quality
          depends on the configured market data provider.
        </footer>
      </div>
    </main>
  )
}

