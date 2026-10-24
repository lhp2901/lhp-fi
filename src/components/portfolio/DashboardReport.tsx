
'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { createBrowserClient } from '@supabase/ssr'

import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PieChart,
  CircleDollarSign,
  Activity,
  AlertCircle,
  CheckCircle2,
  Search,
  Filter,
  BriefcaseBusiness,
  Receipt,
  BarChart3,
} from 'lucide-react'

type PortfolioTransaction = {
  id: string
  user_id: string
  assetname: string
  category: string | null
  quantity: number
  buyprice: number
  currentprice: number | null
  transactionfee: number | null
  sellprice: number | null
  sellfee: number | null
  issold: boolean
  buydate: string | null
}

type PortfolioRow = {
  id: string | number
  user_id: string
  assetname: string | null
  category: string | null
  quantity: number | string | null
  buyprice: number | string | null
  currentprice: number | string | null
  transactionfee: number | string | null
  sellprice: number | string | null
  sellfee: number | string | null
  issold: boolean | null
  buydate: string | null
}

type PortfolioStats = {
  totalAssets: number
  totalPositions: number
  totalSoldPositions: number
  totalBuyValue: number
  totalCurrentValue: number
  totalUnrealizedPnL: number
  totalRealizedPnL: number
  totalFees: number
  winningPositions: number
  losingPositions: number
  breakEvenPositions: number
  profitableRate: number
}

type FilterStatus = 'ALL' | 'OPEN' | 'SOLD'

const EMPTY_STATS: PortfolioStats = {
  totalAssets: 0,
  totalPositions: 0,
  totalSoldPositions: 0,
  totalBuyValue: 0,
  totalCurrentValue: 0,
  totalUnrealizedPnL: 0,
  totalRealizedPnL: 0,
  totalFees: 0,
  winningPositions: 0,
  losingPositions: 0,
  breakEvenPositions: 0,
  profitableRate: 0,
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') {
    return 0
  }

  const result = Number(value)

  return Number.isFinite(result) ? result : 0
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatDate(value: string | null): string {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('vi-VN').format(date)
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function normalizeTransaction(
  value: unknown,
): PortfolioTransaction {
  if (!isRecord(value)) {
    throw new Error('Bản ghi giao dịch không hợp lệ.')
  }

  if (
    !('id' in value) ||
    !('user_id' in value) ||
    !('assetname' in value) ||
    !('quantity' in value) ||
    !('buyprice' in value)
  ) {
    throw new Error(
      'Dữ liệu giao dịch thiếu cột bắt buộc. Hãy kiểm tra bảng portfolio_transactions.',
    )
  }

  const row = value as unknown as PortfolioRow

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    assetname: String(row.assetname ?? ''),
    category:
      row.category == null ? null : String(row.category),
    quantity: toNumber(row.quantity),
    buyprice: toNumber(row.buyprice),
    currentprice:
      row.currentprice == null
        ? null
        : toNumber(row.currentprice),
    transactionfee:
      row.transactionfee == null
        ? null
        : toNumber(row.transactionfee),
    sellprice:
      row.sellprice == null
        ? null
        : toNumber(row.sellprice),
    sellfee:
      row.sellfee == null ? null : toNumber(row.sellfee),
    issold: row.issold === true,
    buydate:
      row.buydate == null ? null : String(row.buydate),
  }
}

function getUnrealizedPnL(
  item: PortfolioTransaction,
): number {
  if (item.issold) return 0

  const currentPrice = item.currentprice ?? item.buyprice

  return (
    (currentPrice - item.buyprice) * item.quantity -
    (item.transactionfee ?? 0)
  )
}

function getRealizedPnL(
  item: PortfolioTransaction,
): number {
  if (!item.issold) return 0

  return (
    ((item.sellprice ?? 0) - item.buyprice) * item.quantity -
    (item.transactionfee ?? 0) -
    (item.sellfee ?? 0)
  )
}

