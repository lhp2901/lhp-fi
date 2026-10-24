
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { supabase } from '@/lib/supabase'

/* =========================================================
   TYPES
========================================================= */

type IndexCode = 'VNINDEX' | 'VN30'
type IndexFilter = 'ALL' | IndexCode
type PeriodDays = 7 | 14 | 30 | 90

type RawSignal = {
  date: string
  index_code: string
  signal_type: string | null
  confidence_score: number | string | null
  volatility_tag?: string | null
  volume_behavior?: string | null
  market_sentiment?: string | null
  rsi_score?: number | string | null
  volume_spike_ratio?: number | string | null
  trend_strength?: string | null
  notes?: string | null
}

type ParsedSignal = {
  date: string
  timestamp: number
  indexCode: IndexCode
  confidence: number | null
  signal: string | null
  sentiment: string | null
  volatility: string | null
  volumeBehavior: string | null
  rsi: number | null
  volumeSpike: number | null
  trendStrength: string | null
  notes: string | null
}

type TrendPoint = {
  date: string
  timestamp: number

  VNINDEX_confidence?: number
  VNINDEX_sentiment?: string | null
  VNINDEX_signal?: string | null
  VNINDEX_volatility?: string | null
  VNINDEX_volumeBehavior?: string | null
  VNINDEX_rsi?: number | null
  VNINDEX_spike?: number | null
  VNINDEX_strength?: string | null
  VNINDEX_notes?: string | null

  VN30_confidence?: number
  VN30_sentiment?: string | null
  VN30_signal?: string | null
  VN30_volatility?: string | null
  VN30_volumeBehavior?: string | null
  VN30_rsi?: number | null
  VN30_spike?: number | null
  VN30_strength?: string | null
  VN30_notes?: string | null
}

/**
 * Dùng kiểu props độc lập để tránh khác biệt DotProps
 * giữa các phiên bản Recharts.
 */
type CustomDotProps = {
  cx?: number
  cy?: number
  payload?: TrendPoint
}

type TooltipEntry = {
  value?: string | number
  payload?: TrendPoint
}

type CustomTooltipProps = {
  active?: boolean
  payload?: TooltipEntry[]
}

type IndexStats = {
  count: number
  averageConfidence: number | null
  bullishCount: number
  bearishCount: number
  neutralCount: number
}

/* =========================================================
   CONSTANTS
========================================================= */

const INDEX_COLORS: Record<IndexCode, string> = {
  VNINDEX: '#38bdf8',
  VN30: '#f97316',
}

const PERIOD_OPTIONS: Array<{
  label: string
  value: PeriodDays
}> = [
  { label: '7 ngày', value: 7 },
  { label: '14 ngày', value: 14 },
  { label: '30 ngày', value: 30 },
  { label: '90 ngày', value: 90 },
]

const INDEX_OPTIONS: Array<{
  label: string
  value: IndexFilter
}> = [
  { label: 'Tất cả chỉ số', value: 'ALL' },
  { label: 'VNINDEX', value: 'VNINDEX' },
  { label: 'VN30', value: 'VN30' },
]

/* =========================================================
   HELPERS
========================================================= */

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const result = Number(value)

  return Number.isFinite(result) ? result : null
}

/**
 * Chuẩn hóa confidence_score về thang 0–1.
 *
 * 0–1: giữ nguyên.
 * Trên 1 đến 100: chia 100.
 * Ngoài phạm vi: trả về null.
 */
function parseConfidence(value: unknown): number | null {
  const result = parseNumber(value)

  if (result === null || result < 0 || result > 100) {
    return null
  }

  return result > 1 ? result / 100 : result
}

function parseIndexCode(value: string): IndexCode | null {
  const normalized = value.trim().toUpperCase()

  if (normalized === 'VNINDEX' || normalized === 'VN30') {
    return normalized
  }

  return null
}

function parseDate(
  value: string,
): { date: string; timestamp: number } | null {
  if (!value) {
    return null
  }

  const timestamp = Date.parse(value)

  if (!Number.isFinite(timestamp)) {
    return null
  }

  // Không chuyển ngày YYYY-MM-DD qua múi giờ khác.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)

  const date = dateOnly
    ? value
    : new Date(timestamp).toLocaleDateString('sv-SE')

  return { date, timestamp }
}

function formatDateLabel(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) {
    return value
  }

  return `${match[3]}/${match[2]}`
}

