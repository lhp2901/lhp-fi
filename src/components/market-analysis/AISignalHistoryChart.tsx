'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { supabase } from '@/lib/supabase'

/* =========================================================
   TYPES
========================================================= */

type IndexCode = 'VNINDEX' | 'VN30'
type IndexFilter = 'ALL' | IndexCode
type PeriodDays = 7 | 14 | 30 | 90

type SignalRow = {
  date: string
  index_code: string
  confidence_score: number | string | null
  label_win: number | string | boolean | null
}

type HistoryPoint = {
  timestamp: number
  date: string
  indexCode: IndexCode
  confidence: number | null
  labelWin: number | null
}

type ChartRow = {
  date: string
  timestamp: number
  VNINDEX?: number
  VNINDEX_label?: number | null
  VN30?: number
  VN30_label?: number | null
}

type IndexStats = {
  count: number
  averageConfidence: number | null
  winRate: number | null
  labeledCount: number
}

type TooltipEntry = {
  name?: string | number
  value?: string | number
  color?: string
  dataKey?: string | number
  payload?: Record<string, unknown>
}

type CustomTooltipProps = {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
}

/* =========================================================
   CONSTANTS
========================================================= */

const INDEX_COLORS: Record<IndexCode, string> = {
  VNINDEX: '#2563eb',
  VN30: '#9333ea',
}

const PERIOD_OPTIONS: { label: string; value: PeriodDays }[] = [
  { label: '7 ngày', value: 7 },
  { label: '14 ngày', value: 14 },
  { label: '30 ngày', value: 30 },
  { label: '90 ngày', value: 90 },
]

const INDEX_OPTIONS: { label: string; value: IndexFilter }[] = [
  { label: 'Tất cả chỉ số', value: 'ALL' },
  { label: 'VNINDEX', value: 'VNINDEX' },
  { label: 'VN30', value: 'VN30' },
]

/* =========================================================
   DATA PARSING
========================================================= */

function parseIndexCode(value: string): IndexCode | null {
  const normalized = value.trim().toUpperCase()

  if (normalized === 'VNINDEX' || normalized === 'VN30') {
    return normalized
  }

  return null
}

/**
 * Chuẩn hóa confidence_score.
 *
 * Mặc định giả định dữ liệu được lưu trong khoảng 0–1.
 * Nếu database lưu theo thang 0–100, hãy đổi quy tắc tại đây.
 */
function parseConfidence(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return null
  }

  return parsed
}

/**
 * Chuẩn hóa label_win.
 *
 * Chấp nhận:
 * - Số 1 hoặc 0
 * - Boolean true hoặc false
 * - Chuỗi "1", "0", "true", "false"
 *
 * Giá trị khác được xem là chưa có nhãn.
 */
function parseLabelWin(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }

  if (typeof value === 'number') {
    return value === 1 || value === 0 ? value : null
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()

    if (normalized === '1' || normalized === 'true') {
      return 1
    }

    if (normalized === '0' || normalized === 'false') {
      return 0
    }
  }

  return null
}

/**
 * Chuẩn hóa ngày và timestamp.
 *
 * Lưu ý: nếu date trong database là timestamp có múi giờ,
 * cách hiển thị ngày được lấy theo múi giờ của trình duyệt.
 */
function parseDate(value: string): {
  timestamp: number
  date: string
} | null {
  if (!value) return null

  const timestamp = Date.parse(value)

  if (!Number.isFinite(timestamp)) {
    return null
  }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : new Date(timestamp).toLocaleDateString('sv-SE')

  return {
    timestamp,
    date,
  }
}

function formatDateLabel(value: string): string {
  const parsed = parseDate(value)

  if (!parsed) return value

  const date = new Date(parsed.timestamp)

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  })
}

function formatDateTime(value: string): string {
  const parsed = parseDate(value)

  if (!parsed) return value

  return new Date(parsed.timestamp).toLocaleString('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '—'
  }

  return `${(value * 100).toLocaleString('vi-VN', {
    maximumFractionDigits: 2,
  })}%`
}

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '—'
  }

  return value.toLocaleString('vi-VN', {
    maximumFractionDigits: 4,
  })
}

