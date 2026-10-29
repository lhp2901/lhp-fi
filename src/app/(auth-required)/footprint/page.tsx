'use client'
import TradeSignalPanel from "@/components/footprint/TradeSignalPanel";
import LiquidityHeatmapToolbar from "@/components/footprint/LiquidityHeatmapToolbar";
import {
  drawLiquidityHeatmap,
  type LiquidityHeatmapPoint,
} from "@/components/footprint/LiquidityHeatmap";
import {
  LIQUIDITY_HEATMAP_DEFAULTS,
  type LiquiditySide,
} from "@/components/footprint/liquidityHeatmapConfig";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

type StreamConnectionState = 'LIVE' | 'CONNECTING' | 'OFFLINE' | 'ERROR';
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

type ChartMode = 'footprint' | 'candles' | 'cdv' | 'heatmap'
type FootprintMode = 'bid-ask' | 'delta' | 'volume'

const API_BASE = (
  process.env.NEXT_PUBLIC_LHP_AI_SERVER_URL ||
  (process.env.NODE_ENV === 'development'
    ? 'http://127.0.0.1:10000'
    : 'https://lhp-ai-server.onrender.com')
).replace(/\/+$/, '')


const DEFAULT_SYMBOLS = [
  "PNJ",
  "VND",
  "DXG",
 

  // Cổ phiếu bổ sung
  "VIB",
  // Phái sinh


]

