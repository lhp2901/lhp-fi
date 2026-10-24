
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { supabase } from '@/lib/supabase'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts'

/* =========================================================
   TYPES
========================================================= */

type IndexFilter = 'ALL' | 'VNINDEX' | 'VN30'
type ChartType = 'bar' | 'pie'

type SignalRow = {
  index_code: string | null
  volatility_tag: string | null
  volume_behavior: string | null
  market_sentiment: string | null
  trend_strength: string | null
  signal_type: string | null
  date: string | null
}

type CategoryConfig = {
  field: keyof Pick<
    SignalRow,
    | 'volatility_tag'
    | 'volume_behavior'
    | 'market_sentiment'
    | 'trend_strength'
    | 'signal_type'
  >
  label: string
  icon: string
  color: string
  aliases: Record<string, string>
}

type ChartDatum = {
  name: string
  category: string
  label: string
  value: number
  percentage: number
  color: string
}

type CategorySummary = {
  label: string
  icon: string
  color: string
  total: number
  classified: number
  missing: number
  items: {
    name: string
    value: number
    percentage: number
    color: string
  }[]
}

/* =========================================================
   CATEGORY CONFIGURATION
========================================================= */

const OTHER_LABEL = 'Khác'
const MISSING_LABEL = 'Chưa phân loại'

const CATEGORY_CONFIG: CategoryConfig[] = [
  {
    field: 'volatility_tag',
    label: 'Biến động',
    icon: '🌪️',
    color: '#60a5fa',
    aliases: {
      tang: 'Tăng',
      giam: 'Giảm',
      'di ngang': 'Đi ngang',
      'biến động tăng': 'Tăng',
      'biến động giảm': 'Giảm',
    },
  },
  {
    field: 'volume_behavior',
    label: 'Khối lượng',
    icon: '💹',
    color: '#facc15',
    aliases: {
      'cao (kl)': 'Cao',
      'thấp (kl)': 'Thấp',
      'trung bình (kl)': 'Trung bình',
      cao: 'Cao',
      thấp: 'Thấp',
      'trung bình': 'Trung bình',
    },
  },
  {
    field: 'market_sentiment',
    label: 'Tâm lý',
    icon: '🧠',
    color: '#c084fc',
    aliases: {
      'tich cuc': 'Tích cực',
      'tiêu cực': 'Tiêu cực',
      'tieu cuc': 'Tiêu cực',
      'trung lập': 'Trung lập',
      'trung lap': 'Trung lập',
    },
  },
  {
    field: 'trend_strength',
    label: 'Sức mạnh xu hướng',
    icon: '📈',
    color: '#4ade80',
    aliases: {
      'trung bình (s)': 'Trung bình',
      manh: 'Mạnh',
      yeu: 'Yếu',
      'trung bình': 'Trung bình',
      'trung binh': 'Trung bình',
    },
  },
  {
    field: 'signal_type',
    label: 'Tín hiệu',
    icon: '📊',
    color: '#fb923c',
    aliases: {
      buy: 'Mua',
      mua: 'Mua',
      sell: 'Bán',
      ban: 'Bán',
      hold: 'Giữ',
      giu: 'Giữ',
    },
  },
]

/* =========================================================
   HELPERS
========================================================= */

/**
 * Chuẩn hóa chữ để so sánh các giá trị có dấu/không dấu.
 * Chỉ dùng để chuẩn hóa nhãn, không thay đổi dữ liệu trong DB.
 */
function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeCategoryValue(
  value: string | null,
  category: CategoryConfig,
): string {
  if (value === null || value === undefined || !value.trim()) {
    return MISSING_LABEL
  }

  const trimmed = value.trim()
  const key = normalizeKey(trimmed)

  const aliasEntry = Object.entries(category.aliases).find(
    ([alias]) => normalizeKey(alias) === key,
  )

  if (aliasEntry) {
    return aliasEntry[1]
  }

  // Chuẩn hóa cách viết hoa/thường nhưng giữ nội dung gốc.
  return trimmed.charAt(0).toLocaleUpperCase('vi-VN') + trimmed.slice(1)
}