/* =========================================================
   CUSTOM TOOLTIP
========================================================= */

function CustomTooltip({
  active,
  payload,
  label,
}: CustomTooltipProps) {
  if (!active || !payload?.length) {
    return null
  }

  const validItems: TooltipEntry[] = payload.filter(
    (item: TooltipEntry) =>
      item.value !== undefined &&
      item.value !== null &&
      item.value !== '' &&
      Number.isFinite(Number(item.value))
  )

  if (validItems.length === 0) {
    return null
  }

  const formattedLabel =
    typeof label === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(label)
      ? formatDateTime(label)
      : String(label ?? 'Thông tin tín hiệu')

  return (
    <div className="min-w-[210px] rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
      <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
        {formattedLabel}
      </p>

      <div className="space-y-3">
        {validItems.map((item: TooltipEntry, index: number) => {
          const dataKey = String(item.dataKey ?? item.name ?? 'signal')
          const isConfidence = dataKey === 'VNINDEX' || dataKey === 'VN30'

          const labelText =
            dataKey === 'VNINDEX'
              ? 'VNINDEX'
              : dataKey === 'VN30'
                ? 'VN30'
                : String(item.name ?? dataKey)

          const numericValue = Number(item.value)

          return (
            <div
              key={`${dataKey}-${index}`}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: item.color ?? '#64748b',
                  }}
                />

                <span className="text-sm text-slate-600 dark:text-slate-300">
                  {labelText}
                </span>
              </div>

              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {isConfidence
                  ? formatPercent(numericValue)
                  : formatNumber(numericValue)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* =========================================================
   STATISTICS
========================================================= */

function calculateStats(
  points: HistoryPoint[],
  indexCode: IndexCode
): IndexStats {
  const filtered = points.filter(
    (point) => point.indexCode === indexCode
  )

  const confidenceValues = filtered
    .map((point) => point.confidence)
    .filter((value): value is number => value !== null)

  const labeledValues = filtered
    .map((point) => point.labelWin)
    .filter((value): value is number => value !== null)

  const averageConfidence =
    confidenceValues.length > 0
      ? confidenceValues.reduce((sum, value) => sum + value, 0) /
        confidenceValues.length
      : null

  const winRate =
    labeledValues.length > 0
      ? labeledValues.reduce((sum, value) => sum + value, 0) /
        labeledValues.length
      : null

  return {
    count: filtered.length,
    averageConfidence,
    winRate,
    labeledCount: labeledValues.length,
  }
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>

        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-xl dark:bg-slate-800">
          {icon}
        </span>
      </div>
    </div>
  )
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function AISignalHistoryChart() {
  const [rawPoints, setRawPoints] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [period, setPeriod] = useState<PeriodDays>(14)
  const [indexFilter, setIndexFilter] = useState<IndexFilter>('ALL')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

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
        sinceDate.setDate(sinceDate.getDate() - period)

        const since = sinceDate.toISOString().split('T')[0]

        const pageSize = 1000
        let offset = 0
        let allRows: SignalRow[] = []

        while (true) {
          let query = supabase
            .from('ai_market_signals')
            .select(
              'date, index_code, confidence_score, label_win'
            )
            .gte('date', since)
            .order('date', { ascending: true })
            .range(offset, offset + pageSize - 1)

          if (indexFilter !== 'ALL') {
            query = query.eq('index_code', indexFilter)
          } else {
            query = query.in('index_code', ['VNINDEX', 'VN30'])
          }

          const { data, error: queryError } = await query

          if (queryError) {
            throw new Error(queryError.message)
          }

          const rows = (data ?? []) as SignalRow[]

          allRows = allRows.concat(rows)

          if (rows.length < pageSize) {
            break
          }

          offset += pageSize
        }

        const parsedPoints: HistoryPoint[] = []

        for (const row of allRows) {
          const indexCode = parseIndexCode(row.index_code)

          if (!indexCode) continue

          const parsedDate = parseDate(row.date)

          if (!parsedDate) continue

          parsedPoints.push({
            timestamp: parsedDate.timestamp,
            date: parsedDate.date,
            indexCode,
            confidence: parseConfidence(row.confidence_score),
            labelWin: parseLabelWin(row.label_win),
          })
        }

        parsedPoints.sort((a, b) => a.timestamp - b.timestamp)

        setRawPoints(parsedPoints)
        setLastUpdated(new Date())
      } catch (err: unknown) {
        console.error(
          '[AISignalHistoryChart] Không thể tải dữ liệu:',
          err
        )

        setError(
          err instanceof Error
            ? err.message
            : 'Không thể tải dữ liệu tín hiệu từ Supabase.'
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [period, indexFilter]
  )

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  /* =======================================================
     FILTERED DATA
  ======================================================= */

  const filteredPoints = useMemo(() => {
    if (indexFilter === 'ALL') {
      return rawPoints
    }

    return rawPoints.filter(
      (point) => point.indexCode === indexFilter
    )
  }, [rawPoints, indexFilter])

  /* =======================================================
     CHART DATA
     Một điểm cho mỗi ngày và mỗi chỉ số.
     Nếu có nhiều tín hiệu cùng ngày, lấy tín hiệu mới nhất
     theo timestamp để tránh dữ liệu bị ghi đè tùy tiện.
  ======================================================= */

  const chartData = useMemo<ChartRow[]>(() => {
    const grouped = new Map<string, ChartRow>()

    for (const point of filteredPoints) {
      let existing = grouped.get(point.date)

      if (!existing) {
        existing = {
          date: point.date,
          timestamp: point.timestamp,
        }

        grouped.set(point.date, existing)
      }

      if (point.timestamp > existing.timestamp) {
        existing.timestamp = point.timestamp
      }

      if (point.indexCode === 'VNINDEX') {
        const existingTimestamp = (
          existing as ChartRow & {
            VNINDEX_timestamp?: number
          }
        ).VNINDEX_timestamp

        if (
          existingTimestamp === undefined ||
          point.timestamp >= existingTimestamp
        ) {
          existing.VNINDEX = point.confidence ?? undefined
          existing.VNINDEX_label = point.labelWin

          ;(
            existing as ChartRow & {
              VNINDEX_timestamp?: number
            }
          ).VNINDEX_timestamp = point.timestamp
        }
      }

      if (point.indexCode === 'VN30') {
        const existingTimestamp = (
          existing as ChartRow & {
            VN30_timestamp?: number
          }
        ).VN30_timestamp

        if (
          existingTimestamp === undefined ||
          point.timestamp >= existingTimestamp
        ) {
          existing.VN30 = point.confidence ?? undefined
          existing.VN30_label = point.labelWin

          ;(
            existing as ChartRow & {
              VN30_timestamp?: number
            }
          ).VN30_timestamp = point.timestamp
        }
      }
    }

    return Array.from(grouped.values()).sort(
      (a, b) => a.timestamp - b.timestamp
    )
  }, [filteredPoints])

  /* =======================================================
     STATISTICS
  ======================================================= */

  const vnindexStats = useMemo(
    () => calculateStats(filteredPoints, 'VNINDEX'),
    [filteredPoints]
  )

  const vn30Stats = useMemo(
    () => calculateStats(filteredPoints, 'VN30'),
    [filteredPoints]
  )

  const overallStats = useMemo(() => {
    const confidenceValues = filteredPoints
      .map((point) => point.confidence)
      .filter((value): value is number => value !== null)

    const labeledValues = filteredPoints
      .map((point) => point.labelWin)
      .filter((value): value is number => value !== null)

    const averageConfidence =
      confidenceValues.length > 0
        ? confidenceValues.reduce((sum, value) => sum + value, 0) /
          confidenceValues.length
        : null

    const winRate =
      labeledValues.length > 0
        ? labeledValues.reduce((sum, value) => sum + value, 0) /
          labeledValues.length
        : null

    return {
      total: filteredPoints.length,
      averageConfidence,
      winRate,
      labeledCount: labeledValues.length,
    }
  }, [filteredPoints])

  const showVNINDEX = indexFilter !== 'VN30'
  const showVN30 = indexFilter !== 'VNINDEX'

  /* =======================================================
     RENDER
  ======================================================= */

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-center gap-3 py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />

          <p className="text-sm text-slate-500 dark:text-slate-400">
            Đang tải lịch sử tín hiệu từ Supabase...
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Lịch sử tín hiệu AI
            </h2>

            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              SUPABASE
            </span>
          </div>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Theo dõi độ tin cậy và kết quả nhãn của VNINDEX, VN30 theo thời gian.
          </p>

          {lastUpdated && (
            <p className="mt-2 text-xs text-slate-400">
              Cập nhật lúc {lastUpdated.toLocaleTimeString('vi-VN')}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={period}
            onChange={(event) =>
              setPeriod(Number(event.target.value) as PeriodDays)
            }
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            aria-label="Chọn khoảng thời gian"
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={indexFilter}
            onChange={(event) =>
              setIndexFilter(event.target.value as IndexFilter)
            }
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            aria-label="Chọn chỉ số"
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
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className={refreshing ? 'animate-spin' : ''}>↻</span>
            {refreshing ? 'Đang tải...' : 'Làm mới'}
          </button>
        </div>
      </div>

      {/* ERROR */}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30"
        >
          <p className="font-semibold text-red-700 dark:text-red-400">
            Không thể tải dữ liệu lịch sử
          </p>

          <p className="mt-1 break-words text-sm text-red-600 dark:text-red-300">
            {error}
          </p>

          <button
            type="button"
            onClick={() => void fetchData(true)}
            className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* SUMMARY CARDS */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Tổng số tín hiệu"
          value={overallStats.total.toLocaleString('vi-VN')}
          description={`Trong ${period} ngày gần nhất`}
          icon="📊"
        />

        <SummaryCard
          title="Độ tin cậy trung bình"
          value={formatPercent(overallStats.averageConfidence)}
          description="Trung bình các confidence_score hợp lệ"
          icon="🎯"
        />

        <SummaryCard
          title="Tỷ lệ nhãn thắng"
          value={formatPercent(overallStats.winRate)}
          description={`${overallStats.labeledCount} tín hiệu đã có label_win`}
          icon="📈"
        />

        <SummaryCard
          title="Số ngày có dữ liệu"
          value={chartData.length.toLocaleString('vi-VN')}
          description="Số ngày có ít nhất một bản ghi hợp lệ"
          icon="🗓️"
        />
      </div>

      {/* CHART */}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Biến động độ tin cậy
            </h3>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Mỗi ngày hiển thị tín hiệu mới nhất của từng chỉ số.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {showVNINDEX && (
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                VNINDEX
              </span>
            )}

            {showVN30 && (
              <span className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                <span className="h-2 w-2 rounded-full bg-purple-600" />
                VN30
              </span>
            )}
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
            <span className="text-4xl">📉</span>

            <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
              Chưa có dữ liệu biểu đồ
            </p>

            <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
              Không tìm thấy bản ghi VNINDEX hoặc VN30 hợp lệ trong khoảng thời gian đã chọn.
            </p>
          </div>
        ) : (
          <div className="h-[340px] w-full sm:h-[400px]">
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
                  stroke="#94a3b8"
                  opacity={0.2}
                />

                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateLabel}
                  tick={{ fontSize: 12 }}
                  tickMargin={10}
                  minTickGap={24}
                />

                <YAxis
                  domain={[0, 1]}
                  tickFormatter={(value: number) =>
                    `${Math.round(value * 100)}%`
                  }
                  tick={{ fontSize: 12 }}
                  width={55}
                />

                <Tooltip content={<CustomTooltip />} />

                <Legend />

                {showVNINDEX && (
                  <Line
                    type="monotone"
                    dataKey="VNINDEX"
                    name="VNINDEX"
                    stroke={INDEX_COLORS.VNINDEX}
                    strokeWidth={2.5}
                    connectNulls={false}
                    dot={{
                      r: 3,
                      fill: INDEX_COLORS.VNINDEX,
                      strokeWidth: 1,
                    }}
                    activeDot={{ r: 6 }}
                    isAnimationActive={false}
                  />
                )}

                {showVN30 && (
                  <Line
                    type="monotone"
                    dataKey="VN30"
                    name="VN30"
                    stroke={INDEX_COLORS.VN30}
                    strokeWidth={2.5}
                    connectNulls={false}
                    dot={{
                      r: 3,
                      fill: INDEX_COLORS.VN30,
                      strokeWidth: 1,
                    }}
                    activeDot={{ r: 6 }}
                    isAnimationActive={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <strong>Lưu ý:</strong> Độ tin cậy AI được hiển thị theo thang 0–100%.
          Tỷ lệ nhãn thắng được tính từ các bản ghi có label_win bằng 1 hoặc 0;
          đây không mặc nhiên là tỷ lệ dự đoán đúng hay tỷ suất sinh lời thực tế.
        </div>
      </div>

      {/* INDEX DETAILS */}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {showVNINDEX && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">
                  VNINDEX
                </h3>

                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Thống kê trong {period} ngày
                </p>
              </div>

              <span className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                HOSE
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Số tín hiệu
                </p>

                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {vnindexStats.count.toLocaleString('vi-VN')}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Độ tin cậy TB
                </p>

                <p className="mt-1 text-xl font-bold text-blue-600">
                  {formatPercent(vnindexStats.averageConfidence)}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tỷ lệ nhãn thắng
                </p>

                <p className="mt-1 text-xl font-bold text-emerald-600">
                  {formatPercent(vnindexStats.winRate)}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Số nhãn đã xác định
                </p>

                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {vnindexStats.labeledCount.toLocaleString('vi-VN')}
                </p>
              </div>
            </div>
          </div>
        )}

        {showVN30 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">
                  VN30
                </h3>

                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Thống kê trong {period} ngày
                </p>
              </div>

              <span className="rounded-lg bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                VN30
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Số tín hiệu
                </p>

                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {vn30Stats.count.toLocaleString('vi-VN')}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Độ tin cậy TB
                </p>

                <p className="mt-1 text-xl font-bold text-purple-600">
                  {formatPercent(vn30Stats.averageConfidence)}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tỷ lệ nhãn thắng
                </p>

                <p className="mt-1 text-xl font-bold text-emerald-600">
                  {formatPercent(vn30Stats.winRate)}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Số nhãn đã xác định
                </p>

                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {vn30Stats.labeledCount.toLocaleString('vi-VN')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DATA TABLE */}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-5 dark:border-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-white">
            Dữ liệu lịch sử tín hiệu
          </h3>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Hiển thị tối đa 20 bản ghi mới nhất trong dữ liệu đã tải.
          </p>
        </div>

        {filteredPoints.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Không có bản ghi để hiển thị.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">Ngày</th>
                  <th className="px-5 py-3 font-semibold">Chỉ số</th>
                  <th className="px-5 py-3 text-right font-semibold">
                    Độ tin cậy
                  </th>
                  <th className="px-5 py-3 text-center font-semibold">
                    Nhãn kết quả
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {[...filteredPoints]
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .slice(0, 20)
                  .map((point, index) => (
                    <tr
                      key={`${point.indexCode}-${point.timestamp}-${index}`}
                      className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="whitespace-nowrap px-5 py-3 text-slate-600 dark:text-slate-300">
                        {formatDateTime(point.date)}
                      </td>

                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${
                            point.indexCode === 'VNINDEX'
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                          }`}
                        >
                          {point.indexCode}
                        </span>
                      </td>

                      <td className="px-5 py-3 text-right font-semibold text-slate-900 dark:text-white">
                        {formatPercent(point.confidence)}
                      </td>

                      <td className="px-5 py-3 text-center">
                        {point.labelWin === null ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            Chưa xác định
                          </span>
                        ) : point.labelWin === 1 ? (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            Thắng
                          </span>
                        ) : (
                          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
                            Không thắng
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}