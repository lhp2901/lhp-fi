'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  calculatePnL,
  formatNumber,
} from '@/lib/utils'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import EditTransactionForm from './EditTransactionForm'

// =====================================================
// SUPABASE
// =====================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

const COLORS = ['#FFBB28', '#00C49F', '#8884d8', '#FF8042', '#0088FE']

type Transaction = {
  id: string | number
  assetname: string
  category: string
  buyprice: number | string | null
  currentprice: number | string | null
  sellprice: number | string | null
  quantity: number | string | null
  transactionfee?: number | string | null
  sellfee?: number | string | null
  issold: boolean
  created_at?: string
  [key: string]: unknown
}

type CategoryItem = {
  name: string
  value: number
}

type ChartTransaction = Transaction & {
  pnl: number
}

// =====================================================
// HÀM HỖ TRỢ
// =====================================================

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') {
    return 0
  }

  const numberValue = Number(value)

  return Number.isFinite(numberValue) ? numberValue : 0
}

function getTransactionPrice(tx: Transaction): number {
  return toNumber(tx.issold ? tx.sellprice : tx.currentprice)
}

function getTransactionPnL(tx: Transaction): number {
  return toNumber(
    calculatePnL(
      toNumber(tx.buyprice),
      getTransactionPrice(tx),
      toNumber(tx.quantity)
    )
  )
}

function getLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getStartDate(filterType: string, today: Date): Date | null {
  const from = new Date(today)

  switch (filterType) {
    case 'Ngày':
      from.setDate(from.getDate() - 1)
      return from

    case 'Tuần':
      from.setDate(from.getDate() - 7)
      return from

    case 'Tháng':
      from.setMonth(from.getMonth() - 1)
      return from

    default:
      return null
  }
}

// =====================================================
// COMPONENT
// =====================================================