function getCategoryColor(
  category: CategoryConfig,
  name: string,
): string {
  const key = normalizeKey(name)

  const colorMap: Record<string, string> = {
    'tang': '#60a5fa',
    'giam': '#2563eb',
    'di ngang': '#1e3a8a',

    'cao': '#facc15',
    'thap': '#fde047',
    'trung binh': '#ca8a04',

    'tich cuc': '#c084fc',
    'tieu cuc': '#9333ea',
    'trung lap': '#6b21a8',

    'manh': '#4ade80',
    'yeu': '#22c55e',

    'mua': '#fb923c',
    'ban': '#f97316',
    'giu': '#c2410c',

    [normalizeKey(OTHER_LABEL)]: '#64748b',
    [normalizeKey(MISSING_LABEL)]: '#94a3b8',
  }

  return colorMap[key] ?? category.color
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value)
}

function formatPercent(value: number): string {
  return `${value.toLocaleString('vi-VN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}%`
}

/**
 * Chuyển đổi ngày về mốc đầu ngày theo giờ Việt Nam.
 * Không tự giả định rằng cột date là timestamp hay timestamptz.
 */
function getStartDate(days: number): string {
  const date = new Date()

  date.setDate(date.getDate() - days)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

/* =========================================================
   CATEGORY SUMMARY
========================================================= */

function buildCategorySummaries(
  rows: SignalRow[],
): CategorySummary[] {
  return CATEGORY_CONFIG.map((category) => {
    const counts = new Map<string, number>()

    let missing = 0

    for (const row of rows) {
      const value = row[category.field]
      const normalized = normalizeCategoryValue(value, category)

      if (normalized === MISSING_LABEL) {
        missing += 1
      }

      counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
    }

    const total = rows.length
    const classified = total - missing

    const items = Array.from(counts.entries())
      .map(([name, value]) => ({
        name,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0,
        color: getCategoryColor(category, name),
      }))
      .sort((a, b) => b.value - a.value)

    return {
      label: category.label,
      icon: category.icon,
      color: category.color,
      total,
      classified,
      missing,
      items,
    }
  })
}

/* =========================================================
   KPI CARD
========================================================= */

function KpiCard({
  title,
  value,
  description,
  icon,
  accent,
}: {
  title: string
  value: string
  description: string
  icon: string
  accent: string
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.08] bg-slate-950/50 p-4 transition-colors hover:border-white/[0.15]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-400">{title}</p>

          <p className="mt-2 break-words text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            {value}
          </p>
        </div>

        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-xl"
          style={{
            color: accent,
            borderColor: `${accent}35`,
            backgroundColor: `${accent}12`,
          }}
          aria-hidden="true"
        >
          {icon}
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-5 text-slate-500">
        {description}
      </p>
    </div>
  )
}

/* =========================================================
   CUSTOM TOOLTIP
========================================================= */

function SignalTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{
    payload?: ChartDatum
    value?: number
  }>
}) {
  if (!active || !payload?.length) return null

  const item = payload[0]?.payload

  if (!item) return null

  return (
    <div className="rounded-xl border border-slate-600 bg-slate-950 p-3 shadow-xl">
      <div className="mb-2 flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: item.color }}
        />

        <p className="text-xs font-semibold text-white">{item.label}</p>
      </div>

      <p className="text-sm font-bold text-cyan-300">
        {formatNumber(item.value)} bản ghi
      </p>

      <p className="mt-1 text-xs text-slate-400">
        Tỷ lệ trên tổng bản ghi: {formatPercent(item.percentage)}
      </p>
    </div>
  )
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function SignalCategoryStats() {
  const [rawData, setRawData] = useState<SignalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [indexFilter, setIndexFilter] = useState<IndexFilter>('ALL')
  const [days, setDays] = useState(30)
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [activeGroup, setActiveGroup] = useState<string | null>(null)

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  /* =======================================================
     FETCH DATA WITH PAGINATION
  ======================================================= */

  const fetchData = useCallback(
    async (manualRefresh = false) => {
      if (manualRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setErrorMessage(null)

      try {
        const since = getStartDate(days)
        const pageSize = 1000

        let from = 0
        let allRows: SignalRow[] = []

        while (true) {
          let query = supabase
            .from('ai_market_signals')
            .select(
              'index_code,volatility_tag,volume_behavior,market_sentiment,trend_strength,signal_type,date',
            )
            .gte('date', since)
            .order('date', { ascending: false })
            .range(from, from + pageSize - 1)

          if (indexFilter !== 'ALL') {
            query = query.eq('index_code', indexFilter)
          }

          const { data, error } = await query

          if (error) {
            throw new Error(error.message)
          }

          const page = (data ?? []) as SignalRow[]

          allRows = allRows.concat(page)

          if (page.length < pageSize) {
            break
          }

          from += pageSize
        }

        setRawData(allRows)
        setLastUpdated(new Date())
      } catch (error) {
        console.error('[SignalCategoryStats] Fetch failed:', error)

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Không thể tải dữ liệu tín hiệu.',
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [days, indexFilter],
  )

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  /* =======================================================
     CALCULATE STATISTICS
  ======================================================= */

  const categorySummaries = useMemo(
    () => buildCategorySummaries(rawData),
    [rawData],
  )

  const classifiedCount = useMemo(
    () =>
      categorySummaries.reduce(
        (total, category) => total + category.classified,
        0,
      ),
    [categorySummaries],
  )

  const missingCount = useMemo(
    () =>
      categorySummaries.reduce(
        (total, category) => total + category.missing,
        0,
      ),
    [categorySummaries],
  )

  const totalCells = rawData.length * CATEGORY_CONFIG.length

  const dataCompleteness =
    totalCells > 0
      ? (classifiedCount / totalCells) * 100
      : 0

  const finalData = useMemo<ChartDatum[]>(() => {
    const categories = activeGroup
      ? categorySummaries.filter(
          (category) => category.label === activeGroup,
        )
      : categorySummaries

    return categories.flatMap((category) =>
      category.items.map((item) => ({
        name: item.name,
        category: category.label,
        label: `${category.label}: ${item.name}`,
        value: item.value,
        percentage: item.percentage,
        color: item.color,
      })),
    )
  }, [activeGroup, categorySummaries])

  const totalRecords = rawData.length

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-w-0 space-y-5">
      {/* HEADER */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-bold text-white sm:text-base">
            Phân tích phân loại tín hiệu
          </h3>

          <p className="mt-1 text-xs leading-5 text-slate-400">
            Thống kê dữ liệu thực tế từ ai_market_signals theo khoảng thời
            gian và chỉ số thị trường được chọn.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void fetchData(true)}
          disabled={loading || refreshing}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-2 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-400/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span aria-hidden="true">
            {refreshing ? '⏳' : '↻'}
          </span>

          {refreshing ? 'Đang cập nhật...' : 'Làm mới dữ liệu'}
        </button>
      </div>

      {/* FILTERS */}

      <div className="flex flex-col gap-3 rounded-xl border border-white/[0.07] bg-slate-950/40 p-3 sm:flex-row sm:flex-wrap sm:items-center">
        <label className="flex flex-col gap-1.5 text-xs text-slate-400">
          Chỉ số thị trường

          <select
            value={indexFilter}
            onChange={(event) =>
              setIndexFilter(event.target.value as IndexFilter)
            }
            className="min-h-10 min-w-[145px] rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-white outline-none focus:border-cyan-400/50"
          >
            <option value="ALL">Tất cả chỉ số</option>
            <option value="VNINDEX">VNINDEX</option>
            <option value="VN30">VN30</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs text-slate-400">
          Khoảng thời gian

          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="min-h-10 min-w-[125px] rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-white outline-none focus:border-cyan-400/50"
          >
            <option value={7}>7 ngày gần đây</option>
            <option value={30}>30 ngày gần đây</option>
            <option value={90}>90 ngày gần đây</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs text-slate-400">
          Loại biểu đồ

          <select
            value={chartType}
            onChange={(event) =>
              setChartType(event.target.value as ChartType)
            }
            className="min-h-10 min-w-[125px] rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-white outline-none focus:border-cyan-400/50"
          >
            <option value="bar">Biểu đồ cột</option>
            <option value="pie">Biểu đồ tròn</option>
          </select>
        </label>

        <div className="flex flex-col justify-end text-xs text-slate-500 sm:ml-auto">
          <span>
            Thời gian truy vấn: {days} ngày
          </span>

          {lastUpdated && (
            <span className="mt-1">
              Cập nhật lúc{' '}
              {lastUpdated.toLocaleTimeString('vi-VN')}
            </span>
          )}
        </div>
      </div>

      {/* ERROR */}

      {errorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-red-400/20 bg-red-400/[0.05] p-4"
        >
          <p className="text-sm font-semibold text-red-300">
            Không thể tải dữ liệu thống kê
          </p>

          <p className="mt-1 break-words text-xs leading-5 text-slate-400">
            {errorMessage}
          </p>

          <button
            type="button"
            onClick={() => void fetchData(true)}
            className="mt-3 rounded-lg border border-red-400/20 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-400/[0.08]"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* LOADING */}

      {loading && (
        <div
          role="status"
          className="rounded-xl border border-white/[0.07] bg-slate-950/30 p-10 text-center"
        >
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/20 border-t-cyan-400" />

          <p className="mt-4 text-sm font-medium text-slate-300">
            Đang tải dữ liệu tín hiệu...
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Vui lòng chờ trong giây lát.
          </p>
        </div>
      )}

      {/* STATISTICS */}

      {!loading && !errorMessage && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Tổng số bản ghi"
              value={formatNumber(totalRecords)}
              description="Số bản ghi truy vấn được trong khoảng thời gian đã chọn."
              icon="📚"
              accent="#38bdf8"
            />

            <KpiCard
              title="Số nhóm phân loại"
              value={formatNumber(CATEGORY_CONFIG.length)}
              description="Năm trường phân loại được thống kê từ dữ liệu hiện có."
              icon="🧩"
              accent="#c084fc"
            />

            <KpiCard
              title="Lượt phân loại có dữ liệu"
              value={formatNumber(classifiedCount)}
              description="Tổng số giá trị không rỗng trên năm trường phân loại."
              icon="✓"
              accent="#4ade80"
            />

            <KpiCard
              title="Độ đầy đủ dữ liệu"
              value={formatPercent(dataCompleteness)}
              description={`${formatNumber(missingCount)} ô dữ liệu thiếu trên ${formatNumber(totalCells)} ô phân loại.`}
              icon="🎯"
              accent="#facc15"
            />
          </div>

          {/* CATEGORY FILTER */}

          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-white">
                Lọc theo nhóm phân loại
              </h4>

              <p className="mt-1 text-xs text-slate-500">
                Chọn một nhóm để xem chi tiết hoặc chọn tất cả để so sánh.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveGroup(null)}
                aria-pressed={activeGroup === null}
                className={[
                  'rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
                  activeGroup === null
                    ? 'border-cyan-400/40 bg-cyan-400/[0.10] text-cyan-300'
                    : 'border-white/[0.08] bg-slate-950/40 text-slate-400 hover:text-white',
                ].join(' ')}
              >
                Tất cả nhóm
              </button>

              {CATEGORY_CONFIG.map((category) => {
                const active = activeGroup === category.label

                return (
                  <button
                    key={category.label}
                    type="button"
                    onClick={() =>
                      setActiveGroup(active ? null : category.label)
                    }
                    aria-pressed={active}
                    className={[
                      'rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
                      active
                        ? 'border-white/30 bg-white/[0.08] text-white'
                        : 'border-white/[0.07] bg-slate-950/30 text-slate-400 hover:border-white/20 hover:text-white',
                    ].join(' ')}
                  >
                    <span className="mr-1.5">{category.icon}</span>
                    {category.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* CHART */}

          {finalData.length === 0 ? (
            <div className="rounded-xl border border-white/[0.07] bg-slate-950/30 p-10 text-center">
              <p className="text-sm font-semibold text-slate-300">
                Chưa có dữ liệu phân loại
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Không tìm thấy bản ghi phù hợp với bộ lọc hiện tại.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.07] bg-slate-950/30 p-3 sm:p-5">
              <div className="mb-4">
                <h4 className="text-sm font-bold text-white">
                  {activeGroup
                    ? `Chi tiết: ${activeGroup}`
                    : 'Phân bố các nhóm tín hiệu'}
                </h4>

                <p className="mt-1 text-xs text-slate-500">
                  Số lượng bản ghi theo từng giá trị phân loại. Tỷ lệ được
                  tính trên tổng bản ghi trong bộ lọc hiện tại.
                </p>
              </div>

              <div className="h-[360px] min-w-0 sm:h-[440px]">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'bar' ? (
                    <BarChart
                      data={finalData}
                      layout="vertical"
                      margin={{
                        top: 8,
                        right: 24,
                        left: 8,
                        bottom: 8,
                      }}
                    >
                      <CartesianGrid
                        stroke="#334155"
                        strokeDasharray="3 3"
                        horizontal={false}
                      />

                      <XAxis
                        type="number"
                        allowDecimals={false}
                        stroke="#94a3b8"
                        tick={{ fontSize: 11 }}
                      />

                      <YAxis
                        type="category"
                        dataKey="label"
                        width={150}
                        stroke="#94a3b8"
                        tick={{ fontSize: 10 }}
                      />

                      <Tooltip content={<SignalTooltip />} />

                      <Bar
                        dataKey="value"
                        name="Số bản ghi"
                        radius={[0, 5, 5, 0]}
                        maxBarSize={24}
                      >
                        {finalData.map((entry, index) => (
                          <Cell
                            key={`${entry.category}-${entry.name}-${index}`}
                            fill={entry.color}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : (
                    <PieChart>
                      <Pie
                        data={finalData}
                        dataKey="value"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        outerRadius="68%"
                        innerRadius="40%"
                        paddingAngle={2}
                      >
                        {finalData.map((entry, index) => (
                          <Cell
                            key={`${entry.category}-${entry.name}-${index}`}
                            fill={entry.color}
                            stroke="#0f172a"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>

                      <Tooltip content={<SignalTooltip />} />
                    </PieChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* LEGEND */}

              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-white/[0.06] pt-4">
                {Array.from(
                  new Map(
                    finalData.map((item) => [
                      `${item.category}:${item.name}`,
                      item,
                    ]),
                  ).values(),
                ).map((item) => (
                  <div
                    key={`${item.category}:${item.name}`}
                    className="flex min-w-0 items-center gap-2 text-xs"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />

                    <span className="text-slate-400">
                      {item.label}
                    </span>

                    <span className="font-semibold text-white">
                      {formatNumber(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CATEGORY DETAILS */}

          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-bold text-white">
                Báo cáo chi tiết theo nhóm
              </h4>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Mỗi nhóm có tổng số bản ghi riêng. Không cộng các nhóm với
                nhau để suy ra tổng số tín hiệu duy nhất.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {categorySummaries
                .filter(
                  (category) =>
                    !activeGroup || category.label === activeGroup,
                )
                .map((category) => (
                  <div
                    key={category.label}
                    className="min-w-0 rounded-xl border border-white/[0.07] bg-slate-950/35 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="text-lg">{category.icon}</span>

                        <h5 className="text-sm font-bold text-white">
                          {category.label}
                        </h5>
                      </div>

                      <span
                        className="rounded-lg px-2.5 py-1 text-xs font-bold"
                        style={{
                          color: category.color,
                          backgroundColor: `${category.color}12`,
                        }}
                      >
                        {formatNumber(category.total)}
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      {category.items.map((item) => (
                        <div
                          key={`${category.label}-${item.name}`}
                          className="space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="min-w-0 break-words text-slate-300">
                              {item.name}
                            </span>

                            <span className="shrink-0 text-slate-400">
                              {formatNumber(item.value)}
                              {' · '}
                              {formatPercent(item.percentage)}
                            </span>
                          </div>

                          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(item.percentage, 100)}%`,
                                backgroundColor: item.color,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-[11px]">
                      <span className="text-slate-500">
                        Có dữ liệu: {formatNumber(category.classified)}
                      </span>

                      <span className="text-slate-500">
                        Thiếu: {formatNumber(category.missing)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

