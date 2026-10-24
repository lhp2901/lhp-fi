
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts'
import { supabase } from '@/lib/supabase'

/* =========================================================
   TYPES
========================================================= */

type RawIndicator = {
  date: string | null
  rsi_score: number | string | null
  volume_spike_ratio: number | string | null
  momentum: number | string | null
  macd_signal: string | number | null
  bollinger_band: string | number | null
}

type MergedIndicator = {
  date: string
  timestamp: number
  rsi_score: number | null
  spike: number | null
  momentum: number | null
  macd_signal: number | null
  bollinger_band: number | null
}

type IndicatorKey =
  | 'rsi_score'
  | 'spike'
  | 'momentum'
  | 'macd_signal'
  | 'bollinger_band'

type IndicatorSummary = {
  key: IndicatorKey
  label: string
  latest: number | null
  previous: number | null
  change: number | null
  count: number
  description: string
}

/**
 * Kiểu Tooltip riêng cho Recharts 3.1.0.
 * Không sử dụng TooltipProps<number, string> của API cũ.
 */
type CustomTooltipProps = {
  active?: boolean
  payload?: ReadonlyArray<{
    payload?: unknown
    value?: number | string | null
    name?: string | number
    color?: string
    dataKey?: string | number
  }>
  label?: string | number
}

/* =========================================================
   CONSTANTS
========================================================= */

const DAY_MS = 24 * 60 * 60 * 1000
const PAGE_SIZE = 1000

const INDICATOR_KEYS: IndicatorKey[] = [
  'rsi_score',
  'spike',
  'momentum',
  'macd_signal',
  'bollinger_band',
]

const INDICATOR_COLORS: Record<IndicatorKey, string> = {
  rsi_score: '#38bdf8',
  spike: '#f97316',
  momentum: '#22c55e',
  macd_signal: '#a78bfa',
  bollinger_band: '#f472b6',
}

const INDICATOR_NAMES: Record<IndicatorKey, string> = {
  rsi_score: 'RSI',
  spike: 'Volume Spike',
  momentum: 'Momentum',
  macd_signal: 'MACD Signal',
  bollinger_band: 'Bollinger Band',
}

const INDICATOR_DESCRIPTIONS: Record<IndicatorKey, string> = {
  rsi_score: 'Thang đo động lượng RSI 0–100.',
  spike: 'Tỷ lệ khối lượng so với mức tham chiếu.',
  momentum: 'Động lượng theo dữ liệu nguồn.',
  macd_signal: 'Giá trị hoặc mã hóa tín hiệu MACD.',
  bollinger_band: 'Giá trị hoặc mã hóa trạng thái Bollinger.',
}

/* =========================================================
   HELPERS
========================================================= */

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'string') {
    const normalized = value.trim()

    if (!normalized) {
      return null
    }

    value = normalized
  }

  const result = Number(value)

  return Number.isFinite(result) ? result : null
}

function parseMacdSignal(value: unknown): number | null {
  const numeric = parseNumber(value)

  if (numeric !== null) {
    return numeric
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()

  if (['tăng', 'bullish', 'buy'].includes(normalized)) {
    return 1
  }

  if (['giảm', 'bearish', 'sell'].includes(normalized)) {
    return -1
  }

  if (
    ['trung lập', 'trung lap', 'neutral'].includes(normalized)
  ) {
    return 0
  }

  return null
}

function parseBollingerBand(value: unknown): number | null {
  const numeric = parseNumber(value)

  if (numeric !== null) {
    return numeric
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()

  if (
    ['mở rộng', 'mo rong', 'expanding'].includes(normalized)
  ) {
    return 1
  }

  if (
    ['thu hẹp', 'thu hep', 'contracting'].includes(normalized)
  ) {
    return -1
  }

  if (
    ['trung lập', 'trung lap', 'neutral'].includes(normalized)
  ) {
    return 0
  }

  return null
}

/**
 * Chuẩn hóa ngày thành YYYY-MM-DD.
 */
function normalizeDate(value: string): string | null {
  if (!value.trim()) {
    return null
  }

  const dateOnlyMatch = value.match(
    /^(\d{4})-(\d{2})-(\d{2})$/,
  )

  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1])
    const month = Number(dateOnlyMatch[2])
    const day = Number(dateOnlyMatch[3])

    const date = new Date(Date.UTC(year, month - 1, day))

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null
    }

    return value
  }

  const timestamp = Date.parse(value)

  if (!Number.isFinite(timestamp)) {
    return null
  }

  return new Date(timestamp).toLocaleDateString('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh',
  })
}