function calculateStats(
  transactions: PortfolioTransaction[],
): PortfolioStats {
  const activePositions = transactions.filter(
    (item) => !item.issold,
  )

  const soldPositions = transactions.filter(
    (item) => item.issold,
  )

  const totalBuyValue = activePositions.reduce(
    (sum, item) => sum + item.quantity * item.buyprice,
    0,
  )

  const totalCurrentValue = activePositions.reduce(
    (sum, item) =>
      sum +
      item.quantity *
        (item.currentprice ?? item.buyprice),
    0,
  )

  const totalUnrealizedPnL = activePositions.reduce(
    (sum, item) => sum + getUnrealizedPnL(item),
    0,
  )

  const totalRealizedPnL = soldPositions.reduce(
    (sum, item) => sum + getRealizedPnL(item),
    0,
  )

  const totalFees = transactions.reduce(
    (sum, item) =>
      sum +
      (item.transactionfee ?? 0) +
      (item.sellfee ?? 0),
    0,
  )

  const winningPositions = activePositions.filter(
    (item) => getUnrealizedPnL(item) > 0,
  ).length

  const losingPositions = activePositions.filter(
    (item) => getUnrealizedPnL(item) < 0,
  ).length

  const breakEvenPositions =
    activePositions.length -
    winningPositions -
    losingPositions

  const totalPositions = activePositions.length

  const profitableRate =
    totalPositions > 0
      ? (winningPositions / totalPositions) * 100
      : 0

  const uniqueAssets = new Set(
    activePositions
      .map((item) => item.assetname.trim().toUpperCase())
      .filter(Boolean),
  )

  return {
    totalAssets: uniqueAssets.size,
    totalPositions,
    totalSoldPositions: soldPositions.length,
    totalBuyValue,
    totalCurrentValue,
    totalUnrealizedPnL,
    totalRealizedPnL,
    totalFees,
    winningPositions,
    losingPositions,
    breakEvenPositions,
    profitableRate,
  }
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  positive,
  negative,
}: {
  title: string
  value: string
  subtitle?: string
  icon: ReactNode
  positive?: boolean
  negative?: boolean
}) {
  const valueColor = positive
    ? 'text-emerald-600 dark:text-emerald-400'
    : negative
      ? 'text-red-600 dark:text-red-400'
      : 'text-gray-900 dark:text-white'

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {title}
          </p>

          <p
            className={`mt-2 break-words text-xl font-bold ${valueColor}`}
          >
            {value}
          </p>

          {subtitle && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
          {icon}
        </div>
      </div>
    </div>
  )
}

