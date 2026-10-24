'use client'

import {
useCallback,
useEffect,
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
RefreshCw,
AlertCircle,
CheckCircle2,
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

type PortfolioStats = {
totalAssets: number
totalPositions: number
totalBuyValue: number
totalCurrentValue: number
totalUnrealizedPnL: number
totalRealizedPnL: number
totalFees: number
winningPositions: number
losingPositions: number
profitableRate: number
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

const EMPTY_STATS: PortfolioStats = {
totalAssets: 0,
totalPositions: 0,
totalBuyValue: 0,
totalCurrentValue: 0,
totalUnrealizedPnL: 0,
totalRealizedPnL: 0,
totalFees: 0,
winningPositions: 0,
losingPositions: 0,
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
return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function isRecord(value: unknown): value is Record<string, unknown> {
return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeTransaction(value: unknown): PortfolioTransaction {
if (!isRecord(value)) {
throw new Error('Một bản ghi giao dịch không phải đối tượng hợp lệ.')
}

if (
!('id' in value) ||
!('user_id' in value) ||
!('assetname' in value) ||
!('quantity' in value) ||
!('buyprice' in value)
) {
throw new Error(
'Bản ghi giao dịch thiếu trường bắt buộc. Hãy kiểm tra cấu trúc bảng portfolio_transactions.',
)
}

const row = value as unknown as PortfolioRow

return {
id: String(row.id),
user_id: String(row.user_id),
assetname: String(row.assetname ?? ''),
category: row.category == null ? null : String(row.category),
quantity: toNumber(row.quantity),
buyprice: toNumber(row.buyprice),
currentprice:
row.currentprice == null ? null : toNumber(row.currentprice),
transactionfee:
row.transactionfee == null ? null : toNumber(row.transactionfee),
sellprice: row.sellprice == null ? null : toNumber(row.sellprice),
sellfee: row.sellfee == null ? null : toNumber(row.sellfee),
issold: row.issold === true,
buydate: row.buydate == null ? null : String(row.buydate),
}
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
(sum, item) => {
const currentPrice = item.currentprice ?? item.buyprice


  return (
    sum +
    (currentPrice - item.buyprice) * item.quantity -
    (item.transactionfee ?? 0)
  )
},
0,


)

const totalRealizedPnL = soldPositions.reduce(
(sum, item) => {
const sellPrice = item.sellprice ?? 0


  return (
    sum +
    (sellPrice - item.buyprice) * item.quantity -
    (item.transactionfee ?? 0) -
    (item.sellfee ?? 0)
  )
},
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
(item) =>
(item.currentprice ?? item.buyprice) > item.buyprice,
).length

const losingPositions = activePositions.filter(
(item) =>
(item.currentprice ?? item.buyprice) < item.buyprice,
).length

const totalPositions = activePositions.length

const profitableRate =
totalPositions > 0
? (winningPositions / totalPositions) * 100
: 0

const uniqueAssets = new Set(
activePositions.map(
(item) => item.assetname.trim().toUpperCase(),
).filter(Boolean),
)

return {
totalAssets: uniqueAssets.size,
totalPositions,
totalBuyValue,
totalCurrentValue,
totalUnrealizedPnL,
totalRealizedPnL,
totalFees,
winningPositions,
losingPositions,
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

return ( <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-900"> <div className="flex items-start justify-between gap-3"> <div className="min-w-0"> <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
{title} </p>


      <p className={`mt-2 break-words text-xl font-bold ${valueColor}`}>
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
const [transactions, setTransactions] = useState<PortfolioTransaction[]>([])
const [stats, setStats] = useState<PortfolioStats>(EMPTY_STATS)
const [loading, setLoading] = useState(true)
const [refreshing, setRefreshing] = useState(false)
const [error, setError] = useState('')

const loadReport = useCallback(async (isRefresh = false) => {
if (isRefresh) {
setRefreshing(true)
} else {
setLoading(true)
}


setError('')

try {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY trong file .env.local.',
    )
  }

  /*
   * Khởi tạo client không gắn Database generic.
   * Điều này tránh kiểu GenericStringError xuất phát
   * từ một khai báo Database không khớp schema thực tế.
   */
  const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    throw authError
  }

  if (!user) {
    setTransactions([])
    setStats(EMPTY_STATS)
    setError('Vui lòng đăng nhập để xem báo cáo danh mục.')
    return
  }

  /*
   * Đặt tên bảng và danh sách cột riêng biệt để dễ kiểm tra.
   */
  const tableName = 'portfolio_transactions'

  const columns =
    'id,user_id,assetname,category,quantity,buyprice,currentprice,transactionfee,sellprice,sellfee,issold,buydate'

  const { data, error: queryError } = await supabase
    .from(tableName)
    .select(columns)
    .eq('user_id', user.id)
    .order('buydate', { ascending: false })

  if (queryError) {
    throw queryError
  }

  /*
   * Chuẩn hóa từng bản ghi từ dữ liệu chưa xác thực.
   * Không ép trực tiếp data thành PortfolioTransaction[].
   */
  const rows: PortfolioTransaction[] = (data ?? []).map(
    (item: unknown) => normalizeTransaction(item),
  )

  setTransactions(rows)
  setStats(calculateStats(rows))
} catch (err: unknown) {
  console.error('DashboardReport error:', err)

  setTransactions([])
  setStats(EMPTY_STATS)

  setError(
    err instanceof Error
      ? err.message
      : 'Không thể tải báo cáo danh mục đầu tư.',
  )
} finally {
  setLoading(false)
  setRefreshing(false)
}


}, [])

useEffect(() => {
void loadReport()
}, [loadReport])

const totalPnL = stats.totalUnrealizedPnL + stats.totalRealizedPnL

const returnRate =
stats.totalBuyValue > 0
? (stats.totalUnrealizedPnL / stats.totalBuyValue) * 100
: 0

if (loading) {
return ( <section className="rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-700 dark:bg-gray-900"> <div className="flex items-center justify-center gap-3 py-10"> <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />


      <span className="text-sm text-gray-500 dark:text-gray-400">
        Đang tải báo cáo danh mục...
      </span>
    </div>
  </section>
)


}

return ( <section className="space-y-6"> <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"> <div> <h2 className="text-xl font-bold text-gray-900 dark:text-white">
Báo cáo danh mục đầu tư </h2>


      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Tổng hợp giao dịch và hiệu quả đầu tư từ Supabase.
      </p>
    </div>

    <button
      type="button"
      onClick={() => void loadReport(true)}
      disabled={refreshing}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
    >
      <RefreshCw
        className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
      />

      Làm mới báo cáo
    </button>
  </div>

  {error && (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

      <div>
        <p className="font-semibold">Không thể tải báo cáo</p>
        <p className="mt-1 break-words">{error}</p>

        <button
          type="button"
          onClick={() => void loadReport(true)}
          className="mt-2 font-semibold underline"
        >
          Thử lại
        </button>
      </div>
    </div>
  )}

  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <StatCard
      title="Giá trị vốn đang nắm giữ"
      value={`${formatMoney(stats.totalBuyValue)} đ`}
      subtitle={`${stats.totalPositions} vị thế đang mở`}
      icon={<Wallet className="h-5 w-5" />}
    />

    <StatCard
      title="Giá trị thị trường"
      value={`${formatMoney(stats.totalCurrentValue)} đ`}
      subtitle="Theo giá hiện tại được lưu"
      icon={<CircleDollarSign className="h-5 w-5" />}
    />

    <StatCard
      title="Lãi/lỗ chưa thực hiện"
      value={`${stats.totalUnrealizedPnL > 0 ? '+' : ''}${formatMoney(stats.totalUnrealizedPnL)} đ`}
      subtitle={`Tỷ suất: ${formatPercent(returnRate)}`}
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
      subtitle="Từ các vị thế đã bán"
      icon={<Activity className="h-5 w-5" />}
      positive={stats.totalRealizedPnL > 0}
      negative={stats.totalRealizedPnL < 0}
    />
  </div>

  <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:col-span-2">
      <div className="flex items-center gap-2">
        <PieChart className="h-5 w-5 text-blue-600 dark:text-blue-400" />

        <h3 className="font-bold text-gray-900 dark:text-white">
          Hiệu quả danh mục
        </h3>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Tổng lãi/lỗ đã ghi nhận
          </p>

          <p
            className={`mt-2 text-2xl font-bold ${
              totalPnL > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : totalPnL < 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-900 dark:text-white'
            }`}
          >
            {totalPnL > 0 ? '+' : ''}
            {formatMoney(totalPnL)} đ
          </p>

          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Lãi/lỗ mở + lãi/lỗ đã bán
          </p>
        </div>

        <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Tổng phí giao dịch
          </p>

          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {formatMoney(stats.totalFees)} đ
          </p>

          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Phí mua và phí bán đã lưu
          </p>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Tỷ lệ vị thế đang lãi
          </span>

          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {stats.profitableRate.toFixed(1)}%
          </span>
        </div>

        <div className="h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{
              width: `${Math.min(100, Math.max(0, stats.profitableRate))}%`,
            }}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="h-4 w-4" />
            Đang lãi: {stats.winningPositions}
          </span>

          <span className="inline-flex items-center gap-2 text-red-600 dark:text-red-400">
            <TrendingDown className="h-4 w-4" />
            Đang lỗ: {stats.losingPositions}
          </span>

          <span className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <Activity className="h-4 w-4" />
            Tổng vị thế: {stats.totalPositions}
          </span>
        </div>
      </div>
    </div>

    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />

        <h3 className="font-bold text-gray-900 dark:text-white">
          Tóm tắt danh mục
        </h3>
      </div>

      <div className="mt-5 space-y-4">
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
            Số vị thế đang mở
          </span>

          <span className="font-bold text-gray-900 dark:text-white">
            {stats.totalPositions}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Vị thế đang lãi
          </span>

          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            {stats.winningPositions}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Vị thế đang lỗ
          </span>

          <span className="font-bold text-red-600 dark:text-red-400">
            {stats.losingPositions}
          </span>
        </div>

        <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Trạng thái danh mục
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
                  Đang có lãi
                </span>
              </>
            ) : (
              <>
                <TrendingDown className="h-5 w-5 text-red-600" />

                <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                  Đang có lỗ
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>

  {!error && transactions.length === 0 && (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-900">
      <Wallet className="mx-auto h-10 w-10 text-gray-400" />

      <h3 className="mt-3 font-semibold text-gray-900 dark:text-white">
        Chưa có dữ liệu giao dịch
      </h3>

      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Khi bạn thêm giao dịch vào danh mục, báo cáo sẽ tự động tổng hợp
        từ bảng portfolio_transactions.
      </p>
    </div>
  )}
</section>


)
}