function parseTimestamp(value: string): number | null {
  if (!value.trim()) {
    return null
  }

  const timestamp = Date.parse(value)

  return Number.isFinite(timestamp) ? timestamp : null
}

function formatDateLabel(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) {
    return value
  }

  return `${match[3]}/${match[2]}`
}

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '—'
  }

  return value.toLocaleString('vi-VN', {
    maximumFractionDigits: 2,
  })
}

function formatSignedNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '—'
  }

  return value > 0
    ? `+${formatNumber(value)}`
    : formatNumber(value)
}

function getIndicatorStatus(
  key: IndicatorKey,
  value: number | null,
): string {
  if (value === null) {
    return 'Chưa có dữ liệu'
  }

  if (key === 'rsi_score') {
    if (value < 0 || value > 100) {
      return 'Ngoài thang RSI 0–100'
    }

    if (value < 30) {
      return 'Vùng quá bán'
    }

    if (value > 70) {
      return 'Vùng quá mua'
    }

    return 'Trong vùng trung tính'
  }

  if (key === 'spike') {
    if (value < 0) {
      return 'Giá trị không hợp lệ'
    }

    if (value >= 2) {
      return 'Khối lượng tăng mạnh'
    }

    if (value >= 1.5) {
      return 'Khối lượng tăng'
    }

    return 'Chưa có đột biến lớn'
  }

  if (key === 'momentum') {
    if (value > 0) {
      return 'Động lượng dương'
    }

    if (value < 0) {
      return 'Động lượng âm'
    }

    return 'Động lượng bằng 0'
  }

  if (value > 0) {
    return 'Giá trị dương'
  }

  if (value < 0) {
    return 'Giá trị âm'
  }

  return 'Giá trị bằng 0'
}

/* =========================================================
   MERGE DAILY DATA
========================================================= */

function mergeDailyIndicators(
  rows: RawIndicator[],
): MergedIndicator[] {
  const grouped = new Map<
    string,
    {
      point: MergedIndicator
      fieldTimestamps: Record<IndicatorKey, number>
    }
  >()

  for (const row of rows) {
    if (typeof row.date !== 'string' || !row.date.trim()) {
      continue
    }

    const timestamp = parseTimestamp(row.date)
    const date = normalizeDate(row.date)

    if (timestamp === null || date === null) {
      continue
    }

    const values: Record<IndicatorKey, number | null> = {
      rsi_score: parseNumber(row.rsi_score),
      spike: parseNumber(row.volume_spike_ratio),
      momentum: parseNumber(row.momentum),
      macd_signal: parseMacdSignal(row.macd_signal),
      bollinger_band: parseBollingerBand(row.bollinger_band),
    }

    const existing = grouped.get(date)

    if (!existing) {
      const point: MergedIndicator = {
        date,
        timestamp,
        rsi_score: values.rsi_score,
        spike: values.spike,
        momentum: values.momentum,
        macd_signal: values.macd_signal,
        bollinger_band: values.bollinger_band,
      }

      const fieldTimestamps: Record<IndicatorKey, number> = {
        rsi_score:
          values.rsi_score !== null ? timestamp : -Infinity,
        spike:
          values.spike !== null ? timestamp : -Infinity,
        momentum:
          values.momentum !== null ? timestamp : -Infinity,
        macd_signal:
          values.macd_signal !== null ? timestamp : -Infinity,
        bollinger_band:
          values.bollinger_band !== null ? timestamp : -Infinity,
      }

      grouped.set(date, {
        point,
        fieldTimestamps,
      })

      continue
    }

    if (timestamp > existing.point.timestamp) {
      existing.point.timestamp = timestamp
    }

    for (const key of INDICATOR_KEYS) {
      const value = values[key]

      if (
        value !== null &&
        timestamp >= existing.fieldTimestamps[key]
      ) {
        existing.point[key] = value
        existing.fieldTimestamps[key] = timestamp
      }
    }
  }

  return Array.from(grouped.values())
    .map(({ point }) => point)
    .sort((a, b) => a.timestamp - b.timestamp)
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  title,
  value,
  description,
  color,
  change,
}: {
  title: string
  value: string
  description: string
  color: string
  change: number | null
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
      <p className="text-sm text-slate-400">{title}</p>

      <p
        className="mt-2 break-words text-2xl font-bold"
        style={{ color }}
      >
        {value}
      </p>

      {change !== null && (
        <p
          className={`mt-1 text-xs font-semibold ${
            change > 0
              ? 'text-emerald-400'
              : change < 0
                ? 'text-rose-400'
                : 'text-slate-400'
          }`}
        >
          {formatSignedNumber(change)} so với điểm trước
        </p>
      )}

      <p className="mt-2 text-xs leading-5 text-slate-400">
        {description}
      </p>
    </div>
  )
}