export default function DashboardReport() {
  const [transactions, setTransactions] = useState<
    PortfolioTransaction[]
  >([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] =
    useState<FilterStatus>('ALL')

  const loadReport = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const supabaseUrl =
        process.env.NEXT_PUBLIC_SUPABASE_URL

      const supabaseAnonKey =
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
          'Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY trong .env.local.',
        )
      }

      const supabase = createBrowserClient(
        supabaseUrl,
        supabaseAnonKey,
      )

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) throw authError

      if (!user) {
        setTransactions([])
        setError('Vui lòng đăng nhập để xem dữ liệu giao dịch.')
        return
      }

      const columns =
        'id,user_id,assetname,category,quantity,buyprice,currentprice,transactionfee,sellprice,sellfee,issold,buydate'

      const { data, error: queryError } = await supabase
        .from('portfolio_transactions')
        .select(columns)
        .eq('user_id', user.id)
        .order('buydate', { ascending: false })

      if (queryError) throw queryError

      const rows: PortfolioTransaction[] = (
        (data ?? []) as unknown[]
      ).map(normalizeTransaction)

      setTransactions(rows)
    } catch (err: unknown) {
      console.error('DashboardReport error:', err)

      setTransactions([])

      setError(
        err instanceof Error
          ? err.message
          : 'Không thể tải dữ liệu báo cáo từ Supabase.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadReport()
  }, [loadReport])

  const stats = useMemo(
    () => calculateStats(transactions),
    [transactions],
  )

  const totalPnL =
    stats.totalUnrealizedPnL + stats.totalRealizedPnL

  const returnRate =
    stats.totalBuyValue > 0
      ? (stats.totalUnrealizedPnL /
          stats.totalBuyValue) *
        100
      : 0

  const filteredTransactions = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()

    return transactions.filter((item) => {
      const matchesSearch =
        !keyword ||
        item.assetname.toLowerCase().includes(keyword) ||
        (item.category ?? '').toLowerCase().includes(keyword)

      const matchesStatus =
        filterStatus === 'ALL' ||
        (filterStatus === 'OPEN' && !item.issold) ||
        (filterStatus === 'SOLD' && item.issold)

      return matchesSearch && matchesStatus
    })
  }, [transactions, searchTerm, filterStatus])

  if (loading) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-center gap-3 py-10">
          <Activity className="h-5 w-5 animate-pulse text-blue-600" />

          <span className="text-sm text-gray-500 dark:text-gray-400">
            Đang tải dữ liệu báo cáo...
          </span>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              Không thể tải báo cáo
            </p>

            <p className="mt-1 break-words">{error}</p>

            <button
              type="button"
              onClick={() => void loadReport()}
              className="mt-3 rounded-lg bg-red-100 px-3 py-2 font-semibold hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/70"
            >
              Thử tải lại
            </button>
          </div>
        </div>
      )}

      {/* Các chỉ số tổng quan */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Tổng vốn mua đang nắm giữ"
          value={`${formatMoney(stats.totalBuyValue)} đ`}
          subtitle={`${stats.totalPositions} vị thế đang mở`}
          icon={<Wallet className="h-5 w-5" />}
        />

        <StatCard
          title="Giá trị thị trường"
          value={`${formatMoney(stats.totalCurrentValue)} đ`}
          subtitle="Tính theo giá hiện tại đã lưu"
          icon={<CircleDollarSign className="h-5 w-5" />}
        />

        <StatCard
          title="Lãi/lỗ chưa thực hiện"
          value={`${stats.totalUnrealizedPnL > 0 ? '+' : ''}${formatMoney(stats.totalUnrealizedPnL)} đ`}
          subtitle={`Tỷ suất trên vốn mua: ${formatPercent(returnRate)}`}
          icon={
            stats.totalUnrealizedPnL >= 0 ? (
              <TrendingUp className="h-5 w-5" />
            ) : (
              <TrendingDown className="h-5 w-5" />
            )
          }
          positive={stats.totalUnrealizedPnL > 0}
          negative={stats.totalUnrealizedPnL < 0}
        />

        <StatCard
          title="Lãi/lỗ đã thực hiện"
          value={`${stats.totalRealizedPnL > 0 ? '+' : ''}${formatMoney(stats.totalRealizedPnL)} đ`}
          subtitle={`${stats.totalSoldPositions} vị thế đã bán`}
          icon={<BarChart3 className="h-5 w-5" />}
          positive={stats.totalRealizedPnL > 0}
          negative={stats.totalRealizedPnL < 0}
        />

        <StatCard
          title="Tổng lãi/lỗ"
          value={`${totalPnL > 0 ? '+' : ''}${formatMoney(totalPnL)} đ`}
          subtitle="Lãi/lỗ mở cộng lãi/lỗ đã bán"
          icon={<Activity className="h-5 w-5" />}
          positive={totalPnL > 0}
          negative={totalPnL < 0}
        />

        <StatCard
          title="Tổng phí giao dịch"
          value={`${formatMoney(stats.totalFees)} đ`}
          subtitle="Phí mua và phí bán đã lưu"
          icon={<Receipt className="h-5 w-5" />}
        />

        <StatCard
          title="Số mã đang nắm giữ"
          value={String(stats.totalAssets)}
          subtitle="Số mã tài sản khác nhau"
          icon={<BriefcaseBusiness className="h-5 w-5" />}
        />

        <StatCard
          title="Tỷ lệ vị thế đang lãi"
          value={`${stats.profitableRate.toFixed(1)}%`}
          subtitle={`${stats.winningPositions} vị thế đang có lãi`}
          icon={<PieChart className="h-5 w-5" />}
          positive={stats.profitableRate >= 50}
          negative={
            stats.totalPositions > 0 &&
            stats.profitableRate < 50
          }
        />
      </div>

      {/* Phân tích hiệu quả danh mục */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:col-span-2">
          <div className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-blue-600 dark:text-blue-400" />

            <h3 className="font-bold text-gray-900 dark:text-white">
              Phân tích hiệu quả danh mục
            </h3>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Tỷ lệ vị thế đang có lãi
              </span>

              <span className="font-bold text-gray-900 dark:text-white">
                {stats.profitableRate.toFixed(1)}%
              </span>
            </div>

            <div className="flex h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              {stats.totalPositions > 0 && (
                <>
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{
                      width: `${(stats.winningPositions / stats.totalPositions) * 100}%`,
                    }}
                  />

                  <div
                    className="h-full bg-gray-400 transition-all"
                    style={{
                      width: `${(stats.breakEvenPositions / stats.totalPositions) * 100}%`,
                    }}
                  />

                  <div
                    className="h-full bg-red-500 transition-all"
                    style={{
                      width: `${(stats.losingPositions / stats.totalPositions) * 100}%`,
                    }}
                  />
                </>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  Đang lãi
                </p>

                <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  {stats.winningPositions}
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Hòa vốn
                </p>

                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.breakEvenPositions}
                </p>
              </div>

              <div className="rounded-xl bg-red-50 p-4 dark:bg-red-950/30">
                <p className="text-sm text-red-700 dark:text-red-300">
                  Đang lỗ
                </p>

                <p className="mt-1 text-2xl font-bold text-red-700 dark:text-red-300">
                  {stats.losingPositions}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Tổng vốn mua đang mở
              </p>

              <p className="mt-2 break-words text-lg font-bold text-gray-900 dark:text-white">
                {formatMoney(stats.totalBuyValue)} đ
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Tổng giá trị thị trường
              </p>

              <p className="mt-2 break-words text-lg font-bold text-gray-900 dark:text-white">
                {formatMoney(stats.totalCurrentValue)} đ
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />

            <h3 className="font-bold text-gray-900 dark:text-white">
              Tổng kết giao dịch
            </h3>
          </div>

          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Vị thế đang mở
              </span>

              <span className="font-bold text-gray-900 dark:text-white">
                {stats.totalPositions}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Vị thế đã bán
              </span>

              <span className="font-bold text-gray-900 dark:text-white">
                {stats.totalSoldPositions}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Số mã đang nắm giữ
              </span>

              <span className="font-bold text-gray-900 dark:text-white">
                {stats.totalAssets}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Tổng phí giao dịch
              </span>

              <span className="font-semibold text-gray-900 dark:text-white">
                {formatMoney(stats.totalFees)} đ
              </span>
            </div>

            <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Trạng thái vị thế đang mở
              </p>

              <div className="mt-2 flex items-center gap-2">
                {stats.totalPositions === 0 ? (
                  <>
                    <AlertCircle className="h-5 w-5 text-gray-400" />

                    <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                      Chưa có vị thế mở
                    </span>
                  </>
                ) : stats.totalUnrealizedPnL >= 0 ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />

                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      Lãi/lỗ mở đang dương
                    </span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-5 w-5 text-red-600" />

                    <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                      Lãi/lỗ mở đang âm
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bảng chi tiết giao dịch */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-200 p-5 dark:border-gray-700">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Chi tiết giao dịch
              </h3>

              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Dữ liệu giao dịch lấy từ portfolio_transactions.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(event.target.value)
                  }
                  placeholder="Tìm mã cổ phiếu..."
                  className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-blue-950 sm:w-56"
                />
              </div>

              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                <select
                  value={filterStatus}
                  onChange={(event) =>
                    setFilterStatus(
                      event.target.value as FilterStatus,
                    )
                  }
                  className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-8 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white sm:w-44"
                >
                  <option value="ALL">Tất cả giao dịch</option>
                  <option value="OPEN">Đang nắm giữ</option>
                  <option value="SOLD">Đã bán</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="p-10 text-center">
            <Wallet className="mx-auto h-10 w-10 text-gray-400" />

            <h4 className="mt-3 font-semibold text-gray-900 dark:text-white">
              {transactions.length === 0
                ? 'Chưa có dữ liệu giao dịch'
                : 'Không tìm thấy giao dịch phù hợp'}
            </h4>

            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {transactions.length === 0
                ? 'Hãy kiểm tra dữ liệu trong bảng portfolio_transactions trên Supabase.'
                : 'Thử đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái.'}
            </p>
          </div>
        ) : (
          <>
            <div className="border-b border-gray-200 px-5 py-3 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Hiển thị{' '}
              <span className="font-semibold text-gray-900 dark:text-white">
                {filteredTransactions.length}
              </span>{' '}
              / {transactions.length} giao dịch
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800/70 dark:text-gray-400">
                  <tr>
                    <th className="px-5 py-4">Mã tài sản</th>
                    <th className="px-5 py-4">Ngày mua</th>
                    <th className="px-5 py-4 text-right">
                      Số lượng
                    </th>
                    <th className="px-5 py-4 text-right">
                      Giá mua
                    </th>
                    <th className="px-5 py-4 text-right">
                      Giá hiện tại / bán
                    </th>
                    <th className="px-5 py-4 text-right">
                      Giá trị vốn
                    </th>
                    <th className="px-5 py-4 text-right">
                      Lãi/lỗ
                    </th>
                    <th className="px-5 py-4">Trạng thái</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredTransactions.map((item) => {
                    const pnl = item.issold
                      ? getRealizedPnL(item)
                      : getUnrealizedPnL(item)

                    const investedValue =
                      item.quantity * item.buyprice

                    const displayedPrice = item.issold
                      ? item.sellprice
                      : item.currentprice ?? item.buyprice

                    const pnlColor =
                      pnl > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : pnl < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-700 dark:text-gray-300'

                    return (
                      <tr
                        key={item.id}
                        className="transition hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <td className="px-5 py-4">
                          <div className="font-bold text-gray-900 dark:text-white">
                            {item.assetname || 'Chưa đặt tên'}
                          </div>

                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {item.category || 'Chưa phân loại'}
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-gray-600 dark:text-gray-300">
                          {formatDate(item.buydate)}
                        </td>

                        <td className="px-5 py-4 text-right font-medium text-gray-900 dark:text-white">
                          {new Intl.NumberFormat('vi-VN', {
                            maximumFractionDigits: 4,
                          }).format(item.quantity)}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right text-gray-600 dark:text-gray-300">
                          {formatMoney(item.buyprice)} đ
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right text-gray-600 dark:text-gray-300">
                          {displayedPrice == null
                            ? '—'
                            : `${formatMoney(displayedPrice)} đ`}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right font-medium text-gray-900 dark:text-white">
                          {formatMoney(investedValue)} đ
                        </td>

                        <td
                          className={`whitespace-nowrap px-5 py-4 text-right font-bold ${pnlColor}`}
                        >
                          {pnl > 0 ? '+' : ''}
                          {formatMoney(pnl)} đ
                        </td>

                        <td className="px-5 py-4">
                          {item.issold ? (
                            <span className="inline-flex whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                              Đã bán
                            </span>
                          ) : pnl > 0 ? (
                            <span className="inline-flex whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                              Đang lãi
                            </span>
                          ) : pnl < 0 ? (
                            <span className="inline-flex whitespace-nowrap rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                              Đang lỗ
                            </span>
                          ) : (
                            <span className="inline-flex whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                              Hòa vốn
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