export default function DashboardReport() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  const [filterType, setFilterType] = useState('Tháng')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [hasLoaded, setHasLoaded] = useState(false)

  // ===================================================
  // TẢI DỮ LIỆU
  // ===================================================

  const fetchData = useCallback(
    async (from?: string, to?: string) => {
      if (!supabase) {
        setErrorMessage(
          'Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY.'
        )
        setTransactions([])
        setHasLoaded(true)
        return
      }

      if (from && to && from > to) {
        setErrorMessage('Ngày bắt đầu không được lớn hơn ngày kết thúc.')
        return
      }

      setLoading(true)
      setErrorMessage('')

      try {
        let query = supabase
          .from('portfolio_transactions')
          .select('*')
          .order('created_at', { ascending: false })

        // Lọc từ đầu ngày bắt đầu.
        if (from) {
          query = query.gte(
            'created_at',
            `${from}T00:00:00.000Z`
          )
        }

        // Lấy đến hết ngày kết thúc:
        // nhỏ hơn thời điểm đầu ngày kế tiếp.
        if (to) {
          const [year, month, day] = to.split('-').map(Number)

          const nextDay = new Date(
            Date.UTC(year, month - 1, day + 1)
          )

          query = query.lt(
            'created_at',
            nextDay.toISOString()
          )
        }

        const { data, error } = await query

        if (error) {
          console.error('Lỗi Supabase khi tải báo cáo:', error)

          setErrorMessage(
            `Không thể tải dữ liệu: ${error.message}`
          )

          setTransactions([])
          return
        }

        setTransactions((data ?? []) as Transaction[])
      } catch (error) {
        console.error('Lỗi tải báo cáo:', error)

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Đã xảy ra lỗi không xác định khi tải báo cáo.'
        )

        setTransactions([])
      } finally {
        setLoading(false)
        setHasLoaded(true)
      }
    },
    []
  )

  // ===================================================
  // TỰ ĐỘNG LỌC THEO NGÀY / TUẦN / THÁNG
  // ===================================================

  useEffect(() => {
    if (filterType === 'Tùy chọn') {
      return
    }

    const today = new Date()
    const from = getStartDate(filterType, today)

    if (!from) {
      return
    }

    const fromDate = getLocalDateString(from)
    const toDate = getLocalDateString(today)

    setStartDate(fromDate)
    setEndDate(toDate)

    void fetchData(fromDate, toDate)
  }, [filterType, fetchData])

  // ===================================================
  // TÍNH TOÁN BÁO CÁO
  // ===================================================

  const report = useMemo(() => {
    const totalInvested = transactions.reduce((sum, tx) => {
      return (
        sum +
        toNumber(tx.quantity) *
          toNumber(tx.buyprice)
      )
    }, 0)

    const totalFee = transactions.reduce((sum, tx) => {
      return (
        sum +
        toNumber(tx.transactionfee) +
        toNumber(tx.sellfee)
      )
    }, 0)

    const totalPnL = transactions.reduce((sum, tx) => {
      return sum + getTransactionPnL(tx)
    }, 0)

    const netProfit = totalPnL - totalFee

    const gainers = transactions.filter(
      (tx) => getTransactionPnL(tx) > 0
    )

    const losers = transactions.filter(
      (tx) => getTransactionPnL(tx) < 0
    )

    const categoryMap = transactions.reduce<
      Record<string, number>
    >((acc, tx) => {
      const category = tx.category || 'Chưa phân loại'

      acc[category] =
        (acc[category] || 0) +
        toNumber(tx.quantity) *
          toNumber(tx.buyprice)

      return acc
    }, {})

    const categoryDist: CategoryItem[] = Object.entries(
      categoryMap
    ).map(([name, value]) => ({
      name,
      value,
    }))

    const sortedByPnL: ChartTransaction[] = transactions
      .map((tx) => ({
        ...tx,
        pnl: getTransactionPnL(tx),
      }))
      .sort((a, b) => b.pnl - a.pnl)

    return {
      totalInvested,
      totalFee,
      totalPnL,
      netProfit,
      gainers,
      losers,
      categoryDist,
      sortedByPnL,
    }
  }, [transactions])

  const {
    totalInvested,
    totalFee,
    totalPnL,
    netProfit,
    gainers,
    losers,
    categoryDist,
    sortedByPnL,
  } = report

  // ===================================================
  // LỌC THỦ CÔNG
  // ===================================================

  const handleFilter = () => {
    if (!startDate || !endDate) {
      setErrorMessage(
        'Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.'
      )
      return
    }

    void fetchData(startDate, endDate)
  }

  // ===================================================
  // GIAO DIỆN
  // ===================================================

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 text-white sm:p-6">

      {/* TIÊU ĐỀ */}

      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">
          📊 Báo Cáo Danh Mục Đầu Tư
        </h1>

        <p className="mt-1 text-sm text-gray-400">
          Theo dõi hiệu quả giao dịch, lợi nhuận và phân bổ
          danh mục.
        </p>
      </div>

      {/* BỘ LỌC */}

      <div className="rounded-xl bg-zinc-900 p-4">
        <h2 className="mb-3 text-lg font-semibold">
          📅 Bộ lọc thời gian
        </h2>

        <div className="flex flex-wrap items-center gap-3">

          <label htmlFor="filterType" className="text-sm">
            Lọc theo:
          </label>

          <select
            id="filterType"
            className="rounded bg-zinc-800 p-2 text-white"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="Ngày">Ngày</option>
            <option value="Tuần">Tuần</option>
            <option value="Tháng">Tháng</option>
            <option value="Tùy chọn">Tùy chọn</option>
          </select>

          <input
            type="date"
            aria-label="Ngày bắt đầu"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded bg-zinc-800 p-2 text-white"
          />

          <span className="text-gray-400">Đến</span>

          <input
            type="date"
            aria-label="Ngày kết thúc"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded bg-zinc-800 p-2 text-white"
          />

          <button
            type="button"
            onClick={handleFilter}
            disabled={loading}
            className="rounded bg-blue-600 px-4 py-2 font-medium transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Đang tải...' : 'Lọc báo cáo'}
          </button>

          <button
            type="button"
            onClick={() => {
              setFilterType('Tùy chọn')
              setStartDate('')
              setEndDate('')
              void fetchData()
            }}
            disabled={loading}
            className="rounded bg-zinc-700 px-4 py-2 transition hover:bg-zinc-600 disabled:opacity-50"
          >
            Toàn bộ lịch sử
          </button>

        </div>

        {loading && (
          <div className="mt-4 rounded-lg bg-blue-950/50 p-3 text-sm text-blue-300">
            ⏳ Đang tải dữ liệu báo cáo...
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-300"
          >
            ❌ {errorMessage}
          </div>
        )}

        {!loading && !errorMessage && hasLoaded && (
          <p className="mt-3 text-sm text-gray-400">
            Đã tải {transactions.length} giao dịch.
          </p>
        )}
      </div>

      {/* TỔNG QUAN */}

      <div className="rounded-xl bg-zinc-900 p-4">
        <h2 className="mb-4 text-xl font-bold">
          🧠 Tổng Quan Danh Mục
        </h2>

        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">

          <div className="rounded-lg bg-zinc-800/70 p-3">
            <p className="text-gray-400">
              💼 Tổng vốn đầu tư
            </p>

            <p className="mt-1 text-lg font-semibold text-yellow-400">
              {formatNumber(totalInvested)} đ
            </p>
          </div>

          <div className="rounded-lg bg-zinc-800/70 p-3">
            <p className="text-gray-400">
              📈 Giao dịch lãi
            </p>

            <p className="mt-1 text-lg font-semibold text-green-400">
              {gainers.length}
            </p>
          </div>

          <div className="rounded-lg bg-zinc-800/70 p-3">
            <p className="text-gray-400">
              📉 Giao dịch lỗ
            </p>

            <p className="mt-1 text-lg font-semibold text-red-400">
              {losers.length}
            </p>
          </div>

          <div className="rounded-lg bg-zinc-800/70 p-3">
            <p className="text-gray-400">
              💰 Lãi/lỗ sau phí
            </p>

            <p
              className={`mt-1 text-lg font-semibold ${
                netProfit >= 0
                  ? 'text-green-400'
                  : 'text-red-400'
              }`}
            >
              {formatNumber(netProfit)} đ
            </p>
          </div>

          <div className="rounded-lg bg-zinc-800/70 p-3">
            <p className="text-gray-400">
              💸 Tổng phí giao dịch
            </p>

            <p className="mt-1 text-lg font-semibold text-orange-400">
              {formatNumber(totalFee)} đ
            </p>
          </div>

          <div className="rounded-lg bg-zinc-800/70 p-3">
            <p className="text-gray-400">
              🗂 Tổng giao dịch
            </p>

            <p className="mt-1 text-lg font-semibold text-blue-400">
              {transactions.length}
            </p>
          </div>

        </div>
      </div>

      {/* BIỂU ĐỒ */}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* PHÂN BỔ DANH MỤC */}

        <div className="min-w-0 rounded-xl bg-zinc-900 p-4">
          <h2 className="mb-4 text-lg font-bold">
            📊 Phân Bổ Danh Mục
          </h2>

          {categoryDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={categoryDist}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  label
                >
                  {categoryDist.map((entry, index) => (
                    <Cell
                      key={`category-${entry.name}-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>

                <Tooltip
                  formatter={(value) => formatNumber(Number(value ?? 0))}
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-gray-500">
              {loading
                ? 'Đang tải dữ liệu...'
                : 'Chưa có dữ liệu để hiển thị biểu đồ.'}
            </div>
          )}
        </div>

        {/* TOP 5 GIAO DỊCH */}

        <div className="min-w-0 rounded-xl bg-zinc-900 p-4">
          <h2 className="mb-4 text-lg font-bold">
            🔍 Top 5 Giao Dịch Theo Lãi/Lỗ
          </h2>

          {sortedByPnL.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={sortedByPnL.slice(0, 5)}
                margin={{
                  top: 10,
                  right: 10,
                  left: 10,
                  bottom: 5,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#3f3f46"
                />

                <XAxis
                  dataKey="assetname"
                  stroke="#a1a1aa"
                  tick={{ fontSize: 12 }}
                />

                <YAxis
                  stroke="#a1a1aa"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) =>
                    new Intl.NumberFormat('vi-VN', {
                      notation: 'compact',
                      maximumFractionDigits: 1,
                    }).format(value)
                  }
                />

                <Tooltip
                  formatter={(value) => formatNumber(Number(value ?? 0))}
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />

                <Bar
                  dataKey="pnl"
                  name="Lãi/lỗ"
                  radius={[4, 4, 0, 0]}
                  fill="#8884d8"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-gray-500">
              {loading
                ? 'Đang tải dữ liệu...'
                : 'Chưa có giao dịch để hiển thị.'}
            </div>
          )}
        </div>

      </div>

      {/* DANH SÁCH GIAO DỊCH */}

      <div className="overflow-x-auto rounded-xl bg-zinc-900 p-4">
        <h2 className="mb-4 text-xl font-bold">
          📋 Danh Sách Giao Dịch
        </h2>

        <table className="min-w-full text-left text-sm text-white">
          <thead>
            <tr className="border-b border-gray-700 text-gray-300">
              <th className="whitespace-nowrap p-3">Mã</th>
              <th className="whitespace-nowrap p-3">Danh mục</th>
              <th className="whitespace-nowrap p-3">Giá mua</th>
              <th className="whitespace-nowrap p-3">Giá hiện tại/bán</th>
              <th className="whitespace-nowrap p-3">Số lượng</th>
              <th className="whitespace-nowrap p-3">Lãi/lỗ</th>
              <th className="whitespace-nowrap p-3">Trạng thái</th>
              <th className="whitespace-nowrap p-3">Thao tác</th>
            </tr>
          </thead>

          <tbody>
            {transactions.map((tx) => {
              const pnl = getTransactionPnL(tx)
              const isProfit = pnl >= 0

              return (
                <tr
                  key={tx.id}
                  className="border-b border-gray-800 transition hover:bg-zinc-800/60"
                >
                  <td className="whitespace-nowrap p-3 font-medium">
                    {tx.assetname || 'N/A'}
                  </td>

                  <td className="whitespace-nowrap p-3">
                    {tx.category || 'Chưa phân loại'}
                  </td>

                  <td className="whitespace-nowrap p-3">
                    {formatNumber(toNumber(tx.buyprice))} đ
                  </td>

                  <td className="whitespace-nowrap p-3">
                    {formatNumber(getTransactionPrice(tx))} đ
                  </td>

                  <td className="whitespace-nowrap p-3">
                    {formatNumber(toNumber(tx.quantity))}
                  </td>

                  <td
                    className={`whitespace-nowrap p-3 font-medium ${
                      isProfit
                        ? 'text-green-400'
                        : 'text-red-400'
                    }`}
                  >
                    {formatNumber(pnl)} đ
                  </td>

                  <td className="whitespace-nowrap p-3">
                    {tx.issold
                      ? '✅ Đã bán'
                      : '🕒 Nắm giữ'}
                  </td>

                  <td className="whitespace-nowrap p-3">
                    <button
                      type="button"
                      onClick={() => setEditingTx(tx)}
                      className="text-blue-400 hover:text-blue-300 hover:underline"
                    >
                      ✏️ Sửa
                    </button>
                  </td>
                </tr>
              )
            })}

            {transactions.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="p-8 text-center text-gray-400"
                >
                  {loading
                    ? 'Đang tải dữ liệu giao dịch...'
                    : errorMessage
                      ? 'Không thể tải danh sách giao dịch.'
                      : 'Không có giao dịch trong khoảng thời gian đã chọn.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* GỢI Ý AI */}

      <div className="rounded-xl bg-zinc-900 p-4">
        <h2 className="mb-4 text-xl font-bold">
          💡 Gợi Ý AI
        </h2>

        {transactions.length === 0 ? (
          <p className="text-sm text-gray-400">
            Chưa có đủ dữ liệu giao dịch để đưa ra nhận xét.
          </p>
        ) : (
          <ul className="list-inside list-disc space-y-2 text-sm text-gray-300">

            {losers.length > gainers.length && (
              <li>
                Số giao dịch lỗ đang nhiều hơn giao dịch lãi.
                Hãy rà soát điểm mua, điểm bán và kỷ luật quản
                trị rủi ro.
              </li>
            )}

            {totalInvested > 0 &&
              categoryDist.some(
                (category) =>
                  category.name === 'Crypto' &&
                  category.value / totalInvested > 0.5
              ) && (
                <li>
                  Tỷ trọng Crypto đang vượt 50% tổng vốn đầu
                  tư theo giá mua. Hãy cân nhắc mức độ tập
                  trung rủi ro.
                </li>
              )}

            {sortedByPnL[0] && (
              <li>
                Giao dịch có lãi/lỗ cao nhất trong danh sách
                theo dõi:{' '}
                <strong className="text-blue-300">
                  {sortedByPnL[0].assetname}
                </strong>
                {' '}với kết quả{' '}
                <strong
                  className={
                    sortedByPnL[0].pnl >= 0
                      ? 'text-green-400'
                      : 'text-red-400'
                  }
                >
                  {formatNumber(sortedByPnL[0].pnl)} đ
                </strong>
                .
              </li>
            )}

            {netProfit < 0 && (
              <li>
                Tổng lãi/lỗ sau phí đang âm. Nên kiểm tra
                những giao dịch gây thua lỗ lớn trước khi
                tăng thêm tỷ trọng đầu tư.
              </li>
            )}

            {gainers.length === 0 && losers.length === 0 && (
              <li>
                Chưa có giao dịch ghi nhận lãi hoặc lỗ.
                Hãy kiểm tra giá mua, giá hiện tại và số
                lượng của các tài sản.
              </li>
            )}

            <li>
              Tổng phí giao dịch hiện được tính từ các cột
              transactionfee và sellfee. Hãy bảo đảm hai
              cột này sử dụng cùng đơn vị tiền tệ với lợi
              nhuận.
            </li>

          </ul>
        )}

        <p className="mt-4 border-t border-zinc-700 pt-3 text-xs text-gray-500">
          Lưu ý: Đây là nhận xét tự động dựa trên dữ liệu
          danh mục, không phải dự báo chắc chắn về thị trường.
        </p>
      </div>

      {/* SỬA GIAO DỊCH */}

      {editingTx && (
        <EditTransactionForm
          initial={editingTx}
          onCancel={() => setEditingTx(null)}
          onSave={() => {
            setEditingTx(null)

            // Tải lại đúng khoảng thời gian hiện tại.
            if (
              filterType !== 'Tùy chọn' &&
              startDate &&
              endDate
            ) {
              void fetchData(startDate, endDate)
            } else if (startDate && endDate) {
              void fetchData(startDate, endDate)
            } else {
              void fetchData()
            }
          }}
        />
      )}

    </div>
  )
}

