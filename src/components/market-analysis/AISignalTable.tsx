'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

/* =========================================================
   TYPES
========================================================= */

type IndexCode = 'VNINDEX' | 'VN30'
type IndexFilter = 'ALL' | IndexCode
type TimeRange = 'today' | 'week' | 'month' | 'custom'

type Signal = {
  id?: string | number
  date: string
  index_code: string
  signal_type: string | null
  confidence_score: number | string | null

  volatility_tag?: string | null
  volume_behavior?: string | null
  notes?: string | null
  market_sentiment?: string | null

  rsi_score?: number | string | null
  volume_spike_ratio?: number | string | null
  trend_strength?: string | null
  momentum?: number | string | null
  macd_signal?: string | null
  bollinger_band?: string | null
  foreign_flow?: number | string | null
}

type SignalStats = {
  total: number
  bullish: number
  bearish: number
  neutral: number
  averageConfidence: number | null
}

type FetchResult = {
  rows: Signal[]
  error: string | null
}

const PAGE_SIZE = 10

/* =========================================================
   CONSTANTS
========================================================= */

const INDEX_OPTIONS: { label: string; value: IndexFilter }[] = [
  { label: 'Tất cả chỉ số', value: 'ALL' },
  { label: 'VNINDEX', value: 'VNINDEX' },
  { label: 'VN30', value: 'VN30' },
]

const TIME_OPTIONS: { label: string; value: TimeRange }[] = [
  { label: 'Hôm nay', value: 'today' },
  { label: '7 ngày gần nhất', value: 'week' },
  { label: '30 ngày gần nhất', value: 'month' },
  { label: 'Tùy chọn', value: 'custom' },
]

/* =========================================================
   DATA HELPERS
========================================================= */

/**
 * Chuẩn hóa số từ Supabase.
 * Trả về null nếu giá trị không hợp lệ.
 */
function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value === 'string' && value.trim() === '') {
    return null
  }

  const numberValue = Number(value)

  return Number.isFinite(numberValue) ? numberValue : null
}

function parseIndexCode(value: string): IndexCode | null {
  const normalized = value.trim().toUpperCase()

  if (normalized === 'VNINDEX' || normalized === 'VN30') {
    return normalized
  }

  return null
}

/**
 * Chuẩn hóa confidence_score về dạng số từ 0 đến 1.
 *
 * Quy tắc:
 * - 0 đến 1: hiểu là tỷ lệ.
 * - Trên 1 đến 100: hiểu là phần trăm và chia 100.
 * - Ngoài phạm vi trên: không hiển thị như dữ liệu hợp lệ.
 *
 * Chỉ nên dùng quy tắc này khi database không trộn lẫn
 * hai cách lưu thang điểm cho cùng một tập dữ liệu.
 */
function parseConfidence(value: unknown): number | null {
  const numberValue = parseNumber(value)

  if (numberValue === null || numberValue < 0) {
    return null
  }

  if (numberValue <= 1) {
    return numberValue
  }

  if (numberValue <= 100) {
    return numberValue / 100
  }

  return null
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return '—'
  }

  return `${(value * 100).toLocaleString('vi-VN', {
    maximumFractionDigits: 2,
  })}%`
}

function formatNumeric(
  value: unknown,
  maximumFractionDigits = 2
): string {
  const numberValue = parseNumber(value)

  if (numberValue === null) {
    return '—'
  }

  return numberValue.toLocaleString('vi-VN', {
    maximumFractionDigits,
  })
}

/**
 * Nếu date là timestamp ISO, chuyển sang ngày theo múi giờ
 * của trình duyệt. Nếu date đã có dạng YYYY-MM-DD,
 * giữ nguyên phần ngày để tránh lệch ngày.
 */