/* =========================================================
   CUSTOM TOOLTIP — RECHARTS 3.1.0
========================================================= */

function IndicatorTooltip({
  active,
  payload,
  label,
}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  const rawPoint: unknown = payload.find(
    (entry) => entry.payload !== undefined,
  )?.payload

  if (
    typeof rawPoint !== 'object' ||
    rawPoint === null ||
    !('date' in rawPoint)
  ) {
    return null
  }

  const point = rawPoint as MergedIndicator

  const entries: Array<{
    key: IndicatorKey
    value: number | null
  }> = INDICATOR_KEYS.map((key) => ({
    key,
    value: point[key],
  }))

  return (
    <div className="max-w-[320px] rounded-xl border border-slate-600 bg-slate-950 p-4 text-sm text-white shadow-2xl">
      <p className="mb-3 font-semibold">
        📅 {formatDateLabel(String(label ?? point.date))}
      </p>

      <div className="space-y-3">
        {entries.map(({ key, value }) => (
          <div
            key={key}
            className="border-t border-slate-800 pt-2 first:border-0 first:pt-0"
          >
            <div className="flex items-center justify-between gap-4">
              <span style={{ color: INDICATOR_COLORS[key] }}>
                {INDICATOR_NAMES[key]}
              </span>

              <span className="font-semibold">
                {formatNumber(value)}
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-400">
              {getIndicatorStatus(key, value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function IndicatorChartsPage() {
  const [data, setData] = useState<MergedIndicator[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  /* =======================================================
     FETCH DATA
  ======================================================= */

  const fetchData = useCallback(async (manual = false) => {
    if (manual) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError(null)

    try {
      const now = new Date()
      const sinceDate = new Date(now.getTime() - 29 * DAY_MS)

      const since = [
        sinceDate.getFullYear(),
        String(sinceDate.getMonth() + 1).padStart(2, '0'),
        String(sinceDate.getDate()).padStart(2, '0'),
      ].join('-')

      let offset = 0
      const rows: RawIndicator[] = []

      while (true) {
        const { data: page, error: queryError } = await supabase
          .from('ai_market_signals')
          .select(
            'date,rsi_score,volume_spike_ratio,momentum,macd_signal,bollinger_band',
          )
          .gte('date', since)
          .order('date', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1)

        if (queryError) {
          throw new Error(queryError.message)
        }

        const pageRows = (page ?? []) as unknown as RawIndicator[]

        rows.push(...pageRows)

        if (pageRows.length < PAGE_SIZE) {
          break
        }

        offset += PAGE_SIZE
      }

      setData(mergeDailyIndicators(rows))
      setLastUpdated(new Date())
    } catch (err: unknown) {
      console.error(
        '[IndicatorChart] Lỗi khi tải dữ liệu Supabase:',
        err,
      )

      setError(
        err instanceof Error
          ? err.message
          : 'Không thể tải dữ liệu chỉ báo kỹ thuật.',
      )

      setData([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  /* =======================================================
     INDICATOR SUMMARY
  ======================================================= */

  const summaries = useMemo<IndicatorSummary[]>(() => {
    return INDICATOR_KEYS.map((key) => {
      const validPoints = data.filter(
        (point) => point[key] !== null,
      )

      const latestPoint =
        validPoints.length > 0
          ? validPoints[validPoints.length - 1]
          : null

      const previousPoint =
        validPoints.length > 1
          ? validPoints[validPoints.length - 2]
          : null

      const latest = latestPoint ? latestPoint[key] : null
      const previous = previousPoint ? previousPoint[key] : null

      return {
        key,
        label: INDICATOR_NAMES[key],
        latest,
        previous,
        change:
          latest !== null && previous !== null
            ? latest - previous
            : null,
        count: validPoints.length,
        description: INDICATOR_DESCRIPTIONS[key],
      }
    })
  }, [data])

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-8 text-center text-slate-300">
        <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />

        <p className="mt-4 text-sm">
          Đang tải dữ liệu chỉ báo kỹ thuật từ Supabase...
        </p>
      </div>
    )
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-white sm:p-6">
      {/* HEADER */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight">
              Technical Indicators
            </h2>

            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
              MARKET ANALYTICS
            </span>
          </div>

          <p className="mt-2 text-sm text-slate-400">
            Theo dõi lịch sử RSI, Volume Spike, Momentum, MACD và
            Bollinger Bands trong 30 ngày gần nhất.
          </p>

          {lastUpdated && (
            <p className="mt-2 text-xs text-slate-500">
              Cập nhật lúc{' '}
              {lastUpdated.toLocaleTimeString('vi-VN')}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => void fetchData(true)}
          disabled={refreshing}
          className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? 'Đang cập nhật...' : '↻ Làm mới dữ liệu'}
        </button>
      </div>

      {/* ERROR */}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4"
        >
          <p className="font-semibold text-red-300">
            Không thể tải dữ liệu
          </p>

          <p className="mt-2 break-words text-sm text-red-200">
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

      {/* SUMMARY */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {summaries.map((item) => (
          <SummaryCard
            key={item.key}
            title={item.label}
            value={formatNumber(item.latest)}
            change={item.change}
            description={
              item.latest === null
                ? 'Chưa có giá trị hợp lệ'
                : `${getIndicatorStatus(item.key, item.latest)} · ${item.count} điểm dữ liệu`
            }
            color={INDICATOR_COLORS[item.key]}
          />
        ))}
      </div>

      {/* MAIN CHART */}

      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-6">
        <div className="mb-5">
          <h3 className="text-lg font-bold">
            Lịch sử chỉ báo kỹ thuật
          </h3>

          <p className="mt-1 text-sm text-slate-400">
            Mỗi ngày tổng hợp giá trị mới nhất của từng chỉ báo.
            Các chỉ báo sử dụng chung một trục tung để quan sát.
          </p>
        </div>

        {data.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
            <span className="text-4xl">📉</span>

            <p className="mt-3 font-semibold text-slate-200">
              Chưa có dữ liệu chỉ báo
            </p>

            <p className="mt-2 max-w-lg text-sm text-slate-400">
              Kiểm tra bảng ai_market_signals, khoảng thời gian truy
              vấn và quyền đọc dữ liệu Supabase.
            </p>
          </div>
        ) : (
          <div className="h-[380px] w-full sm:h-[460px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{
                  top: 10,
                  right: 20,
                  left: 5,
                  bottom: 10,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                />

                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateLabel}
                  tick={{ fill: '#cbd5e1', fontSize: 11 }}
                  tickMargin={10}
                  minTickGap={25}
                />

                <YAxis
                  yAxisId="left"
                  tick={{ fill: '#cbd5e1', fontSize: 11 }}
                  width={55}
                />

                <Tooltip
                  content={(props) => (
                    <IndicatorTooltip
                      active={props.active}
                      payload={props.payload}
                      label={props.label}
                    />
                  )}
                />

                <Legend
                  wrapperStyle={{
                    color: '#cbd5e1',
                    paddingTop: '16px',
                  }}
                />

                <ReferenceLine
                  yAxisId="left"
                  y={30}
                  stroke="#f87171"
                  strokeDasharray="5 5"
                />

                <ReferenceLine
                  yAxisId="left"
                  y={50}
                  stroke="#64748b"
                  strokeDasharray="3 5"
                />

                <ReferenceLine
                  yAxisId="left"
                  y={70}
                  stroke="#facc15"
                  strokeDasharray="5 5"
                />

                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="rsi_score"
                  stroke={INDICATOR_COLORS.rsi_score}
                  strokeWidth={2.5}
                  name="RSI"
                  connectNulls={false}
                  dot={false}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />

                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="spike"
                  stroke={INDICATOR_COLORS.spike}
                  strokeWidth={2}
                  name="Volume Spike"
                  connectNulls={false}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />

                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="momentum"
                  stroke={INDICATOR_COLORS.momentum}
                  strokeWidth={2}
                  name="Momentum"
                  connectNulls={false}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />

                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="macd_signal"
                  stroke={INDICATOR_COLORS.macd_signal}
                  strokeWidth={2}
                  name="MACD Signal"
                  connectNulls={false}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />

                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="bollinger_band"
                  stroke={INDICATOR_COLORS.bollinger_band}
                  strokeWidth={2}
                  name="Bollinger Band"
                  connectNulls={false}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* EXPLANATION */}

        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-800/70 p-3 text-xs leading-6 text-slate-400">
          <p>
            <strong className="text-slate-200">RSI:</strong>{' '}
            dưới 30 thường được xem là vùng quá bán; trên 70 thường
            là vùng quá mua. Đây không phải tín hiệu mua bán độc lập.
          </p>

          <p>
            <strong className="text-slate-200">Volume Spike:</strong>{' '}
            tỷ lệ từ 2 lần trở lên được đánh dấu tăng mạnh theo
            ngưỡng tham khảo. Cần kiểm tra công thức tạo
            volume_spike_ratio trong hệ thống nguồn.
          </p>

          <p>
            <strong className="text-slate-200">
              MACD và Bollinger:
            </strong>{' '}
            nếu dữ liệu nguồn là nhãn văn bản, biểu đồ chỉ thể hiện
            mã hóa trạng thái, không phải giá trị MACD hoặc độ rộng
            Bollinger Bands thực tế.
          </p>

          <p>
            <strong className="text-slate-200">Lưu ý:</strong>{' '}
            các chỉ báo dùng chung một trục tung. RSI có thang đo
            0–100, trong khi các chỉ báo khác có thể sử dụng thang
            đo khác. Không nên so sánh trực tiếp độ cao giữa các
            đường để kết luận chỉ báo nào mạnh hơn.
          </p>
        </div>
      </div>

      {/* DATA QUALITY */}

      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
        <h3 className="font-bold text-white">
          Kiểm tra chất lượng dữ liệu
        </h3>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-800 p-3">
            <p className="text-xs text-slate-400">
              Số ngày có dữ liệu
            </p>

            <p className="mt-2 text-xl font-bold text-sky-300">
              {data.length.toLocaleString('vi-VN')}
            </p>
          </div>

          <div className="rounded-xl bg-slate-800 p-3">
            <p className="text-xs text-slate-400">
              Tổng số điểm RSI hợp lệ
            </p>

            <p className="mt-2 text-xl font-bold text-sky-300">
              {data
                .filter((item) => item.rsi_score !== null)
                .length.toLocaleString('vi-VN')}
            </p>
          </div>

          <div className="rounded-xl bg-slate-800 p-3">
            <p className="text-xs text-slate-400">
              Tổng số điểm Volume Spike hợp lệ
            </p>

            <p className="mt-2 text-xl font-bold text-orange-300">
              {data
                .filter((item) => item.spike !== null)
                .length.toLocaleString('vi-VN')}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