function formatDateTime(value: string): string {
  const parsed = parseDate(value)

  if (!parsed) {
    return value
  }

  return new Date(parsed.timestamp).toLocaleString('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return '—'
  }

  return `${(value * 100).toLocaleString('vi-VN', {
    maximumFractionDigits: 2,
  })}%`
}

function formatValue(value: number | null): string {
  if (value === null) {
    return '—'
  }

  return value.toLocaleString('vi-VN', {
    maximumFractionDigits: 2,
  })
}

function normalizeSentiment(
  value: string | null | undefined,
): 'greed' | 'fear' | 'neutral' | 'unknown' {
  const normalized = (value ?? '').trim().toLowerCase()

  if (
    normalized.includes('tham lam') ||
    normalized.includes('greed')
  ) {
    return 'greed'
  }

  if (
    normalized.includes('sợ hãi') ||
    normalized.includes('so hai') ||
    normalized.includes('fear')
  ) {
    return 'fear'
  }

  if (
    normalized.includes('trung lập') ||
    normalized.includes('trung lap') ||
    normalized.includes('neutral')
  ) {
    return 'neutral'
  }

  return 'unknown'
}

function getSentimentColor(
  sentiment: string | null | undefined,
): string {
  const normalized = normalizeSentiment(sentiment)

  if (normalized === 'greed') {
    return '#4ade80'
  }

  if (normalized === 'fear') {
    return '#f87171'
  }

  if (normalized === 'neutral') {
    return '#facc15'
  }

  return '#cbd5e1'
}

function classifySignal(
  signal: string | null | undefined,
): 'bullish' | 'bearish' | 'neutral' {
  const value = (signal ?? '').trim().toLowerCase()

  if (
    value.includes('bullish') ||
    value.includes('buy') ||
    value.includes('mua') ||
    value.includes('tăng') ||
    value.includes('long')
  ) {
    return 'bullish'
  }

  if (
    value.includes('bearish') ||
    value.includes('sell') ||
    value.includes('bán') ||
    value.includes('giảm') ||
    value.includes('short')
  ) {
    return 'bearish'
  }

  return 'neutral'
}

/* =========================================================
   CUSTOM DOT
========================================================= */

function createSignalDot(indexCode: IndexCode) {
  function SignalDot(props: CustomDotProps) {
    const { cx, cy, payload } = props

    if (
      typeof cx !== 'number' ||
      typeof cy !== 'number' ||
      !payload
    ) {
      return null
    }

    const sentiment = payload[`${indexCode}_sentiment`]

    const color = getSentimentColor(
      typeof sentiment === 'string' ? sentiment : undefined,
    )

    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill={color}
        stroke={INDEX_COLORS[indexCode]}
        strokeWidth={1.5}
      />
    )
  }

  SignalDot.displayName = `SignalDot_${indexCode}`

  return SignalDot
}

/* =========================================================
   CUSTOM TOOLTIP
========================================================= */