const TIMEFRAMES = [
  { label: '1m', value: '1m' },
  { label: '3m', value: '3m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1H', value: '1H' },
  { label: '4H', value: '4H' },
  { label: '1D', value: '1D' },
  { label: '1W', value: '1W' },
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

function formatFootprintValue(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "0"

  return (value * 10).toLocaleString("vi-VN", {
    maximumFractionDigits: 0,
  })
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

function formatChartTime(candle: FootprintCandle, timeframe: string): string {
  const timestamp = toTimestamp(candle.timestamp ?? candle.time)
  if (!timestamp) return candle.time || '—'
  const date = new Date(timestamp)
  const dateText = date.toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  })
  const timeText = date.toLocaleTimeString('vi-VN', {
    hour12: false, hour: '2-digit', minute: '2-digit',
  })
  // TradingView-style date context: intraday labels show date when crossing sessions;
  // daily/weekly candles always show the actual calendar date.
  return ['1D', '1W'].includes(timeframe.toUpperCase()) ? dateText : `${dateText} ${timeText}`
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

  // Use the Settings/API list as the source of truth. Defaults are only a fallback
  // when the API does not return any symbols.
  return values.length ? [...new Set(values)] : DEFAULT_SYMBOLS
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

  const orderedRows = [...rows].sort((a: any, b: any) =>
    toTimestamp(firstValue(b, ['timestamp', 'time', 'trade_time', 'created_at'])) -
    toTimestamp(firstValue(a, ['timestamp', 'time', 'trade_time', 'created_at']))
  )

  return orderedRows.map((row: any, index: number) => {
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

  const normalized = rows.map((row: any) => {
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

  const byTimestamp = new Map<number, FootprintCandle>()
  for (const candle of normalized) {
    if (Number.isFinite(candle.timestamp)) byTimestamp.set(candle.timestamp, candle)
  }
  return [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp)
}


function timeframeMilliseconds(timeframe: string): number {
  const match = timeframe.toLowerCase().match(/^(\d+)(m|h|d|w)$/)
  if (!match) return 60_000
  const amount = Number(match[1])
  const unit = match[2]
  const unitMs = unit === 'h' ? 3_600_000 : unit === 'd' ? 86_400_000 : unit === 'w' ? 604_800_000 : 60_000
  return amount * unitMs
}

function timeframeBucket(timestamp: number, timeframe: string): number {
  const normalized = timeframe.toLowerCase()
  // Align daily and weekly candles to UTC calendar boundaries. Intraday buckets
  // are epoch-aligned; the market's local offset is a whole-hour offset.
  if (normalized === '1d' || normalized === '1w') {
    const date = new Date(timestamp)
    const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    if (normalized === '1d') return dayStart
    const weekday = new Date(dayStart).getUTCDay() // Sunday = 0
    const daysSinceMonday = (weekday + 6) % 7
    return dayStart - daysSinceMonday * 86_400_000
  }
  const interval = timeframeMilliseconds(timeframe)
  return Math.floor(timestamp / interval) * interval
}

/**
 * Aggregate source candles into the selected chart interval.
 * This preserves OHLCV and combines footprint levels by price.
 * Session alignment uses epoch buckets; for Vietnam intraday timestamps this
 * aligns to local clock boundaries because the timezone offset is whole hours.
 */
function aggregateCandles(
  source: FootprintCandle[],
  timeframe: string,
): FootprintCandle[] {
  const interval = timeframeMilliseconds(timeframe)
  if (interval <= 60_000) return source

  const groups = new Map<number, FootprintCandle[]>()
  for (const candle of source) {
    if (!Number.isFinite(candle.timestamp) || candle.timestamp <= 0) continue
    const bucket = timeframeBucket(candle.timestamp, timeframe)
    const list = groups.get(bucket) ?? []
    list.push(candle)
    groups.set(bucket, list)
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([timestamp, group]) => {
      group.sort((a, b) => a.timestamp - b.timestamp)
      const levelMap = new Map<number, FootprintLevel>()
      for (const candle of group) {
        for (const level of candle.levels ?? []) {
          const current = levelMap.get(level.price)
          if (current) {
            current.bid += level.bid
            current.ask += level.ask
            current.volume += level.volume
            current.delta += level.delta
          } else {
            levelMap.set(level.price, {
              ...level,
              cumulativeDelta: 0,
            })
          }
        }
      }
      const levels = [...levelMap.values()].sort((a, b) => b.price - a.price)
      let cumulative = 0
      for (const level of [...levels].reverse()) {
        cumulative += level.delta
        level.cumulativeDelta = cumulative
      }
      const first = group[0]
      const last = group[group.length - 1]
      const volume = group.reduce((sum, c) => sum + c.volume, 0)
      const bidVolume = group.reduce((sum, c) => sum + c.bidVolume, 0)
      const askVolume = group.reduce((sum, c) => sum + c.askVolume, 0)
      return {
        timestamp,
        time: formatTime(timestamp),
        open: first.open,
        high: Math.max(...group.map((c) => c.high)),
        low: Math.min(...group.map((c) => c.low)),
        close: last.close,
        volume,
        bidVolume,
        askVolume,
        delta: group.reduce((sum, c) => sum + c.delta, 0),
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
  timeframe,
  footprintMode,
  showVolume,
  showPoc,
  liquidityPoints,
  heatmapIntensity,
  heatmapThreshold,
  liquiditySide,
  profilePoc,
  profileVah,
  profileVal,
  showProfilePoc,
  showValueArea,
}: {
  candles: FootprintCandle[]
  mode: ChartMode
  timeframe: string
  footprintMode: FootprintMode
  showVolume: boolean
  showPoc: boolean
  liquidityPoints: LiquidityHeatmapPoint[]
  heatmapIntensity: number
  heatmapThreshold: number
  liquiditySide: LiquiditySide
  profilePoc?: number
  profileVah?: number
  profileVal?: number
  showProfilePoc: boolean
  showValueArea: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState(0)
  const [priceScale, setPriceScale] = useState(1)
  const [pricePan, setPricePan] = useState(0)
  const dragRef = useRef<{
    x: number
    y: number
    offset: number
    kind: 'time' | 'price'
    priceScale: number
    pricePan: number
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
    Math.floor((containerWidth - 76) / (mode === 'footprint' ? 108 : mode === 'heatmap' ? 28 : 18) / zoom),
  )

  // Calculate CDV over the entire loaded series before applying viewport slicing.
  const chartCandles = useMemo(() => {
    if (mode !== 'cdv') return candles
    let cumulative = 0
    return candles.map((candle) => {
      const open = cumulative
      cumulative += candle.delta
      const close = cumulative
      return {
        ...candle,
        open,
        close,
        high: Math.max(open, close),
        low: Math.min(open, close),
        levels: [],
      }
    })
  }, [candles, mode])

  const visibleCandles = useMemo(() => {
    const end = Math.max(0, chartCandles.length - offset)
    const start = Math.max(0, end - visibleCount)
    return chartCandles.slice(start, end)
  }, [chartCandles, offset, visibleCount])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    const width = Math.max(containerWidth, 320)
    const height = 540
    const ratio = Math.min(2, window.devicePixelRatio || 1)

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
    ]).concat(
      mode === 'heatmap'
        ? liquidityPoints
            .filter((point) =>
              point.timestamp >= (visibleCandles[0]?.timestamp ?? 0) &&
              point.timestamp <= (visibleCandles[visibleCandles.length - 1]?.timestamp ?? 0),
            )
            .map((point) => point.price)
        : [],
    ).concat(
      [showProfilePoc ? profilePoc : undefined,
       showValueArea ? profileVah : undefined,
       showValueArea ? profileVal : undefined]
        .filter((price): price is number => price != null && Number.isFinite(price)),
    ).filter(Number.isFinite)

    let minPrice = Math.min(...allPrices)
    let maxPrice = Math.max(...allPrices)

    if (minPrice === maxPrice) {
      minPrice -= 1
      maxPrice += 1
    }

    const padding = (maxPrice - minPrice) * 0.06
    minPrice -= padding
    maxPrice += padding

    // TradingView-like manual price scale: drag the right axis vertically to
    // change scale, and use wheel over the axis for vertical zoom.
    const baseRange = Math.max(Number.EPSILON, maxPrice - minPrice)
    const center = (maxPrice + minPrice) / 2 + pricePan * baseRange
    const scaledRange = baseRange / Math.max(0.25, Math.min(8, priceScale))
    minPrice = center - scaledRange / 2
    maxPrice = center + scaledRange / 2

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

    // Historical L2 liquidity is rendered beneath price candles.
    if (mode === 'heatmap') {
      drawLiquidityHeatmap({
        context,
        points: liquidityPoints,
        candles: visibleCandles,
        left,
        top,
        chartWidth,
        chartHeight: priceHeight,
        step,
        minPrice,
        maxPrice,
        priceToY,
        intensity: heatmapIntensity,
        threshold: heatmapThreshold,
        side: liquiditySide,
      })
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

      if (mode === 'candles' || mode === 'cdv' || mode === 'heatmap') {
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

        // BID × ASK is the only mode that paints per-price Numbers Bars.
        // DELTA and VOLUME are candle-level modes: render exactly one value
        // for the candle, not repeated values for every price level.
        if (footprintMode === 'bid-ask') {
          if (levels.length) {
            const rowHeight = Math.max(
              12,
              Math.min(24, priceHeight / Math.max(1, levels.length)),
            )
            const cellWidth = Math.max(42, Math.min(64, step * 0.48))
            const totalWidth = cellWidth * 2 + 4

            levels.forEach((level) => {
              const y = priceToY(level.price)
              const cellY = y - rowHeight / 2
              if (y < top || y > top + priceHeight) return

              const maxLevelVolume = Math.max(1, maxVol)
              const bidAlpha = Math.min(0.92, 0.16 + level.bid / maxLevelVolume * 2.8)
              const askAlpha = Math.min(0.92, 0.16 + level.ask / maxLevelVolume * 2.8)
              const askImbalance = level.ask >= Math.max(10, level.bid * 3)
              const bidImbalance = level.bid >= Math.max(10, level.ask * 3)

              context.fillStyle = `rgba(244,63,94,${bidAlpha})`
              context.fillRect(x - totalWidth / 2, cellY, cellWidth, rowHeight - 1)
              context.fillStyle = `rgba(16,185,129,${askAlpha})`
              context.fillRect(x - totalWidth / 2 + cellWidth + 4, cellY, cellWidth, rowHeight - 1)

              if (askImbalance || bidImbalance) {
                context.strokeStyle = askImbalance ? '#34d399' : '#fb7185'
                context.lineWidth = 1.5
                context.strokeRect(x - totalWidth / 2, cellY, totalWidth, rowHeight - 1)
              }

              context.font = 'bold 11px monospace'
              context.textAlign = 'center'
              context.textBaseline = 'middle'
              context.fillStyle = '#fff1f2'
              context.fillText(formatNumber(level.bid), x - totalWidth / 2 + cellWidth / 2, y)
              context.fillStyle = '#d1fae5'
              context.fillText(formatNumber(level.ask), x - totalWidth / 2 + cellWidth + 4 + cellWidth / 2, y)
            })
          } else {
            context.fillStyle = COLORS.text
            context.textAlign = 'center'
            context.font = 'bold 10px monospace'
            context.fillText('BID × ASK · NO LEVELS', x, priceToY(candle.close) - 14)
          }
        } else {
          const candleValue = footprintMode === 'delta'
            ? candle.delta
            : candle.volume
          const positive = footprintMode === 'delta'
            ? candleValue >= 0
            : candle.close >= candle.open
          const label = footprintMode === 'delta'
            ? signed(candleValue)
            : formatNumber(candleValue)
          const y = priceToY(candle.close)
          const valueWidth = Math.min(Math.max(48, step - 4), 100)
          const valueHeight = 24

          context.fillStyle = footprintMode === 'delta'
            ? (candleValue >= 0 ? 'rgba(16,185,129,0.28)' : 'rgba(244,63,94,0.28)')
            : (positive ? 'rgba(16,185,129,0.28)' : 'rgba(244,63,94,0.28)')
          context.fillRect(x - valueWidth / 2, y - valueHeight / 2, valueWidth, valueHeight)
          context.strokeStyle = footprintMode === 'delta'
            ? (candleValue >= 0 ? 'rgba(16,185,129,0.75)' : 'rgba(244,63,94,0.75)')
            : 'rgba(148,163,184,0.35)'
          context.strokeRect(x - valueWidth / 2, y - valueHeight / 2, valueWidth, valueHeight)

          context.fillStyle = '#f8fafc'
          context.font = 'bold 11px monospace'
          context.textAlign = 'center'
          context.textBaseline = 'middle'
          context.fillText(label, x, y)
        }

        // Compact per-candle Delta / Total summary, similar to Numbers Bars charts.
        if (mode === 'footprint' && step >= 42) {
          // Summary reflects the candle aggregate, not a recomputation from
          // displayed levels (which can be partial or price-step grouped).
          const total = candle.volume
          const delta = candle.delta
          const badgeWidth = Math.min(step - 4, 106)
          const badgeHeight = 30
          const badgeX = x - badgeWidth / 2
          const badgeY = Math.min(height - bottom + 4, top + priceHeight + 4)
          context.fillStyle = 'rgba(15,23,42,0.94)'
          context.fillRect(badgeX, badgeY, badgeWidth, badgeHeight)
          context.strokeStyle = COLORS.border
          context.strokeRect(badgeX, badgeY, badgeWidth, badgeHeight)
          context.font = '9px monospace'
          context.textAlign = 'center'
          context.textBaseline = 'middle'
          context.fillStyle = delta >= 0 ? '#34d399' : '#fb7185'
          context.fillText(`Δ ${signed(delta)}`, x, badgeY + 9)
          context.fillStyle = '#e2e8f0'
          context.fillText(`Σ ${formatNumber(total)}`, x, badgeY + 21)
        }
      }

      // Mark the strongest price-level delta zones (default threshold: 500,000 shares).
      // Positive delta = aggressive buying; negative delta = aggressive selling.
      if (mode === 'footprint' && candle.levels.length) {
        const deltaThreshold = 500_000
        const buyLevel = candle.levels
          .filter((level) => level.delta >= deltaThreshold)
          .reduce<FootprintLevel | null>((best, level) => !best || level.delta > best.delta ? level : best, null)
        const sellLevel = candle.levels
          .filter((level) => level.delta <= -deltaThreshold)
          .reduce<FootprintLevel | null>((best, level) => !best || level.delta < best.delta ? level : best, null)

        const drawDeltaBadge = (level: FootprintLevel, isBuy: boolean) => {
          const markerY = priceToY(level.price)
          const label = `${isBuy ? 'BUY Δ' : 'SELL Δ'} ${signed(level.delta)}`
          const badgeWidth = Math.min(112, Math.max(72, label.length * 6.1))
          const badgeX = Math.min(width - right - badgeWidth - 2, x + step * 0.42)
          context.fillStyle = isBuy ? 'rgba(5,150,105,0.95)' : 'rgba(225,29,72,0.95)'
          context.fillRect(badgeX, markerY - 9, badgeWidth, 18)
          context.fillStyle = '#ffffff'
          context.font = 'bold 9px monospace'
          context.textAlign = 'center'
          context.textBaseline = 'middle'
          context.fillText(label, badgeX + badgeWidth / 2, markerY)
          context.strokeStyle = isBuy ? 'rgba(16,185,129,0.9)' : 'rgba(244,63,94,0.9)'
          context.setLineDash([2, 2])
          context.beginPath()
          context.moveTo(left, markerY)
          context.lineTo(badgeX, markerY)
          context.stroke()
          context.setLineDash([])
        }
        if (buyLevel) drawDeltaBadge(buyLevel, true)
        if (sellLevel) drawDeltaBadge(sellLevel, false)
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
          formatChartTime(candle, timeframe),
          x,
          height - 7,
        )
      }
    })

    // Volume Profile levels use the exact same priceToY transform as candles and axis.
    // Draw them last so they remain visible above the footprint cells.
    const drawProfileLevel = (price: number | undefined, label: string, color: string, dashed: number[]) => {
      if (price == null || !Number.isFinite(price) || price < minPrice || price > maxPrice) return
      const y = priceToY(price)
      context.save()
      context.strokeStyle = color
      context.fillStyle = color
      context.lineWidth = label === 'POC' ? 1.8 : 1.35
      context.setLineDash(dashed)
      context.beginPath()
      context.moveTo(left, y)
      context.lineTo(width - right, y)
      context.stroke()
      context.setLineDash([])
      const tagWidth = 48
      const tagHeight = 16
      const tagX = width - right + 4
      context.fillRect(tagX, y - tagHeight / 2, tagWidth, tagHeight)
      context.fillStyle = '#08111b'
      context.font = 'bold 9px monospace'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(`${label} ${formatPrice(price)}`, tagX + tagWidth / 2, y)
      context.restore()
    }

    if (showProfilePoc) drawProfileLevel(profilePoc, 'POC', '#fbbf24', [5, 3])
    if (showValueArea) {
      drawProfileLevel(profileVah, 'VAH', '#38bdf8', [4, 3])
      drawProfileLevel(profileVal, 'VAL', '#38bdf8', [4, 3])
    }

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
    timeframe,
    footprintMode,
    showVolume,
    showPoc,
    containerWidth,
    liquidityPoints,
    heatmapIntensity,
    heatmapThreshold,
    liquiditySide,
    priceScale,
    pricePan,
    profilePoc,
    profileVah,
    profileVal,
    showProfilePoc,
    showValueArea,
  ])

  const zoomIn = () => setZoom((value) => Math.min(8, value + 0.2))
  const zoomOut = () => setZoom((value) => Math.max(0.25, value - 0.2))

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
              setPriceScale(1)
              setPricePan(0)
            }}
            className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
          >
            Reset
          </button>
        </div>
      </div>

      <div
        ref={hostRef}
        className="overflow-hidden select-none touch-none"
        onWheel={(event) => {
          event.preventDefault()
          const rect = event.currentTarget.getBoundingClientRect()
          const overPriceAxis = event.clientX - rect.left >= containerWidth - 76
          if (overPriceAxis) {
            setPriceScale((value) => Math.max(0.25, Math.min(8, value * (event.deltaY < 0 ? 1.12 : 0.89))))
          } else if (event.shiftKey) {
            setOffset((value) =>
              Math.max(0, Math.min(candles.length, value + (event.deltaY > 0 ? 3 : -3))),
            )
          } else {
            // Natural wheel zoom like charting platforms; Shift+wheel pans history.
            setZoom((value) =>
              Math.max(0.25, Math.min(8, value + (event.deltaY < 0 ? 0.12 : -0.12))),
            )
          }
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          const rect = event.currentTarget.getBoundingClientRect()
          const onPriceAxis = event.clientX - rect.left >= containerWidth - 76
          dragRef.current = {
            x: event.clientX,
            y: event.clientY,
            offset,
            kind: onPriceAxis ? 'price' : 'time',
            priceScale,
            pricePan,
          }

          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (!dragRef.current) return

          if (dragRef.current.kind === 'price') {
            const dy = event.clientY - dragRef.current.y
            setPricePan(dragRef.current.pricePan + dy / 540 / Math.max(0.25, dragRef.current.priceScale))
            return
          }

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
        onDoubleClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          if (event.clientX - rect.left >= containerWidth - 76) {
            setPriceScale(1)
            setPricePan(0)
          }
        }}
      >
        <canvas
          ref={canvasRef}
          className="block max-w-none touch-pan-y"
          aria-label="Biểu đồ nến và Footprint"
        />
      </div>

      <div className="border-t border-slate-800 px-3 py-2 text-[10px] text-slate-500">
        Kéo ngang để dịch chuyển biểu đồ. Kéo trục giá bên phải lên/xuống để chỉnh tỷ lệ; cuộn trên trục để zoom dọc; double-click trục để Auto Scale. Cuộn vùng chart để zoom ngang, Shift + cuộn để dịch chuyển lịch sử. Heatmap thể hiện khối lượng giao dịch tại từng mức giá từ dữ liệu footprint.
      </div>
    </div>
  )
}