function getDateKey(value: string): string | null {
  if (!value) {
    return null
  }

  const dateOnlyMatch = value.match(/^(\d{4}-\d{2}-\d{2})$/)

  if (dateOnlyMatch) {
    return dateOnlyMatch[1]
  }

  const timestamp = Date.parse(value)

  if (!Number.isFinite(timestamp)) {
    return null
  }

  const date = new Date(timestamp)

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatDate(value: string): string {
  const dateKey = getDateKey(value)

  if (!dateKey) {
    return '—'
  }

  const [year, month, day] = dateKey.split('-')

  return `${day}/${month}/${year}`
}

function formatDateTime(value: string): string {
  const timestamp = Date.parse(value)

  if (!Number.isFinite(timestamp)) {
    return formatDate(value)
  }

  return new Date(timestamp).toLocaleString('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function getToday(): string {
  const now = new Date()

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

function getStartDate(range: Exclude<TimeRange, 'custom'>): string {
  const date = new Date()

  if (range === 'today') {
    return getToday()
  }

  if (range === 'week') {
    date.setDate(date.getDate() - 6)
  } else {
    date.setDate(date.getDate() - 29)
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

/**
 * Chuẩn hóa chuỗi để xử lý các cách viết khác nhau
 * của loại tín hiệu.
 */
function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFC')
}

function getSignalCategory(
  signalType: string | null | undefined
): 'bullish' | 'bearish' | 'neutral' {
  const value = normalizeText(signalType)

  if (
    value.includes('bullish') ||
    value.includes('buy') ||
    value.includes('strong_buy') ||
    value.includes('tăng') ||
    value.includes('mua')
  ) {
    return 'bullish'
  }

  if (
    value.includes('bearish') ||
    value.includes('sell') ||
    value.includes('strong_sell') ||
    value.includes('giảm') ||
    value.includes('bán')
  ) {
    return 'bearish'
  }

  return 'neutral'
}

function getSignalLabel(signalType: string | null | undefined): string {
  if (!signalType?.trim()) {
    return 'Chưa xác định'
  }

  const category = getSignalCategory(signalType)

  if (category === 'bullish') {
    return 'Tín hiệu tăng'
  }

  if (category === 'bearish') {
    return 'Tín hiệu giảm'
  }

  return signalType
}

function getSignalClass(signalType: string | null | undefined): string {
  const category = getSignalCategory(signalType)

  if (category === 'bullish') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900'
  }

  if (category === 'bearish') {
    return 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900'
  }

  return 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700'
}

function getConfidenceClass(value: number | null): string {
  if (value === null) {
    return 'text-slate-400'
  }

  if (value >= 0.8) {
    return 'text-emerald-600 dark:text-emerald-400'
  }

  if (value >= 0.6) {
    return 'text-blue-600 dark:text-blue-400'
  }

  if (value >= 0.4) {
    return 'text-amber-600 dark:text-amber-400'
  }

  return 'text-red-600 dark:text-red-400'
}

function getSentimentStyle(value: string | null | undefined): {
  label: string
  className: string
} {
  const normalized = normalizeText(value)

  if (
    normalized.includes('tham lam') ||
    normalized.includes('greed')
  ) {
    return {
      label: '😎 Tham lam',
      className: 'text-emerald-600 dark:text-emerald-400',
    }
  }

  if (
    normalized.includes('sợ hãi') ||
    normalized.includes('so hai') ||
    normalized.includes('fear')
  ) {
    return {
      label: '😨 Sợ hãi',
      className: 'text-red-600 dark:text-red-400',
    }
  }

  if (
    normalized.includes('trung lập') ||
    normalized.includes('trung lap') ||
    normalized.includes('neutral')
  ) {
    return {
      label: '🧠 Trung lập',
      className: 'text-amber-600 dark:text-amber-400',
    }
  }

  return {
    label: value?.trim() || '—',
    className: 'text-slate-500 dark:text-slate-400',
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
        <div className="min-w-0">
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

        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl dark:bg-slate-800">
          {icon}
        </span>
      </div>
    </div>
  )
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function AISignalTable() {
  const [data, setData] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedIndex, setSelectedIndex] =
    useState<IndexFilter>('ALL')

  const [timeRange, setTimeRange] = useState<TimeRange>('week')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)

  /* =======================================================
     FETCH DATA
  ======================================================= */

  const fetchData = useCallback(
    async (manualRefresh = false) => {
      if (timeRange === 'custom') {
        if (!fromDate || !toDate) {
          setData([])
          setError(null)
          setLoading(false)
          setRefreshing(false)
          return
        }

        if (fromDate > toDate) {
          setData([])
          setError('Ngày bắt đầu không được sau ngày kết thúc.')
          setLoading(false)
          setRefreshing(false)
          return
        }
      }

      if (manualRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError(null)

      try {
        const startDate =
          timeRange === 'custom'
            ? fromDate
            : getStartDate(timeRange)

        const endDate = getToday()

        /*
         * Lấy đến đầu ngày kế tiếp rồi dùng điều kiện < để
         * bao gồm toàn bộ ngày kết thúc khi date là timestamp.
         */
        const effectiveEndDate =
          timeRange === 'custom' ? toDate : endDate

        const nextDay = new Date(`${effectiveEndDate}T00:00:00`)
        nextDay.setDate(nextDay.getDate() + 1)

        const endExclusive = [
          nextDay.getFullYear(),
          String(nextDay.getMonth() + 1).padStart(2, '0'),
          String(nextDay.getDate()).padStart(2, '0'),
        ].join('-')

        const selectedColumns = [
          'date',
          'index_code',
          'signal_type',
          'confidence_score',
          'volatility_tag',
          'volume_behavior',
          'notes',
          'market_sentiment',
          'rsi_score',
          'volume_spike_ratio',
          'trend_strength',
          'momentum',
          'macd_signal',
          'bollinger_band',
          'foreign_flow',
        ].join(', ')

        const pageSize = 1000
        const requiredCount = limit
        const fetchedRows: Signal[] = []

        let offset = 0

        while (fetchedRows.length < requiredCount) {
          const batchSize = Math.min(
            pageSize,
            requiredCount - fetchedRows.length
          )

          let query = supabase
            .from('ai_market_signals')
            .select(selectedColumns)
            .gte('date', startDate)
            .lt('date', endExclusive)
            .order('date', { ascending: false })
            .range(offset, offset + batchSize - 1)

          if (selectedIndex !== 'ALL') {
            query = query.eq('index_code', selectedIndex)
          } else {
            query = query.in('index_code', ['VNINDEX', 'VN30'])
          }

          const { data: rows, error: queryError } = await query

          if (queryError) {
            throw new Error(queryError.message)
          }

          const typedRows = (rows ?? []) as unknown as Signal[]

          fetchedRows.push(...typedRows)

          if (typedRows.length < batchSize) {
            break
          }

          offset += typedRows.length
        }

        setData(fetchedRows)
      } catch (err: unknown) {
        console.error(
          '[AISignalTable] Lỗi khi lấy dữ liệu tín hiệu:',
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
    [selectedIndex, timeRange, fromDate, toDate, limit]
  )

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  /* =======================================================
     FILTERED / NORMALIZED DATA
  ======================================================= */

  const normalizedData = useMemo(() => {
    return data.filter((row) => {
      if (!row.date || !parseIndexCode(row.index_code)) {
        return false
      }

      return true
    })
  }, [data])

  /* =======================================================
     STATISTICS
  ======================================================= */

  const stats = useMemo<SignalStats>(() => {
    const confidenceValues = normalizedData
      .map((row) => parseConfidence(row.confidence_score))
      .filter((value): value is number => value !== null)

    const bullish = normalizedData.filter(
      (row) => getSignalCategory(row.signal_type) === 'bullish'
    ).length

    const bearish = normalizedData.filter(
      (row) => getSignalCategory(row.signal_type) === 'bearish'
    ).length

    const neutral = normalizedData.length - bullish - bearish

    const averageConfidence =
      confidenceValues.length > 0
        ? confidenceValues.reduce((sum, value) => sum + value, 0) /
          confidenceValues.length
        : null

    return {
      total: normalizedData.length,
      bullish,
      bearish,
      neutral,
      averageConfidence,
    }
  }, [normalizedData])

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <section className="space-y-6 text-slate-900 dark:text-white">
      {/* HEADER */}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight">
              Bảng dữ liệu tín hiệu AI
            </h2>

            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              LIVE DATA VIEW
            </span>
          </div>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Theo dõi tín hiệu, độ tin cậy và chỉ báo kỹ thuật từ Supabase.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void fetchData(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 xl:self-auto"
        >
          <span className={refreshing ? 'animate-spin' : ''}>↻</span>
          {refreshing ? 'Đang cập nhật...' : 'Làm mới dữ liệu'}
        </button>
      </div>

      {/* FILTERS */}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <label
              htmlFor="signal-index-filter"
              className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300"
            >
              Chỉ số thị trường
            </label>

            <select
              id="signal-index-filter"
              value={selectedIndex}
              onChange={(event) => {
                setSelectedIndex(event.target.value as IndexFilter)
                setLimit(PAGE_SIZE)
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
            >
              {INDEX_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="signal-time-filter"
              className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300"
            >
              Khoảng thời gian
            </label>

            <select
              id="signal-time-filter"
              value={timeRange}
              onChange={(event) => {
                setTimeRange(event.target.value as TimeRange)
                setLimit(PAGE_SIZE)
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
            >
              {TIME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {timeRange === 'custom' ? (
            <>
              <div>
                <label
                  htmlFor="signal-from-date"
                  className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300"
                >
                  Từ ngày
                </label>

                <input
                  id="signal-from-date"
                  type="date"
                  value={fromDate}
                  max={toDate || getToday()}
                  onChange={(event) => {
                    setFromDate(event.target.value)
                    setLimit(PAGE_SIZE)
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div>
                <label
                  htmlFor="signal-to-date"
                  className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300"
                >
                  Đến ngày
                </label>

                <input
                  id="signal-to-date"
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  max={getToday()}
                  onChange={(event) => {
                    setToDate(event.target.value)
                    setLimit(PAGE_SIZE)
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </>
          ) : (
            <div className="flex items-end sm:col-span-2 xl:col-span-2">
              <div className="w-full rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Khoảng dữ liệu
                </p>

                <p className="mt-1 text-sm font-semibold">
                  {getStartDate(timeRange)} → {getToday()}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ERROR */}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30"
        >
          <p className="font-semibold text-red-700 dark:text-red-400">
            Không thể tải dữ liệu
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

      {/* SUMMARY */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Tổng số tín hiệu"
          value={stats.total.toLocaleString('vi-VN')}
          description="Các bản ghi đang hiển thị"
          icon="📊"
        />

        <SummaryCard
          title="Độ tin cậy trung bình"
          value={formatPercent(stats.averageConfidence)}
          description="Chỉ tính điểm hợp lệ"
          icon="🎯"
        />

        <SummaryCard
          title="Tín hiệu tăng"
          value={stats.bullish.toLocaleString('vi-VN')}
          description="Phân loại từ signal_type"
          icon="📈"
        />

        <SummaryCard
          title="Tín hiệu giảm"
          value={stats.bearish.toLocaleString('vi-VN')}
          description="Phân loại từ signal_type"
          icon="📉"
        />
      </div>

      {/* LOADING */}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />

          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Đang tải dữ liệu tín hiệu từ Supabase...
          </p>
        </div>
      ) : normalizedData.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <span className="text-4xl">📭</span>

          <h3 className="mt-3 font-semibold">
            Chưa có dữ liệu tín hiệu
          </h3>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Hãy kiểm tra khoảng thời gian, chỉ số hoặc dữ liệu trong Supabase.
          </p>

          <button
            type="button"
            onClick={() => void fetchData(true)}
            className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Tải lại
          </button>
        </div>
      ) : (
        <>
          {/* TABLE */}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
              <div>
                <h3 className="font-bold">
                  Chi tiết tín hiệu thị trường
                </h3>

                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Dữ liệu sắp xếp theo thời gian giảm dần.
                </p>
              </div>

              <span className="self-start rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:self-auto">
                {normalizedData.length.toLocaleString('vi-VN')} bản ghi
              </span>
            </div>

            <div className="max-h-[650px] overflow-auto">
              <table className="min-w-[1800px] w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">
                      Ngày
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 font-semibold">
                      Chỉ số
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 font-semibold">
                      Tín hiệu
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                      Tin cậy
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 font-semibold">
                      Biến động
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 font-semibold">
                      Hành vi KL
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 font-semibold">
                      Tâm lý
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                      RSI
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                      Volume Spike
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 font-semibold">
                      Trend Strength
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                      Momentum
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 font-semibold">
                      MACD
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 font-semibold">
                      Bollinger
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                      Dòng tiền NN
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 font-semibold">
                      Ghi chú
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {normalizedData.map((row, index) => {
                    const confidence = parseConfidence(
                      row.confidence_score
                    )

                    const sentiment = getSentimentStyle(
                      row.market_sentiment
                    )

                    const indexCode = parseIndexCode(row.index_code)

                    return (
                      <tr
                        key={`${row.index_code}-${row.date}-${index}`}
                        className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                          {formatDate(row.date)}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${
                              indexCode === 'VNINDEX'
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                : 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                            }`}
                          >
                            {indexCode ?? row.index_code}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${getSignalClass(
                              row.signal_type
                            )}`}
                          >
                            {getSignalLabel(row.signal_type)}
                          </span>
                        </td>

                        <td
                          className={`whitespace-nowrap px-4 py-3 text-right font-bold ${getConfidenceClass(
                            confidence
                          )}`}
                          title="Giá trị chuẩn hóa về thang 0–1"
                        >
                          {formatPercent(confidence)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                          {row.volatility_tag || '—'}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                          {row.volume_behavior || '—'}
                        </td>

                        <td
                          className={`whitespace-nowrap px-4 py-3 font-semibold ${sentiment.className}`}
                        >
                          {sentiment.label}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {formatNumeric(row.rsi_score)}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {formatNumeric(row.volume_spike_ratio, 3)}
                          {parseNumber(row.volume_spike_ratio) !== null
                            ? 'x'
                            : ''}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                          {row.trend_strength || '—'}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {formatNumeric(row.momentum, 4)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                          {row.macd_signal || '—'}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                          {row.bollinger_band || '—'}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {formatNumeric(row.foreign_flow, 3)}
                          {parseNumber(row.foreign_flow) !== null
                            ? ' tỷ'
                            : ''}
                        </td>

                        <td
                          className="max-w-[240px] truncate px-4 py-3 text-slate-500 dark:text-slate-400"
                          title={row.notes || ''}
                        >
                          {row.notes || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* FOOTER */}

            <div className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Đang hiển thị {normalizedData.length.toLocaleString('vi-VN')}{' '}
                bản ghi theo bộ lọc hiện tại.
              </p>

              <button
                type="button"
                onClick={() => setLimit((current) => current + PAGE_SIZE)}
                disabled={normalizedData.length < limit || refreshing}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Tải thêm 10 bản ghi
              </button>
            </div>
          </div>
        </>
      )}

      {/* FOOTNOTE */}

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <strong>Lưu ý về độ chính xác:</strong> Độ tin cậy là điểm do hệ thống
        AI cung cấp, không mặc nhiên đồng nghĩa với xác suất dự báo đúng.
        Phân loại tăng/giảm được suy ra từ tên tín hiệu; cần đối chiếu với
        quy ước thực tế của backend. Dữ liệu không hợp lệ sẽ không được dùng
        để tính độ tin cậy trung bình.
      </div>
    </section>
  )
}