function CustomTooltip({
  active,
  payload,
}: CustomTooltipProps) {
  if (!active || !payload?.length) {
    return null
  }

  const point = payload.find(
    (item) => item.payload !== undefined,
  )?.payload

  if (!point) {
    return null
  }

  const indexCodes: IndexCode[] = ['VNINDEX', 'VN30']

  const visibleIndexes = indexCodes.filter((indexCode) => {
    const confidence = point[`${indexCode}_confidence`]

    return typeof confidence === 'number'
  })

  if (visibleIndexes.length === 0) {
    return null
  }

  return (
    <div className="max-w-[320px] rounded-xl border border-slate-600 bg-slate-900 p-4 text-sm text-white shadow-2xl">
      <p className="mb-3 font-semibold">
        📅 {formatDateTime(point.date)}
      </p>

      <div className="space-y-4">
        {visibleIndexes.map((indexCode) => {
          const confidence = point[`${indexCode}_confidence`]
          const sentiment = point[`${indexCode}_sentiment`]
          const signal = point[`${indexCode}_signal`]
          const volatility = point[`${indexCode}_volatility`]
          const volumeBehavior =
            point[`${indexCode}_volumeBehavior`]
          const rsi = point[`${indexCode}_rsi`]
          const spike = point[`${indexCode}_spike`]
          const strength = point[`${indexCode}_strength`]
          const notes = point[`${indexCode}_notes`]

          return (
            <div
              key={indexCode}
              className="border-t border-slate-700 pt-3 first:border-0 first:pt-0"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <span
                  className="font-bold"
                  style={{ color: INDEX_COLORS[indexCode] }}
                >
                  {indexCode}
                </span>

                <span className="font-semibold">
                  {formatPercent(
                    typeof confidence === 'number'
                      ? confidence
                      : null,
                  )}
                </span>
              </div>

              <div className="space-y-1 text-slate-300">
                <p>📊 Tín hiệu: {signal || '—'}</p>

                <p>
                  🧠 Tâm lý:{' '}
                  {typeof sentiment === 'string' ? sentiment : '—'}
                </p>

                <p>
                  🌪️ Biến động:{' '}
                  {typeof volatility === 'string'
                    ? volatility
                    : '—'}
                </p>

                <p>
                  💹 Hành vi khối lượng:{' '}
                  {typeof volumeBehavior === 'string'
                    ? volumeBehavior
                    : '—'}
                </p>

                <p>
                  🌀 RSI:{' '}
                  {typeof rsi === 'number'
                    ? formatValue(rsi)
                    : '—'}
                </p>

                <p>
                  💥 Volume Spike:{' '}
                  {typeof spike === 'number'
                    ? `${formatValue(spike)}x`
                    : '—'}
                </p>

                <p>
                  📈 Sức mạnh xu hướng:{' '}
                  {typeof strength === 'string' ? strength : '—'}
                </p>

                {typeof notes === 'string' && notes.trim() && (
                  <p className="mt-2 break-words text-xs text-slate-400">
                    📝 {notes}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  title,
  value,
  description,
  icon,
}: {
  title: string
  value: string
  description: string
  icon: string
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{title}</p>

          <p className="mt-2 text-2xl font-bold text-white">
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {description}
          </p>
        </div>

        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  )
}

/* =========================================================
   STATISTICS
========================================================= */

function calculateStats(
  signals: ParsedSignal[],
  indexCode: IndexCode,
): IndexStats {
  const selected = signals.filter(
    (signal) => signal.indexCode === indexCode,
  )

  const confidenceValues = selected
    .map((signal) => signal.confidence)
    .filter((value): value is number => value !== null)

  const bullishCount = selected.filter(
    (signal) => classifySignal(signal.signal) === 'bullish',
  ).length

  const bearishCount = selected.filter(
    (signal) => classifySignal(signal.signal) === 'bearish',
  ).length

  const neutralCount =
    selected.length - bullishCount - bearishCount

  return {
    count: selected.length,
    averageConfidence:
      confidenceValues.length > 0
        ? confidenceValues.reduce((sum, value) => sum + value, 0) /
          confidenceValues.length
        : null,
    bullishCount,
    bearishCount,
    neutralCount,
  }
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function AISignalTrendChart() {
  const [signals, setSignals] = useState<ParsedSignal[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [period, setPeriod] = useState<PeriodDays>(30)
  const [indexFilter, setIndexFilter] =
    useState<IndexFilter>('ALL')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  /* =======================================================
     FETCH DATA
  ======================================================= */

  const fetchData = useCallback(
    async (manualRefresh = false) => {
      if (manualRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError(null)

      try {
        const sinceDate = new Date()

        sinceDate.setDate(sinceDate.getDate() - (period - 1))

        const since = [
          sinceDate.getFullYear(),
          String(sinceDate.getMonth() + 1).padStart(2, '0'),
          String(sinceDate.getDate()).padStart(2, '0'),
        ].join('-')

        const pageSize = 1000
        let offset = 0

        const allRows: RawSignal[] = []

        while (true) {
          let query = supabase
            .from('ai_market_signals')
            .select(
              [
                'date',
                'index_code',
                'signal_type',
                'confidence_score',
                'volatility_tag',
                'volume_behavior',
                'market_sentiment',
                'rsi_score',
                'volume_spike_ratio',
                'trend_strength',
                'notes',
              ].join(', '),
            )
            .gte('date', since)
            .order('date', { ascending: true })
            .range(offset, offset + pageSize - 1)

          if (indexFilter === 'ALL') {
            query = query.in('index_code', ['VNINDEX', 'VN30'])
          } else {
            query = query.eq('index_code', indexFilter)
          }

          const { data, error: queryError } = await query

          if (queryError) {
            throw new Error(queryError.message)
          }

          const rows = (data ?? []) as unknown as RawSignal[]

          allRows.push(...rows)

          if (rows.length < pageSize) {
            break
          }

          offset += pageSize
        }

        const parsedSignals: ParsedSignal[] = []

        for (const row of allRows) {
          const indexCode = parseIndexCode(row.index_code)

          if (!indexCode) {
            continue
          }

          const parsedDate = parseDate(row.date)

          if (!parsedDate) {
            continue
          }

          parsedSignals.push({
            date: parsedDate.date,
            timestamp: parsedDate.timestamp,
            indexCode,
            confidence: parseConfidence(row.confidence_score),
            signal: row.signal_type ?? null,
            sentiment: row.market_sentiment ?? null,
            volatility: row.volatility_tag ?? null,
            volumeBehavior: row.volume_behavior ?? null,
            rsi: parseNumber(row.rsi_score),
            volumeSpike: parseNumber(row.volume_spike_ratio),
            trendStrength: row.trend_strength ?? null,
            notes: row.notes ?? null,
          })
        }

        parsedSignals.sort(
          (a, b) => a.timestamp - b.timestamp,
        )

        setSignals(parsedSignals)
        setLastUpdated(new Date())
      } catch (err: unknown) {
        console.error(
          '[AISignalTrendChart] Lỗi khi tải dữ liệu:',
          err,
        )

        setError(
          err instanceof Error
            ? err.message
            : 'Không thể tải dữ liệu từ Supabase.',
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [period, indexFilter],
  )

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  /* =======================================================
     FILTER DATA
  ======================================================= */

  const filteredSignals = useMemo(() => {
    if (indexFilter === 'ALL') {
      return signals
    }

    return signals.filter(
      (signal) => signal.indexCode === indexFilter,
    )
  }, [signals, indexFilter])

  /* =======================================================
     MERGE BY DAY
  ======================================================= */

  const chartData = useMemo<TrendPoint[]>(() => {
    const grouped = new Map<string, TrendPoint>()
    const latestTimestampByIndexAndDate = new Map<string, number>()

    for (const signal of filteredSignals) {
      let point = grouped.get(signal.date)

      if (!point) {
        point = {
          date: signal.date,
          timestamp: signal.timestamp,
        }

        grouped.set(signal.date, point)
      }

      point.timestamp = Math.max(
        point.timestamp,
        signal.timestamp,
      )

      const key = `${signal.date}:${signal.indexCode}`

      const latestTimestamp =
        latestTimestampByIndexAndDate.get(key)

      if (
        latestTimestamp !== undefined &&
        signal.timestamp < latestTimestamp
      ) {
        continue
      }

      latestTimestampByIndexAndDate.set(
        key,
        signal.timestamp,
      )

      if (signal.indexCode === 'VNINDEX') {
        point.VNINDEX_confidence =
          signal.confidence ?? undefined
        point.VNINDEX_sentiment = signal.sentiment
        point.VNINDEX_signal = signal.signal
        point.VNINDEX_volatility = signal.volatility
        point.VNINDEX_volumeBehavior = signal.volumeBehavior
        point.VNINDEX_rsi = signal.rsi
        point.VNINDEX_spike = signal.volumeSpike
        point.VNINDEX_strength = signal.trendStrength
        point.VNINDEX_notes = signal.notes
      } else {
        point.VN30_confidence =
          signal.confidence ?? undefined
        point.VN30_sentiment = signal.sentiment
        point.VN30_signal = signal.signal
        point.VN30_volatility = signal.volatility
        point.VN30_volumeBehavior = signal.volumeBehavior
        point.VN30_rsi = signal.rsi
        point.VN30_spike = signal.volumeSpike
        point.VN30_strength = signal.trendStrength
        point.VN30_notes = signal.notes
      }
    }

    return Array.from(grouped.values()).sort(
      (a, b) => a.timestamp - b.timestamp,
    )
  }, [filteredSignals])

  /* =======================================================
     SUMMARY STATS
  ======================================================= */

  const vnindexStats = useMemo(
    () => calculateStats(filteredSignals, 'VNINDEX'),
    [filteredSignals],
  )

  const vn30Stats = useMemo(
    () => calculateStats(filteredSignals, 'VN30'),
    [filteredSignals],
  )

  const overallStats = useMemo(() => {
    const confidenceValues = filteredSignals
      .map((signal) => signal.confidence)
      .filter((value): value is number => value !== null)

    const averageConfidence =
      confidenceValues.length > 0
        ? confidenceValues.reduce((sum, value) => sum + value, 0) /
          confidenceValues.length
        : null

    return {
      count: filteredSignals.length,
      averageConfidence,
      bullishCount: filteredSignals.filter(
        (signal) => classifySignal(signal.signal) === 'bullish',
      ).length,
      bearishCount: filteredSignals.filter(
        (signal) => classifySignal(signal.signal) === 'bearish',
      ).length,
    }
  }, [filteredSignals])

  const showVNINDEX = indexFilter !== 'VN30'
  const showVN30 = indexFilter !== 'VNINDEX'

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-8 text-center text-slate-300">
        <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />

        <p className="mt-4 text-sm">
          Đang tải dữ liệu xu hướng từ Supabase...
        </p>
      </div>
    )
  }

  /* =======================================================
     MAIN RENDER
  ======================================================= */

  return (
    <section className="space-y-6 rounded-2xl bg-slate-950 p-4 text-white sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight">
              Xu hướng tín hiệu AI
            </h2>

            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
              MARKET ANALYTICS
            </span>
          </div>

          <p className="mt-1 text-sm text-slate-400">
            Theo dõi biến động độ tin cậy của VNINDEX và VN30.
          </p>

          {lastUpdated && (
            <p className="mt-2 text-xs text-slate-500">
              Cập nhật lúc {lastUpdated.toLocaleTimeString('vi-VN')}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Chọn khoảng thời gian"
            value={period}
            onChange={(event) =>
              setPeriod(Number(event.target.value) as PeriodDays)
            }
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Chọn chỉ số"
            value={indexFilter}
            onChange={(event) =>
              setIndexFilter(event.target.value as IndexFilter)
            }
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
          >
            {INDEX_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void fetchData(true)}
            disabled={refreshing}
            className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? 'Đang tải...' : '↻ Làm mới'}
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4"
        >
          <p className="font-semibold text-red-300">
            Không thể tải dữ liệu
          </p>

          <p className="mt-1 break-words text-sm text-red-200">
            {error}
          </p>

          <button
            type="button"
            onClick={() => void fetchData(true)}
            disabled={refreshing}
            className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold hover:bg-red-500 disabled:opacity-60"
          >
            Thử lại
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Tổng tín hiệu"
          value={overallStats.count.toLocaleString('vi-VN')}
          description={`Trong ${period} ngày`}
          icon="📊"
        />

        <SummaryCard
          title="Độ tin cậy trung bình"
          value={formatPercent(overallStats.averageConfidence)}
          description="Chỉ tính điểm hợp lệ"
          icon="🎯"
        />

        <SummaryCard
          title="Tín hiệu tăng"
          value={overallStats.bullishCount.toLocaleString('vi-VN')}
          description="Phân loại theo signal_type"
          icon="📈"
        />

        <SummaryCard
          title="Tín hiệu giảm"
          value={overallStats.bearishCount.toLocaleString('vi-VN')}
          description="Phân loại theo signal_type"
          icon="📉"
        />
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-bold">
              Biểu đồ độ tin cậy theo thời gian
            </h3>

            <p className="mt-1 text-sm text-slate-400">
              Mỗi ngày hiển thị tín hiệu mới nhất của từng chỉ số.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 text-xs">
            {showVNINDEX && (
              <span className="flex items-center gap-2 text-sky-300">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                VNINDEX
              </span>
            )}

            {showVN30 && (
              <span className="flex items-center gap-2 text-orange-300">
                <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
                VN30
              </span>
            )}
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
            <span className="text-4xl">📉</span>

            <p className="mt-3 font-semibold text-slate-200">
              Chưa có dữ liệu biểu đồ
            </p>

            <p className="mt-1 max-w-md text-sm text-slate-400">
              Không tìm thấy bản ghi VNINDEX hoặc VN30 hợp lệ trong
              khoảng thời gian đã chọn.
            </p>
          </div>
        ) : (
          <div className="h-[340px] w-full sm:h-[410px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{
                  top: 12,
                  right: 20,
                  left: 0,
                  bottom: 8,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#475569"
                  opacity={0.6}
                />

                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateLabel}
                  tick={{ fill: '#cbd5e1', fontSize: 12 }}
                  tickMargin={10}
                  minTickGap={25}
                />

                <YAxis
                  domain={[0, 1]}
                  tickFormatter={(value: number) =>
                    `${Math.round(value * 100)}%`
                  }
                  tick={{ fill: '#cbd5e1', fontSize: 12 }}
                  width={55}
                />

                <Tooltip
                  content={(props) => (
                    <CustomTooltip
                      active={props.active}
                      payload={
                        props.payload as TooltipEntry[] | undefined
                      }
                    />
                  )}
                />

                <Legend
                  wrapperStyle={{
                    color: '#f1f5f9',
                    paddingTop: '14px',
                  }}
                />

                {showVNINDEX && (
                  <Line
                    type="monotone"
                    dataKey="VNINDEX_confidence"
                    stroke={INDEX_COLORS.VNINDEX}
                    strokeWidth={2.5}
                    dot={(props) => (
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={4}
                        fill={getSentimentColor(
                          props.payload?.VNINDEX_sentiment,
                        )}
                        stroke={INDEX_COLORS.VNINDEX}
                        strokeWidth={1.5}
                      />
                    )}
                    activeDot={{ r: 6 }}
                    connectNulls={false}
                    name="VNINDEX"
                    isAnimationActive={false}
                  />
                )}

                {showVN30 && (
                  <Line
                    type="monotone"
                    dataKey="VN30_confidence"
                    stroke={INDEX_COLORS.VN30}
                    strokeWidth={2.5}
                    dot={(props) => (
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={4}
                        fill={getSentimentColor(
                          props.payload?.VN30_sentiment,
                        )}
                        stroke={INDEX_COLORS.VN30}
                        strokeWidth={1.5}
                      />
                    )}
                    activeDot={{ r: 6 }}
                    connectNulls={false}
                    name="VN30"
                    isAnimationActive={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-800/70 p-3 text-xs leading-5 text-slate-400">
          <p>
            <strong className="text-slate-200">
              Cách đọc biểu đồ:
            </strong>{' '}
            Đường càng cao thể hiện confidence_score càng lớn theo dữ
            liệu AI. Màu chấm biểu thị tâm lý thị trường được lưu trong
            bản ghi.
          </p>

          <p className="mt-1">
            Độ tin cậy AI không mặc nhiên là xác suất dự báo đúng hoặc
            tỷ suất sinh lời. Cần kiểm định bằng kết quả thực tế để
            đánh giá chất lượng mô hình.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {showVNINDEX && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sky-300">VNINDEX</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Thống kê trong {period} ngày
                </p>
              </div>

              <span className="rounded-lg bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-300">
                HOSE
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400">Số tín hiệu</p>
                <p className="mt-1 text-xl font-bold">
                  {vnindexStats.count.toLocaleString('vi-VN')}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400">
                  Độ tin cậy trung bình
                </p>
                <p className="mt-1 text-xl font-bold text-sky-300">
                  {formatPercent(vnindexStats.averageConfidence)}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400">Tín hiệu tăng</p>
                <p className="mt-1 text-xl font-bold text-emerald-400">
                  {vnindexStats.bullishCount.toLocaleString('vi-VN')}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400">Tín hiệu giảm</p>
                <p className="mt-1 text-xl font-bold text-red-400">
                  {vnindexStats.bearishCount.toLocaleString('vi-VN')}
                </p>
              </div>
            </div>
          </div>
        )}

        {showVN30 && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-orange-300">VN30</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Thống kê trong {period} ngày
                </p>
              </div>

              <span className="rounded-lg bg-orange-500/10 px-3 py-2 text-xs font-bold text-orange-300">
                VN30
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400">Số tín hiệu</p>
                <p className="mt-1 text-xl font-bold">
                  {vn30Stats.count.toLocaleString('vi-VN')}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400">
                  Độ tin cậy trung bình
                </p>
                <p className="mt-1 text-xl font-bold text-orange-300">
                  {formatPercent(vn30Stats.averageConfidence)}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400">Tín hiệu tăng</p>
                <p className="mt-1 text-xl font-bold text-emerald-400">
                  {vn30Stats.bullishCount.toLocaleString('vi-VN')}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400">Tín hiệu giảm</p>
                <p className="mt-1 text-xl font-bold text-red-400">
                  {vn30Stats.bearishCount.toLocaleString('vi-VN')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