function VietnamMarketSession() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const parts = now
    ? new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).formatToParts(now)
    : [];
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const weekday = get('weekday');
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));
  const seconds = Number(get('second'));
  const minutes = hour * 60 + minute;
  const isWeekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday);

  let label = 'Đã đóng cửa';
  let tone = 'text-slate-400';
  if (isWeekday && minutes >= 9 * 60 && minutes < 11 * 60 + 30) {
    label = 'Phiên sáng'; tone = 'text-emerald-400';
  } else if (isWeekday && minutes >= 11 * 60 + 30 && minutes < 13 * 60) {
    label = 'Nghỉ trưa'; tone = 'text-amber-400';
  } else if (isWeekday && minutes >= 13 * 60 && minutes < 14 * 60 + 30) {
    label = 'Phiên chiều'; tone = 'text-emerald-400';
  } else if (isWeekday && minutes >= 14 * 60 + 30 && minutes < 14 * 60 + 45) {
    label = 'ATC HOSE'; tone = 'text-sky-400';
  }

  const clock = now
    ? `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : '--:--:--';

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Giờ Việt Nam (UTC+7)</div>
        <div className="font-mono text-lg font-bold text-slate-100">{clock}</div>
      </div>
      <div className="h-8 w-px bg-slate-700" />
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Phiên HOSE</div>
        <div className={`text-sm font-bold ${tone}`}>{label}</div>
      </div>
      <div className="ml-auto text-[10px] text-slate-500">Sáng 09:00–11:30 · Nghỉ 11:30–13:00 · Chiều 13:00–14:30 · ATC 14:30–14:45</div>
    </div>
  );
}

export default function FootprintPage() {
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_SYMBOLS)
  const [symbol, setSymbol] = useState('DXG')
  const [symbolInput, setSymbolInput] = useState('')
  const [timeframe, setTimeframe] = useState('1m')
  // Số lượng nến yêu cầu từ backend; tăng để xem lịch sử sâu hơn nếu DB có dữ liệu.
  const [historyLimit, setHistoryLimit] = useState(5000)
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
  const getStreamConnectionState = (): StreamConnectionState => {
    // API status có thể trả { data: { stream: ..., engine: ... } } hoặc
    // payload đã được normalize; kiểm tra nhiều lớp nhưng không giả LIVE
    // chỉ vì engine.success=true.
    const root = streamStatus as JsonObject;
    const data = (root.data && typeof root.data === 'object' ? root.data : root) as JsonObject;
    const stream = (data.stream && typeof data.stream === 'object' ? data.stream : data) as JsonObject;
    const engine = (data.engine && typeof data.engine === 'object' ? data.engine : {}) as JsonObject;

    const connected = firstValue(stream, [
      'connected', 'is_connected', 'websocket_connected', 'ws_connected',
    ], firstValue(data, ['connected', 'is_connected'], false));
    const authenticated = firstValue(stream, ['authenticated', 'is_authenticated'], false);
    const subscribed = firstValue(stream, ['subscribed', 'is_subscribed'], false);
    const running = firstValue(stream, ['running', 'started', 'is_running'], false);
    const status = String(firstValue(stream, ['status', 'state', 'connection_status'], '')).toLowerCase();
    const error = firstValue(stream, ['last_error', 'error'], firstValue(engine, ['last_error', 'last_persistence_error'], null));

    if (connected === true || (authenticated === true && subscribed === true)) return 'LIVE';
    if (['error', 'failed', 'failure', 'fault'].includes(status) || Boolean(error)) return 'ERROR';
    if (running === true || ['connecting', 'reconnecting', 'starting', 'pending'].includes(status)) return 'CONNECTING';

    // Engine activity means data is being processed, but not necessarily that
    // the websocket is currently connected; keep the state conservative.
    return 'OFFLINE';
  };

  const connectionState = getStreamConnectionState();
  const [chartMode, setChartMode] = useState<ChartMode>('footprint')
  const [liquidityPoints, setLiquidityPoints] = useState<LiquidityHeatmapPoint[]>([])
  const [heatmapIntensity, setHeatmapIntensity] = useState<number>(LIQUIDITY_HEATMAP_DEFAULTS.intensity)
  const [heatmapThreshold, setHeatmapThreshold] = useState<number>(LIQUIDITY_HEATMAP_DEFAULTS.threshold)
  const [liquiditySide, setLiquiditySide] = useState<LiquiditySide>('both')
  const [heatmapFetchStatus, setHeatmapFetchStatus] = useState('Chưa tải Order Book')
  const [footprintMode, setFootprintMode] =
    useState<FootprintMode>('bid-ask')

  const [showVolume, setShowVolume] = useState(true)
  const [showPoc, setShowPoc] = useState(true)
  const [showTrades, setShowTrades] = useState(true)
  const [showProfile, setShowProfile] = useState(true)
  // Profile lookback window, aggregated from historical candles returned by backend.
  const [profileDays, setProfileDays] = useState<1 | 3 | 5 | 10 | 20>(1)
  const [profileWindow, setProfileWindow] = useState<'session' | 'days' | 'visible' | 'custom'>('days')
  const [valueAreaPercent, setValueAreaPercent] = useState(70)
  const [showProfilePoc, setShowProfilePoc] = useState(true)
  const [showValueArea, setShowValueArea] = useState(true)
  const [showHvnLvn, setShowHvnLvn] = useState(true)
  const [profileMode, setProfileMode] = useState<'visible-range' | 'fixed-range'>('visible-range')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const requestLock = useRef(false)
  const mounted = useRef(false)
  const activeSymbol = useRef(symbol)
  const activeTimeframe = useRef(timeframe)

  useEffect(() => {
    activeSymbol.current = symbol
    activeTimeframe.current = timeframe
  }, [symbol, timeframe])

  // Request có timeout để UI không bị treo nếu backend/Render không phản hồi.
  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), 15_000)
      const externalSignal = init?.signal
      const abortFromExternal = () => controller.abort()

      if (externalSignal) {
        if (externalSignal.aborted) controller.abort()
        else externalSignal.addEventListener('abort', abortFromExternal, { once: true })
      }

      try {
        const response = await fetch(`${API_BASE}${path}`, {
          ...init,
          signal: controller.signal,
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
          const detail = body?.error || body?.message || `HTTP ${response.status}`
          throw new Error(`API ${path}: ${detail}`)
        }

        return body
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          throw new Error(`Yêu cầu ${path} quá thời gian chờ (15 giây).`)
        }
        if (error instanceof TypeError) {
          throw new Error(`Không kết nối được backend (${path}). Kiểm tra API server và mạng.`)
        }
        throw error
      } finally {
        window.clearTimeout(timeoutId)
        externalSignal?.removeEventListener('abort', abortFromExternal)
      }
    },
    [],
  )

  // Load persisted L2 liquidity history while Heatmap mode is selected.
  // The backend endpoint is populated only by a real Market Depth collector.
  useEffect(() => {
    if (chartMode !== 'heatmap') return

    let cancelled = false
    const loadLiquidity = async () => {
      try {
        const encoded = encodeURIComponent(symbol)
        const result = await api(
          `/api/footprint/orderbook/${encoded}/history?limit=${LIQUIDITY_HEATMAP_DEFAULTS.maxHistoryRows}`,
        )
        if (cancelled) return
        const raw = Array.isArray(result?.data) ? result.data : []
        const normalized: LiquidityHeatmapPoint[] = raw
          .map((item: any) => ({
            timestamp: toTimestamp(item.timestamp),
            price: asNumber(item.price),
            bidLiquidity: asNumber(item.bidLiquidity),
            askLiquidity: asNumber(item.askLiquidity),
            source: item.source,
          }))
          .filter((item: LiquidityHeatmapPoint) =>
            Number.isFinite(item.timestamp) &&
            Number.isFinite(item.price) &&
            item.price > 0,
          )
        setLiquidityPoints(normalized)
        setHeatmapFetchStatus(
          normalized.length
            ? `L2 ${formatNumber(normalized.length)} mức giá`
            : 'Chưa có dữ liệu Order Book',
        )
      } catch (error: any) {
        if (cancelled) return
        setHeatmapFetchStatus(error?.message || 'Không tải được Order Book')
      }
    }

    void loadLiquidity()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadLiquidity()
    }, LIQUIDITY_HEATMAP_DEFAULTS.refreshMs)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [api, chartMode, symbol])

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

        const results = await Promise.allSettled([
          api(`/api/footprint/${encoded}`),
          api(`/api/footprint/${encoded}/trades?limit=5000&newest_first=true`),
          api(
            `/api/footprint/${encoded}/candles?timeframe=1m&source=auto&limit=${historyLimit}&newest_first=false`,
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
        } else {
          // Preserve last valid tape snapshot; the main book error is reported separately.
          console.warn('[Footprint] Trades endpoint failed:', tradesResult.reason)
        }

        if (candlesResult.status === 'fulfilled') {
          setCandles(aggregateCandles(normalizeCandles(candlesResult.value), currentTimeframe))
        } else {
          console.warn('[Footprint] Candles endpoint failed:', candlesResult.reason)
        }

        if (statusResult.status === 'fulfilled') {
          setStreamStatus(normalizePayload(statusResult.value))
        } else {
          console.warn('[Footprint] Stream status endpoint failed:', statusResult.reason)
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
    [api, historyLimit],
  )

  useEffect(() => {
    mounted.current = true
    void loadSymbols()

    return () => {
      mounted.current = false
    }
  }, [loadSymbols])

  useEffect(() => {
    // Clear data from the previous selection to avoid briefly showing mixed symbols/timeframes.
    setLoading(true)
    setRequestError('')
    setPayload({})
    setLevels([])
    setTrades([])
    setCandles([])

    void loadAll(symbol, timeframe)

    if (!autoRefresh) return

    // Polling is paused while the tab is hidden to reduce unnecessary backend load.
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadAll(symbol, timeframe)
      }
    }, 2000)

    return () => window.clearInterval(timer)
  }, [symbol, timeframe, autoRefresh, loadAll, historyLimit])

  const applySymbol = (value: string) => {
    const next = value.trim().toUpperCase()
    if (!next) return

    setSymbol(next)
    setSymbolInput('')
    setActionMessage('')
  }

  const controlStream = async (action: 'start' | 'stop') => {
    if (busy) return
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

  // Precompute once; avoid recalculating the ladder maximum for every row.
  const maxCell = useMemo(
    () => Math.max(1, ...levels.map((level) => Math.max(level.bid, level.ask))),
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
      'previous_close',
      'prev_close',
      'prior_close',
      'pre_close',
    ]),
    0,
  )

  const priceColorClass =
  lastPrice > referencePrice
    ? "text-green-500"
    : lastPrice < referencePrice
      ? "text-red-500"
      : "text-yellow-400"

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

  const tradeCount = asNumber(
    firstValue(streamStatus, [
      'trade_count',
      'trades_received',
      'received_count',
    ]),
    trades.length,
  )

  const profile = useMemo(() => {
    const volumeByPrice = new Map<number, number>()
    const validCandles = candles.filter((c) => Number.isFinite(c.timestamp) && c.timestamp > 0)
    const newest = validCandles.reduce((latest, c) => Math.max(latest, c.timestamp), 0)
    const dayMs = 24 * 60 * 60 * 1000
    const cutoff = profileWindow === 'session' ? newest - dayMs :
      profileWindow === 'custom' && customStart ? new Date(customStart).getTime() :
      profileWindow === 'visible' ? 0 : newest - profileDays * dayMs
    const end = profileWindow === 'custom' && customEnd ? new Date(customEnd).getTime() : newest
    const chosen = validCandles.filter(c => c.timestamp >= cutoff && c.timestamp <= end)
    const historical = chosen.flatMap(c => c.levels || [])
    const source = historical.length ? historical : levels
    for (const level of source) {
      const price = Number(level.price), bid = Number(level.bid ?? 0), ask = Number(level.ask ?? 0)
      const raw = Number(level.volume), volume = Number.isFinite(raw) ? raw : bid + ask
      if (!Number.isFinite(price) || !Number.isFinite(volume) || volume < 0) continue
      volumeByPrice.set(price, (volumeByPrice.get(price) || 0) + volume)
    }
    return Array.from(volumeByPrice, ([price, volume]) => ({ price, volume })).sort((a,b) => a.price-b.price)
  }, [candles, levels, profileDays, profileWindow, customStart, customEnd])

  const maxProfile = Math.max(1, ...profile.map(item => item.volume))
  const profileTotal = profile.reduce((sum, item) => sum + item.volume, 0)
  const pocIndex = profile.reduce((best, item, i) => best < 0 || item.volume > profile[best].volume || (item.volume === profile[best].volume && item.price < profile[best].price) ? i : best, -1)
  const pocPrice = pocIndex >= 0 ? profile[pocIndex].price : undefined
  let valueAreaLowIndex = pocIndex, valueAreaHighIndex = pocIndex
  let valueAreaVolume = pocIndex >= 0 ? profile[pocIndex].volume : 0
  const valueAreaTarget = profileTotal * valueAreaPercent / 100
  while (pocIndex >= 0 && valueAreaVolume < valueAreaTarget && (valueAreaLowIndex > 0 || valueAreaHighIndex < profile.length - 1)) {
    const below = valueAreaLowIndex > 0 ? profile[valueAreaLowIndex - 1].volume : -1
    const above = valueAreaHighIndex < profile.length - 1 ? profile[valueAreaHighIndex + 1].volume : -1
    if (above > below) { valueAreaHighIndex++; valueAreaVolume += Math.max(0, above) }
    else { valueAreaLowIndex--; valueAreaVolume += Math.max(0, below) }
  }
  const vahPrice = valueAreaHighIndex >= 0 ? profile[valueAreaHighIndex]?.price : undefined
  const valPrice = valueAreaLowIndex >= 0 ? profile[valueAreaLowIndex]?.price : undefined
  const hvnPrices = profile.filter((item, i) => item.volume >= (profile[i-1]?.volume ?? 0) && item.volume >= (profile[i+1]?.volume ?? 0) && item.volume >= maxProfile * 0.65).map(x => x.price)
  const lvnPrices = profile.filter((item, i) => item.volume <= (profile[i-1]?.volume ?? Infinity) && item.volume <= (profile[i+1]?.volume ?? Infinity) && item.volume <= maxProfile * 0.25).map(x => x.price)

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
                connectionState === 'LIVE'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : connectionState === 'CONNECTING'
                    ? 'bg-amber-500/10 text-amber-400'
                    : connectionState === 'ERROR'
                      ? 'bg-rose-500/10 text-rose-300'
                      : 'bg-red-500/10 text-red-400'
              }`}
            >
              {connectionState === 'LIVE'
                ? '● LIVE'
                : connectionState === 'CONNECTING'
                  ? '● CONNECTING'
                  : connectionState === 'ERROR'
                    ? '● ERROR'
                    : '● OFFLINE'}
            </span>

            </div>

            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              Footprint <span className="text-sky-400">Market</span>
            </h1>

            <p className="mt-1 text-xs text-slate-500">
              Phân tích dòng tiền, Volume, Bid × Ask và Delta theo từng mức giá.
            </p>
            <p className="mt-1 text-[10px] text-slate-500" aria-live="polite">
              Cập nhật gần nhất: {lastUpdated
                ? lastUpdated.toLocaleTimeString('vi-VN', { hour12: false })
                : 'Đang chờ dữ liệu'}
              {autoRefresh ? ' · Tự động làm mới 2 giây' : ' · Tự động làm mới đang tắt'}
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
              disabled={loading || busy}
              aria-label="Tải lại dữ liệu Footprint"
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
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

          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Lịch sử nến
            </label>
            <select
              value={historyLimit}
              onChange={(event) => setHistoryLimit(Number(event.target.value))}
              className="w-full rounded-lg border border-slate-700 bg-[#080d14] px-3 py-2.5 text-xs font-bold text-slate-200 outline-none focus:border-sky-500"
              aria-label="Số lượng nến lịch sử cần tải"
            >
              <option value={1000}>1.000 nến</option>
              <option value={5000}>5.000 nến</option>
              <option value={10000}>10.000 nến</option>
            </select>
            <p className="mt-1 text-[10px] text-slate-500">Phụ thuộc dữ liệu có sẵn trong backend/DB.</p>
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

        <VietnamMarketSession />       
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
            tone={
              lastPrice > referencePrice
                ? 'green'
                : lastPrice < referencePrice
                  ? 'red'
                  : 'yellow'
            }
          />

          <Metric
            label="Change"
            value={`${change > 0 ? '+' : ''}${formatPrice(change)}`}
            sub={`${changePercent > 0 ? '+' : ''}${formatNumber(changePercent, 2)}%`}
            tone={change > 0 ? 'green' : change < 0 ? 'red' : 'neutral'}
          />

          <Metric
            label="Footprint Volume"
            value={formatFootprintValue(totalVolume)}
            sub={`${levels.length} mức giá`}
          />
       
          <Metric
            label="Net Delta"
            value={formatFootprintValue(totalDelta)}
            sub={`Bid ${formatFootprintValue(totalBid)} / Ask ${formatFootprintValue(totalAsk)}`}
            tone={totalDelta > 0 ? 'green' : totalDelta < 0 ? 'red' : 'neutral'}
          />
          {/* 
          <Metric
            label="Foreign Buy"
            value="—"
            sub="Chưa có feed khối lượng nước ngoài"
            tone="blue"
          />

          <Metric
            label="Foreign Sell"
            value="—"
            sub="Chưa có feed khối lượng nước ngoài"
            tone="red"
          />

          <Metric
            label="Foreign Delta"
            value="—"
            sub="Mua − bán; chờ API dữ liệu"
            tone="neutral"
          />

          <Metric
            label="Tự doanh mua"
            value="—"
            sub="Chưa có feed tự doanh"
            tone="green"
          />

          <Metric
            label="Tự doanh bán"
            value="—"
            sub="Chưa có feed tự doanh"
            tone="red"
          />

          <Metric
            label="Tự doanh Delta"
            value="—"
            sub="Mua − bán; chờ API dữ liệu"
            tone="neutral"
          />
          */}  
          <Metric
            label="Cumulative Delta"
            value={
              Number.isFinite(cumulativeDelta)
                ? formatFootprintValue(cumulativeDelta)
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
          subtitle={`${symbol} · ${timeframe} · Footprint · OHLC · CDV · Liquidity Heatmap`}
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

              <button
                type="button"
                onClick={() => setChartMode('heatmap')}
                className={`rounded-lg px-3 py-2 text-xs font-bold ${
                  chartMode === 'heatmap'
                    ? 'bg-sky-500 text-slate-950'
                    : 'border border-slate-700 text-slate-300'
                }`}
              >
                HEATMAP
              </button>

              <button
                type="button"
                onClick={() => setChartMode('cdv')}
                className={`rounded-lg px-3 py-2 text-xs font-bold ${
                  chartMode === 'cdv'
                    ? 'bg-sky-500 text-slate-950'
                    : 'border border-slate-700 text-slate-300'
                }`}
              >
                CDV CANDLE
              </button>

              {chartMode === 'heatmap' && (
                <LiquidityHeatmapToolbar
                  intensity={heatmapIntensity}
                  threshold={heatmapThreshold}
                  side={liquiditySide}
                  status={heatmapFetchStatus}
                  onIntensityChange={setHeatmapIntensity}
                  onThresholdChange={setHeatmapThreshold}
                  onSideChange={setLiquiditySide}
                />
              )}

              {chartMode === 'footprint' && (
                <div
                  role="group"
                  aria-label="Chế độ hiển thị Footprint"
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-[#080d14] p-1"
                >
                  {([
                    ['bid-ask', 'BID × ASK'],
                    ['delta', 'DELTA'],
                    ['volume', 'VOLUME'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={footprintMode === value}
                      onClick={() => setFootprintMode(value)}
                      className={`rounded-lg px-3 py-2 text-[11px] font-bold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400 ${
                        footprintMode === value
                          ? 'bg-sky-400 text-slate-950 shadow'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
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
              timeframe={timeframe}
              footprintMode={footprintMode}
              showVolume={showVolume}
              showPoc={showPoc}
              liquidityPoints={liquidityPoints}
              heatmapIntensity={heatmapIntensity}
              heatmapThreshold={heatmapThreshold}
              liquiditySide={liquiditySide}
              profilePoc={pocPrice}
              profileVah={vahPrice}
              profileVal={valPrice}
              showProfilePoc={showProfilePoc && showProfile}
              showValueArea={showValueArea && showProfile}
            />
          )}

          <div className="grid grid-cols-2 gap-3 border-t border-slate-800 p-3 md:grid-cols-4">
            <Metric
              label="Nến đang tải"
              value={formatNumber(candles.length)}
            />

            <Metric
              label="Volume lịch sử"
              value={formatFootprintValue(candleVolume)}
            />

            <Metric
              label="Delta các nến"
              value={formatFootprintValue(candleDelta)}
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
            subtitle="Ask bên trái · Price ở giữa · Bid bên phải · Delta tại từng mức giá"
          >
            {levels.length === 0 ? (
              <EmptyState text="Backend chưa trả về levels hoặc price_levels." />
            ) : (
              <div className="max-h-[620px] overflow-auto">
                <table className="w-full min-w-[520px] border-collapse text-xs tabular-nums">
                  <thead className="sticky top-0 z-10 bg-[#0c121b] text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-3 text-left text-emerald-400">
                        Ask
                      </th>
                      <th className="px-3 py-3 text-center">
                        Price
                      </th>
                      <th className="px-3 py-3 text-right text-rose-400">
                        Bid
                      </th>
                      <th className="px-3 py-3 text-right">
                        Delta
                      </th>
                      <th className="px-3 py-3 text-right">
                        Volume
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {levels.map((row, index) => {
                      const bidWidth = (row.bid / maxCell) * 100
                      const askWidth = (row.ask / maxCell) * 100

                      return (
                        <tr
                          key={`${row.price}-${index}`}
                          className="border-t border-slate-800/70 hover:bg-white/[0.025]"
                        >
                          {/* ASK - BÊN TRÁI */}
                          <td className="relative overflow-hidden px-3 py-2.5 text-left text-emerald-300">
                            <div
                              className="absolute inset-y-1 right-0 rounded-l bg-emerald-500/20"
                              style={{ width: `${askWidth}%` }}
                            />

                            <span className="relative font-semibold">
                              {formatFootprintValue(row.ask)}
                            </span>
                          </td>

                          {/* PRICE - Ở GIỮA */}
                          <td className="whitespace-nowrap border-x border-slate-800 bg-[#0c121b] px-3 py-2.5 text-center font-bold text-slate-100">
                            {formatPrice(row.price)}
                          </td>

                          {/* BID - BÊN PHẢI */}
                          <td className="relative overflow-hidden px-3 py-2.5 text-right text-rose-300">
                            <div
                              className="absolute inset-y-1 left-0 rounded-r bg-rose-500/20"
                              style={{ width: `${bidWidth}%` }}
                            />

                            <span className="relative font-semibold">
                              {formatFootprintValue(row.bid)}
                            </span>
                          </td>

                          {/* DELTA */}
                          <td
                            className={`px-3 py-2.5 text-right font-bold ${
                              row.delta > 0
                                ? 'text-emerald-400'
                                : row.delta < 0
                                  ? 'text-rose-400'
                                  : 'text-slate-400'
                            }`}
                          >
                            {formatFootprintValue(row.delta)}
                          </td>

                          {/* VOLUME */}
                          <td className="px-3 py-2.5 text-right text-slate-300">
                            {formatFootprintValue(row.volume)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>

                  <tfoot className="sticky bottom-0 border-t border-slate-700 bg-[#0c121b] font-bold">
                    <tr>
                      {/* TỔNG ASK */}
                      <td className="px-3 py-3 text-left text-emerald-300">
                        {formatFootprintValue(totalAsk)}
                      </td>

                      <td className="px-3 py-3 text-center">
                        TOTAL
                      </td>

                      {/* TỔNG BID */}
                      <td className="px-3 py-3 text-right text-rose-300">
                        {formatFootprintValue(totalBid)}
                      </td>

                      {/* TỔNG DELTA */}
                      <td
                        className={`px-3 py-3 text-right ${
                          totalDelta > 0
                            ? 'text-emerald-400'
                            : totalDelta < 0
                              ? 'text-rose-400'
                              : 'text-slate-400'
                        }`}
                      >
                        {formatFootprintValue(totalDelta)}
                      </td>

                      {/* TỔNG VOLUME */}
                      <td className="px-3 py-3 text-right text-slate-300">
                        {formatFootprintValue(totalVolume)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Panel>
        
          <Panel
            title="DOM · DEPTH OF MARKET"
            subtitle="Bid/Ask liquidity theo các mức giá đang có trong payload · không tự tạo depth giả"
          >
            {levels.length === 0 ? (
              <EmptyState text="Chưa có dữ liệu giá/khối lượng để dựng DOM. Kiểm tra feed Order Book hoặc levels từ backend." />
            ) : (
              <div className="space-y-3 p-3">
                {(() => {
                  const domRows = [...levels].sort((a, b) => b.price - a.price).slice(0, 24)
                  const domMax = Math.max(1, ...domRows.map((r) => Math.max(r.bid, r.ask)))
                  const bestBid = [...levels].filter((r) => r.bid > 0).sort((a, b) => b.price - a.price)[0]
                  const bestAsk = [...levels].filter((r) => r.ask > 0).sort((a, b) => a.price - b.price)[0]
                  const spread = bestBid && bestAsk ? Math.max(0, bestAsk.price - bestBid.price) : null
                  const bidShare = totalBid + totalAsk > 0 ? (totalBid / (totalBid + totalAsk)) * 100 : 0
                  const askShare = 100 - bidShare
                  return (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-2">
                          <div className="text-[9px] font-bold uppercase tracking-wider text-rose-300">Bid Liquidity</div>
                          <div className="mt-1 font-mono text-sm font-bold text-rose-200">{formatFootprintValue(totalBid)}</div>
                        </div>
                        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-2 text-center">
                          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Spread*</div>
                          <div className="mt-1 font-mono text-sm font-bold text-slate-100">{spread === null ? '—' : formatPrice(spread)}</div>
                        </div>
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 text-right">
                          <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-300">Ask Liquidity</div>
                          <div className="mt-1 font-mono text-sm font-bold text-emerald-200">{formatFootprintValue(totalAsk)}</div>
                        </div>
                      </div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-slate-800" title={`Bid ${bidShare.toFixed(1)}% · Ask ${askShare.toFixed(1)}%`}>
                        <div className="bg-rose-500/80" style={{ width: `${bidShare}%` }} />
                        <div className="bg-emerald-500/80" style={{ width: `${askShare}%` }} />
                      </div>
                      <div className="max-h-[480px] overflow-auto rounded-lg border border-slate-800">
                        <table className="w-full min-w-[420px] border-collapse text-xs tabular-nums">
                          <thead className="sticky top-0 z-10 bg-[#0c121b] text-[10px] uppercase tracking-wider text-slate-500">
                            <tr>
                              <th className="px-3 py-2 text-right text-rose-300">Bid Size</th>
                              <th className="px-3 py-2 text-center">Price</th>
                              <th className="px-3 py-2 text-left text-emerald-300">Ask Size</th>
                            </tr>
                          </thead>
                          <tbody>
                            {domRows.map((row, index) => {
                              const bidPct = (row.bid / domMax) * 100
                              const askPct = (row.ask / domMax) * 100
                              const isPoc = row.price === pocPrice
                              return (
                                <tr key={`dom-${row.price}-${index}`} className={`border-t border-slate-800/70 ${isPoc ? 'bg-amber-400/[0.07]' : 'hover:bg-white/[0.025]'}`}>
                                  <td className="relative overflow-hidden px-3 py-2 text-right text-rose-300">
                                    <div className="absolute inset-y-0 right-0 bg-rose-500/15" style={{ width: `${bidPct}%` }} />
                                    <span className="relative">{formatFootprintValue(row.bid)}</span>
                                  </td>
                                  <td className={`whitespace-nowrap border-x border-slate-800 px-3 py-2 text-center font-bold ${isPoc ? 'text-amber-300' : 'text-slate-100'}`}>
                                    {formatPrice(row.price)}{isPoc ? ' · POC' : ''}
                                  </td>
                                  <td className="relative overflow-hidden px-3 py-2 text-left text-emerald-300">
                                    <div className="absolute inset-y-0 left-0 bg-emerald-500/15" style={{ width: `${askPct}%` }} />
                                    <span className="relative">{formatFootprintValue(row.ask)}</span>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[10px] leading-relaxed text-slate-500">* Spread ở đây chỉ là chênh lệch ước tính từ các level có Bid/Ask volume. Muốn DOM L2 thật (best bid/ask và nhiều mức lệnh chờ realtime), backend phải cung cấp order-book snapshot/updates; footprint trade levels không thể thay thế order book.</p>
                    </>
                  )
                })()}
              </div>
            )}
          </Panel>

          <Panel
            title="VOLUME PROFILE"
            subtitle="Phân phối Volume theo giá"
            right={<div className="flex flex-wrap items-center gap-2 text-[11px]">
              <div className="flex flex-wrap gap-1">
                {([['session','Current Session'],['days','1D'],['3d','3D'],['5d','5D'],['10d','10D'],['20d','20D'],['custom','Custom']] as const).map(([key,label]) => {
                  const selected =
                  key === 'session'
                    ? profileWindow === 'session'
                    : key === 'custom'
                      ? profileWindow === 'custom'
                      : profileWindow === 'visible'
                        ? false
                        : profileDays === Number(key.slice(0, -1));
                  return <button key={key} type="button" onClick={() => { if(key==='session'||key==='custom') setProfileWindow(key); else {setProfileWindow('days');setProfileDays(Number(key.slice(0,-1)) as 1|3|5|10|20)} }} className={`rounded-md border px-2 py-1.5 ${selected?'border-sky-500 bg-sky-500/15 text-sky-300':'border-slate-700 text-slate-400 hover:bg-slate-800'}`}>{label}</button>
                })}
              </div>
              <button type="button" onClick={() => setShowProfile(v=>!v)} className="rounded-lg border border-slate-700 px-3 py-1.5">{showProfile?'Ẩn':'Hiện'}</button>
            </div>}
          >
            {!showProfile ? <EmptyState text="Volume Profile đang được ẩn." /> : profile.length === 0 ? <EmptyState text="Chưa có Volume Profile từ dữ liệu lịch sử backend." /> : <div className="space-y-3 p-4">
              {profileWindow === 'custom' && <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400"><label>Từ <input type="datetime-local" value={customStart} onChange={e=>setCustomStart(e.target.value)} className="rounded border border-slate-700 bg-[#080d14] p-1.5 text-slate-200" /></label><label>Đến <input type="datetime-local" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} className="rounded border border-slate-700 bg-[#080d14] p-1.5 text-slate-200" /></label></div>}
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 pb-3 text-[11px] text-slate-400">
                <label className="flex items-center gap-2">Profile <select value={profileMode} onChange={e=>setProfileMode(e.target.value as typeof profileMode)} className="rounded border border-slate-700 bg-[#080d14] px-2 py-1.5 text-slate-200"><option value="visible-range">Visible Range</option><option value="fixed-range">Fixed Range</option></select></label>
                <label className="flex items-center gap-2">Value Area <select value={valueAreaPercent} onChange={e=>setValueAreaPercent(Number(e.target.value))} className="rounded border border-slate-700 bg-[#080d14] px-2 py-1.5 text-slate-200"><option value={50}>50%</option><option value={68}>68%</option><option value={70}>70%</option><option value={75}>75%</option><option value={80}>80%</option></select></label>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold tabular-nums">
                <span className="text-amber-300">POC: {pocPrice == null ? '—' : formatPrice(pocPrice)}</span><span className="text-sky-300">VAH: {vahPrice == null ? '—' : formatPrice(vahPrice)}</span><span className="text-sky-300">VAL: {valPrice == null ? '—' : formatPrice(valPrice)}</span>
              </div>
              <div className="space-y-1.5">
                {profile.map((item,index)=>{const isPoc=item.price===pocPrice, inVa=index>=valueAreaLowIndex&&index<=valueAreaHighIndex, hvn=hvnPrices.includes(item.price), lvn=lvnPrices.includes(item.price); const width=item.volume/maxProfile*100; return <div key={`${item.price}-${index}`} className="grid grid-cols-[58px_minmax(0,1fr)_82px] items-center gap-2 text-[11px] tabular-nums">
                  <span className={`text-right ${isPoc?'font-bold text-amber-300':inVa?'text-sky-300':'text-slate-400'}`}>{formatPrice(item.price)}</span><div className="relative h-5 overflow-hidden rounded-sm bg-slate-800/60"><div className={`h-full rounded-sm ${isPoc?'bg-amber-400/85':hvn&&showHvnLvn?'bg-violet-500/75':lvn&&showHvnLvn?'bg-cyan-400/75':inVa?'bg-sky-500/80':'bg-sky-600/55'}`} style={{width:`${Math.max(1,Math.min(100,width))}%`}} />{showProfilePoc&&isPoc&&<div className="absolute inset-y-0 left-0 right-0 border-y border-amber-200"/>}{showValueArea&&inVa&&!isPoc&&<div className="absolute inset-y-0 left-0 right-0 border-y border-sky-300/50"/>}</div><span className={`text-right ${isPoc?'font-bold text-amber-300':'text-slate-300'}`}>{formatFootprintValue(item.volume)}</span>
                </div>})}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-800 pt-3 text-[11px] text-slate-400">
                <label className="flex items-center gap-2"><input type="checkbox" checked={showProfilePoc} onChange={e=>setShowProfilePoc(e.target.checked)} />Show POC</label><label className="flex items-center gap-2"><input type="checkbox" checked={showValueArea} onChange={e=>setShowValueArea(e.target.checked)} />Show VAH/VAL</label><label className="flex items-center gap-2"><input type="checkbox" checked={showHvnLvn} onChange={e=>setShowHvnLvn(e.target.checked)} />Show HVN/LVN</label>
              </div>
            </div>}
            <div className="border-t border-slate-800 px-4 py-3 text-[10px] leading-5 text-slate-500">POC là mức giá có Volume cao nhất trong tập profile. Value Area được mở rộng từ POC theo các mức volume liền kề cho đến tỷ lệ đã chọn. HVN/LVN là vùng cực trị cục bộ ước tính trên các mức giá hiện có.</div>
          </Panel>
          <Panel
            title="TIME & SALES"
            subtitle="Giao dịch mới nhất hiển thị ở trên cùng"
            right={
              <button
                type="button"
                onClick={() => setShowTrades((value) => !value)}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs transition hover:bg-slate-800"
              >
                {showTrades ? "Ẩn" : "Hiện"}
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
                  <thead className="sticky top-0 z-10 bg-[#0c121b] text-[10px] uppercase text-slate-500">
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
                          className="border-t border-slate-800/70 transition hover:bg-slate-800/30"
                        >
                          <td className="whitespace-nowrap px-3 py-2.5 text-slate-400">
                            {trade.time}
                          </td>

                          <td
                            className={`px-3 py-2.5 text-right font-bold ${
                              buy
                                ? "text-emerald-400"
                                : sell
                                  ? "text-rose-400"
                                  : "text-slate-200"
                            }`}
                          >
                            {formatPrice(trade.price)}
                          </td>

                          <td
                            className={`px-3 py-2.5 text-right font-semibold ${
                              buy
                                ? "text-emerald-300"
                                : sell
                                  ? "text-rose-300"
                                  : "text-slate-300"
                            }`}
                          >
                            {formatFootprintValue(trade.volume)}
                          </td>

                          <td className="px-3 py-2.5 text-center">
                            <span
                              className={`rounded px-2 py-1 text-[10px] font-bold ${
                                buy
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : sell
                                    ? "bg-rose-500/15 text-rose-400"
                                    : "bg-slate-700 text-slate-300"
                              }`}
                            >
                              {buy ? "BUY" : sell ? "SELL" : "UNKNOWN"}
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

        </section>



        <details className="group rounded-xl border border-slate-800 bg-[#101722]" >
  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
    <div className="min-w-0">
      <div className="text-xs font-black tracking-wider text-slate-200">SYSTEM STATUS</div>
      <div className="mt-1 text-[11px] text-slate-500">Trạng thái kết nối và dữ liệu · {statusText} · {symbol} / {timeframe}</div>
    </div>
    <span className="shrink-0 text-slate-500 transition-transform group-open:rotate-180">▼</span>
  </summary>
  <div className="border-t border-slate-800">
  <Panel
    title="SYSTEM STATUS · Chi tiết"
    subtitle="Trạng thái vận hành và chất lượng dữ liệu"
  >
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-[#0c121b] p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Stream</div>
          <div className={`mt-1 text-sm font-bold ${
            statusText === 'LIVE' ? 'text-emerald-400' :
            statusText === 'CONNECTING' ? 'text-amber-400' : 'text-rose-400'
          }`}>{statusText}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#0c121b] p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Trades nhận được</div>
          <div className="mt-1 text-sm font-bold text-slate-200">{formatNumber(tradeCount)}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#0c121b] p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Footprint levels</div>
          <div className="mt-1 text-sm font-bold text-slate-200">{formatNumber(levels.length)}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#0c121b] p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Candles</div>
          <div className="mt-1 text-sm font-bold text-slate-200">{formatNumber(candles.length)}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-800">
        <div className="border-b border-slate-800 bg-[#0c121b] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Runtime details
        </div>
        <dl className="grid grid-cols-1 gap-px bg-slate-800 sm:grid-cols-2">
          <div className="bg-[#080d14] px-3 py-2.5">
            <dt className="text-[10px] uppercase tracking-wider text-slate-500">Backend API</dt>
            <dd className="mt-1 break-all font-mono text-xs text-slate-300">{API_BASE}</dd>
          </div>
          <div className="bg-[#080d14] px-3 py-2.5">
            <dt className="text-[10px] uppercase tracking-wider text-slate-500">Symbol / Timeframe</dt>
            <dd className="mt-1 font-mono text-xs font-semibold text-sky-300">{symbol} / {timeframe}</dd>
          </div>
          <div className="bg-[#080d14] px-3 py-2.5">
            <dt className="text-[10px] uppercase tracking-wider text-slate-500">Lần cập nhật gần nhất</dt>
            <dd className="mt-1 font-mono text-xs text-slate-300">{lastUpdated ? lastUpdated.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa có dữ liệu cập nhật'}</dd>
          </div>
          <div className="bg-[#080d14] px-3 py-2.5">
            <dt className="text-[10px] uppercase tracking-wider text-slate-500">Tự động làm mới</dt>
            <dd className={`mt-1 text-xs font-semibold ${autoRefresh ? 'text-emerald-400' : 'text-slate-400'}`}>{autoRefresh ? 'ĐANG BẬT' : 'ĐANG TẮT'}</dd>
          </div>
          <div className="bg-[#080d14] px-3 py-2.5 sm:col-span-2">
            <dt className="text-[10px] uppercase tracking-wider text-slate-500">Trạng thái yêu cầu</dt>
            <dd className={`mt-1 break-words text-xs ${requestError ? 'text-rose-300' : actionMessage ? 'text-amber-300' : 'text-slate-300'}`}>
              {requestError || actionMessage || (loading ? 'Đang tải dữ liệu…' : candles.length || trades.length || levels.length ? 'Đã nhận dữ liệu từ backend' : 'Chưa có dữ liệu footprint được tải')}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-slate-800 bg-[#0c121b] p-3 text-[11px] leading-5 text-slate-400">
        <div className="mb-1 flex items-center gap-2 font-bold text-slate-200">
          <span className="text-amber-400">ⓘ</span> Data Integrity
        </div>
        Đây là trạng thái vận hành được diễn giải từ dữ liệu hiện có trong giao diện. Payload JSON đầy đủ được xem riêng tại mục
        <span className="font-semibold text-emerald-300"> JSON DEBUG · Backend payload</span> bên dưới. Auto-refresh chỉ tải lại dữ liệu backend cung cấp; không tự tạo tick hoặc order-book giả.
      </div>
    </div>
  </Panel>
  </div>
</details>


{/* BACKEND PAYLOAD DEBUG */}
<details className="group rounded-xl border border-slate-800 bg-[#101722]">
  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-bold text-slate-300">
    <span>JSON DEBUG · Backend payload</span>

    <span className="text-slate-500 transition-transform group-open:rotate-180">
      ▼
    </span>
  </summary>

  <pre className="max-h-96 overflow-auto border-t border-slate-800 bg-[#080d14] p-4 font-mono text-[11px] leading-5 text-emerald-300">
    {JSON.stringify(payload, null, 2)}
  </pre>
</details>

        <footer className="pb-4 text-center text-[10px] text-slate-600">
          LHP-FI Footprint Terminal · Order Flow Analytics · Dữ liệu hiển thị
          phụ thuộc nguồn thị trường và trạng thái backend. Auto-refresh chỉ tải lại
          dữ liệu hiện có, không tự tạo giao dịch mới.
        </footer>
      </div>
    </main>
  )
}

