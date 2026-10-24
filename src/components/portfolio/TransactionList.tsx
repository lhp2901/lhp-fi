
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

import EditTransactionForm, {
  type EditableTransaction,
} from '@/components/portfolio/EditTransactionForm'

import {
  calculatePnL,
  formatNumber,
  formatPercent,
} from '@/lib/utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createBrowserClient(supabaseUrl, supabaseAnonKey)
    : null

type Transaction = EditableTransaction & {
  id: string
  user_id: string
  assetname: string
  category: string
  quantity: number | string
  buyprice: number | string
  currentprice: number | string
  buydate: string
  transactionfee?: number | string | null
  sellprice?: number | string | null
  sellfee?: number | string | null
  issold?: boolean | null
  created_at?: string | null
}

type TransactionListProps = {
  onChanged?: () => void | Promise<void>
}

type SortOption =
  | 'newest'
  | 'oldest'
  | 'asset-asc'
  | 'asset-desc'
  | 'pnl-desc'
  | 'pnl-asc'

const PAGE_SIZE = 10

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'Tất cả danh mục' },
  { value: 'Cổ phiếu', label: 'Cổ phiếu' },
  { value: 'Crypto', label: 'Crypto' },
  { value: 'VN30F1M', label: 'VN30F1M' },
]

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (value === null || value === undefined || value === '') {
    return 0
  }

  const parsed = Number(String(value).replace(/,/g, '').trim())

  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDate(value?: string | null): string {
  if (!value) return '—'

  const date = new Date(`${value.slice(0, 10)}T00:00:00`)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('vi-VN').format(date)
}

function getTransactionPnL(transaction: Transaction): number {
  const quantity = toNumber(transaction.quantity)
  const buyPrice = toNumber(transaction.buyprice)
  const sold = Boolean(transaction.issold)

  const exitPrice = sold
    ? toNumber(transaction.sellprice)
    : toNumber(transaction.currentprice)

  const exitFee = sold ? toNumber(transaction.sellfee) : 0
  const buyFee = toNumber(transaction.transactionfee)

  return (
    toNumber(calculatePnL(buyPrice, exitPrice, quantity)) -
    buyFee -
    exitFee
  )
}

function getTransactionPnLPercentage(
  transaction: Transaction
): number {
  const cost =
    toNumber(transaction.buyprice) * toNumber(transaction.quantity) +
    toNumber(transaction.transactionfee)

  if (cost <= 0) return 0

  return (getTransactionPnL(transaction) / cost) * 100
}

export default function TransactionList({
  onChanged,
}: TransactionListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [page, setPage] = useState(1)

  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null)

  const [sellingTransaction, setSellingTransaction] =
    useState<Transaction | null>(null)

  const [sellPrice, setSellPrice] = useState('')
  const [sellFee, setSellFee] = useState('0')
  const [sellDate, setSellDate] = useState(
    new Date().toISOString().slice(0, 10)
  )

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [savingSale, setSavingSale] = useState(false)

  // =========================================================
  // TẢI GIAO DỊCH TỪ SUPABASE
  // =========================================================
  const loadTransactions = useCallback(
    async (showRefreshIndicator = false) => {
      if (!supabase) {
        setError(
          'Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY.'
        )
        setLoading(false)
        return
      }

      if (showRefreshIndicator) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError('')

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError) throw authError

        if (!user) {
          setTransactions([])
          setError('Vui lòng đăng nhập để xem giao dịch.')
          return
        }

        const { data, error: queryError } = await supabase
          .from('portfolio_transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('buydate', { ascending: false })

        if (queryError) throw queryError

        setTransactions((data ?? []) as Transaction[])
      } catch (err) {
        console.error('Lỗi tải giao dịch:', err)

        setError(
          err instanceof Error
            ? err.message
            : 'Không thể tải danh sách giao dịch.'
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    []
  )

  useEffect(() => {
    void loadTransactions()
  }, [loadTransactions])

  // =========================================================
  // TÌM KIẾM, LỌC VÀ SẮP XẾP
  // =========================================================
  const filteredTransactions = useMemo(() => {
    const keyword = search.trim().toUpperCase()

    const result = transactions.filter((transaction) => {
      const matchesSearch =
        !keyword ||
        transaction.assetname.toUpperCase().includes(keyword) ||
        String(transaction.strategy ?? '')
          .toUpperCase()
          .includes(keyword) ||
        String(transaction.note ?? '')
          .toUpperCase()
          .includes(keyword) ||
        String(transaction.source ?? '')
          .toUpperCase()
          .includes(keyword)

      const matchesCategory =
        categoryFilter === 'all' ||
        transaction.category === categoryFilter

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'holding' && !transaction.issold) ||
        (statusFilter === 'sold' && Boolean(transaction.issold))

      return matchesSearch && matchesCategory && matchesStatus
    })

    result.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return (
            new Date(a.buydate).getTime() -
            new Date(b.buydate).getTime()
          )

        case 'asset-asc':
          return a.assetname.localeCompare(b.assetname)

        case 'asset-desc':
          return b.assetname.localeCompare(a.assetname)

        case 'pnl-desc':
          return getTransactionPnL(b) - getTransactionPnL(a)

        case 'pnl-asc':
          return getTransactionPnL(a) - getTransactionPnL(b)

        case 'newest':
        default:
          return (
            new Date(b.buydate).getTime() -
            new Date(a.buydate).getTime()
          )
      }
    })

    return result
  }, [transactions, search, categoryFilter, statusFilter, sortBy])

  useEffect(() => {
    setPage(1)
  }, [search, categoryFilter, statusFilter, sortBy])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTransactions.length / PAGE_SIZE)
  )

  const currentPage = Math.min(page, totalPages)

  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  // =========================================================
  // THỐNG KÊ DANH SÁCH
  // =========================================================
  const stats = useMemo(() => {
    const holdings = transactions.filter((tx) => !tx.issold)
    const sold = transactions.filter((tx) => Boolean(tx.issold))

    const invested = holdings.reduce(
      (sum, tx) =>
        sum +
        toNumber(tx.buyprice) * toNumber(tx.quantity) +
        toNumber(tx.transactionfee),
      0
    )

    const marketValue = holdings.reduce(
      (sum, tx) =>
        sum +
        toNumber(tx.currentprice) * toNumber(tx.quantity),
      0
    )

    const unrealizedPnL = holdings.reduce(
      (sum, tx) => sum + getTransactionPnL(tx),
      0
    )

    const realizedPnL = sold.reduce(
      (sum, tx) => sum + getTransactionPnL(tx),
      0
    )

    return {
      total: transactions.length,
      holdings: holdings.length,
      sold: sold.length,
      invested,
      marketValue,
      unrealizedPnL,
      realizedPnL,
    }
  }, [transactions])

  // =========================================================
  // XÓA GIAO DỊCH
  // =========================================================
  const handleDelete = async (transaction: Transaction) => {
    if (!supabase || deletingId) return

    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa giao dịch ${transaction.assetname}?\nThao tác này không thể hoàn tác.`
    )

    if (!confirmed) return

    setDeletingId(transaction.id)
    setError('')
    setSuccess('')

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) throw authError

      if (!user) {
        throw new Error('Phiên đăng nhập đã hết hạn.')
      }

      const { data, error: deleteError } = await supabase
        .from('portfolio_transactions')
        .delete()
        .eq('id', transaction.id)
        .eq('user_id', user.id)
        .select('id')

      if (deleteError) throw deleteError

      if (!data || data.length === 0) {
        throw new Error(
          'Không xóa được giao dịch. Vui lòng kiểm tra quyền RLS.'
        )
      }

      setTransactions((previous) =>
        previous.filter((item) => item.id !== transaction.id)
      )

      setSuccess(`Đã xóa giao dịch ${transaction.assetname}.`)

      await onChanged?.()
    } catch (err) {
      console.error('Lỗi xóa giao dịch:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Không thể xóa giao dịch.'
      )
    } finally {
      setDeletingId(null)
    }
  }

  // =========================================================
  // MỞ BIỂU MẪU BÁN
  // =========================================================
  const openSellForm = (transaction: Transaction) => {
    setSellingTransaction(transaction)
    setSellPrice(String(transaction.currentprice ?? ''))
    setSellFee('0')
    setSellDate(new Date().toISOString().slice(0, 10))
    setError('')
    setSuccess('')
  }

  // =========================================================
  // XÁC NHẬN BÁN TOÀN BỘ GIAO DỊCH
  // =========================================================
  const handleSell = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    if (!supabase || !sellingTransaction || savingSale) return

    const price = Number(sellPrice.replace(/,/g, '').trim())
    const fee = Number(sellFee.replace(/,/g, '').trim())

    if (!Number.isFinite(price) || price <= 0) {
      setError('Giá bán phải lớn hơn 0.')
      return
    }

    if (!Number.isFinite(fee) || fee < 0) {
      setError('Phí bán không hợp lệ.')
      return
    }

    setSavingSale(true)
    setError('')
    setSuccess('')

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) throw authError

      if (!user) {
        throw new Error('Phiên đăng nhập đã hết hạn.')
      }

      const { data, error: updateError } = await supabase
        .from('portfolio_transactions')
        .update({
          issold: true,
          sellprice: price,
          sellfee: fee,
        })
        .eq('id', sellingTransaction.id)
        .eq('user_id', user.id)
        .eq('issold', false)
        .select('id')

      if (updateError) throw updateError

      if (!data || data.length === 0) {
        throw new Error(
          'Không thể xác nhận bán. Giao dịch có thể đã được bán hoặc quyền RLS không cho phép cập nhật.'
        )
      }

      setSellingTransaction(null)
      setSuccess(
        `Đã cập nhật trạng thái bán cho ${sellingTransaction.assetname}.`
      )

      await loadTransactions(true)
      await onChanged?.()
    } catch (err) {
      console.error('Lỗi cập nhật giao dịch bán:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Không thể cập nhật giao dịch bán.'
      )
    } finally {
      setSavingSale(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500'

  return (
    <section className="space-y-5 text-white">
      {/* TIÊU ĐỀ */}
      {/*<div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold md:text-2xl">
            📋 Danh sách giao dịch
          </h2>

          <p className="mt-1 text-sm text-zinc-400">
            Quản lý giao dịch mua, bán và hiệu quả từng tài sản.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadTransactions(true)}
          disabled={loading || refreshing || Boolean(deletingId)}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {refreshing ? 'Đang tải...' : '↻ Làm mới'}
        </button>
      </div>*/}

      {/* THÔNG BÁO */}
      {error && (
        <div
          role="alert"
          className="break-words rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="break-words rounded-xl border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-300"
        >
          {success}
        </div>
      )}

      {/* THẺ TỔNG QUAN */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="Tổng giao dịch"
          value={String(stats.total)}
          subtitle={`${stats.holdings} đang nắm giữ · ${stats.sold} đã bán`}
        />

        <StatCard
          title="Vốn đang đầu tư"
          value={`${formatMoney(stats.invested)} đ`}
          subtitle="Bao gồm phí mua đã lưu"
        />

        <StatCard
          title="Giá trị hiện tại"
          value={`${formatMoney(stats.marketValue)} đ`}
          subtitle="Các giao dịch chưa bán"
        />

        <StatCard
          title="Lãi/lỗ chưa thực hiện"
          value={`${stats.unrealizedPnL > 0 ? '+' : ''}${formatMoney(stats.unrealizedPnL)} đ`}
          valueClass={
            stats.unrealizedPnL >= 0
              ? 'text-emerald-400'
              : 'text-red-400'
          }
          subtitle="Theo giá hiện tại"
        />
      </div>

      {/* BỘ LỌC */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-medium text-zinc-400">
            Tìm kiếm
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Mã, chiến lược, ghi chú..."
              className={`${inputClass} mt-2`}
            />
          </label>

          <label className="text-xs font-medium text-zinc-400">
            Danh mục
            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(event.target.value)
              }
              className={`${inputClass} mt-2`}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-zinc-400">
            Trạng thái
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              className={`${inputClass} mt-2`}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="holding">Đang nắm giữ</option>
              <option value="sold">Đã bán</option>
            </select>
          </label>

          <label className="text-xs font-medium text-zinc-400">
            Sắp xếp
            <select
              value={sortBy}
              onChange={(event) =>
                setSortBy(event.target.value as SortOption)
              }
              className={`${inputClass} mt-2`}
            >
              <option value="newest">Ngày mua mới nhất</option>
              <option value="oldest">Ngày mua cũ nhất</option>
              <option value="asset-asc">Mã tài sản A → Z</option>
              <option value="asset-desc">Mã tài sản Z → A</option>
              <option value="pnl-desc">Lãi/lỗ cao nhất</option>
              <option value="pnl-asc">Lãi/lỗ thấp nhất</option>
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
          <span>
            Tìm thấy {filteredTransactions.length} giao dịch
          </span>

          <button
            type="button"
            onClick={() => {
              setSearch('')
              setCategoryFilter('all')
              setStatusFilter('all')
              setSortBy('newest')
              setPage(1)
            }}
            className="text-emerald-400 hover:text-emerald-300"
          >
            Xóa bộ lọc
          </button>
        </div>
      </div>

      {/* BIỂU MẪU SỬA */}
      {editingTransaction && (
        <EditTransactionForm
          transaction={editingTransaction}
          onCancel={() => setEditingTransaction(null)}
          onSaved={async () => {
            setEditingTransaction(null)
            setSuccess('Đã lưu thay đổi giao dịch.')
            await loadTransactions(true)
            await onChanged?.()
          }}
        />
      )}

      {/* BIỂU MẪU BÁN */}
      {sellingTransaction && (
        <form
          onSubmit={handleSell}
          className="space-y-4 rounded-xl border border-amber-800/60 bg-zinc-900 p-4 md:p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-amber-300">
                💰 Xác nhận bán {sellingTransaction.assetname}
              </h3>

              <p className="mt-1 text-sm text-zinc-400">
                Biểu mẫu này đánh dấu bán toàn bộ khối lượng của giao dịch.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSellingTransaction(null)}
              disabled={savingSale}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
            >
              Đóng
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="text-sm text-zinc-300">
              Ngày bán
              <input
                type="date"
                value={sellDate}
                onChange={(event) => setSellDate(event.target.value)}
                className={`${inputClass} mt-2`}
              />
            </label>

            <label className="text-sm text-zinc-300">
              Giá bán *
              <input
                type="text"
                inputMode="decimal"
                value={sellPrice}
                onChange={(event) => setSellPrice(event.target.value)}
                required
                className={`${inputClass} mt-2`}
              />
            </label>

            <label className="text-sm text-zinc-300">
              Phí bán
              <input
                type="text"
                inputMode="decimal"
                value={sellFee}
                onChange={(event) => setSellFee(event.target.value)}
                className={`${inputClass} mt-2`}
              />
            </label>
          </div>

          <p className="text-xs text-amber-200/80">
            Lưu ý: bảng dữ liệu hiện tại chưa được xác nhận có cột ngày bán.
            Ngày bán ở biểu mẫu chỉ được dùng để nhập; code không ghi cột này
            vào Supabase để tránh lỗi nếu schema chưa có cột tương ứng.
          </p>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingSale}
              className="rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold hover:bg-amber-500 disabled:opacity-50"
            >
              {savingSale ? 'Đang cập nhật...' : 'Xác nhận đã bán'}
            </button>
          </div>
        </form>
      )}

      {/* BẢNG GIAO DỊCH */}
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
        <div className="flex flex-col justify-between gap-2 border-b border-zinc-800 p-4 sm:flex-row sm:items-center">
          <h3 className="font-semibold">Giao dịch đầu tư</h3>

          <span className="text-xs text-zinc-500">
            Trang {currentPage}/{totalPages}
          </span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-zinc-400">
            Đang tải giao dịch từ Supabase...
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-zinc-300">Không tìm thấy giao dịch.</p>
            <p className="mt-2 text-sm text-zinc-500">
              Thử thay đổi bộ lọc hoặc thêm giao dịch mới.
            </p>
          </div>
        ) : (
          <>
            {/* Bảng desktop */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead className="bg-zinc-950/80 text-xs uppercase text-zinc-400">
                  <tr>
                    <th className="px-4 py-3">Tài sản</th>
                    <th className="px-4 py-3">Ngày mua</th>
                    <th className="px-4 py-3 text-right">Khối lượng</th>
                    <th className="px-4 py-3 text-right">Giá mua</th>
                    <th className="px-4 py-3 text-right">Giá hiện tại / bán</th>
                    <th className="px-4 py-3 text-right">Phí mua</th>
                    <th className="px-4 py-3 text-right">Lãi/lỗ</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-800">
                  {paginatedTransactions.map((transaction) => {
                    const pnl = getTransactionPnL(transaction)
                    const pnlPercent =
                      getTransactionPnLPercentage(transaction)

                    return (
                      <tr
                        key={transaction.id}
                        className="transition hover:bg-zinc-800/40"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">
                              {transaction.assetname}
                            </span>

                            {transaction.highconviction && (
                              <span title="Độ tin cậy cao">⭐</span>
                            )}
                          </div>

                          <div className="mt-1 text-xs text-zinc-500">
                            {transaction.category}
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-zinc-300">
                          {formatDate(transaction.buydate)}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {formatNumber(toNumber(transaction.quantity))}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {formatMoney(toNumber(transaction.buyprice))}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {formatMoney(
                            transaction.issold
                              ? toNumber(transaction.sellprice)
                              : toNumber(transaction.currentprice)
                          )}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right text-zinc-300">
                          {formatMoney(toNumber(transaction.transactionfee))}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div
                            className={`font-semibold ${
                              pnl >= 0
                                ? 'text-emerald-400'
                                : 'text-red-400'
                            }`}
                          >
                            {pnl > 0 ? '+' : ''}
                            {formatMoney(pnl)}
                          </div>

                          <div
                            className={`mt-1 text-xs ${
                              pnlPercent >= 0
                                ? 'text-emerald-500'
                                : 'text-red-400'
                            }`}
                          >
                            {formatPercent(pnlPercent)}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          {transaction.issold ? (
                            <span className="whitespace-nowrap rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
                              Đã bán
                            </span>
                          ) : (
                            <span className="whitespace-nowrap rounded-full border border-emerald-800 bg-emerald-950/40 px-2.5 py-1 text-xs text-emerald-400">
                              Đang nắm giữ
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setEditingTransaction(transaction)
                              }
                              className="rounded-md border border-blue-800 px-2.5 py-1.5 text-xs text-blue-300 hover:bg-blue-950/40"
                            >
                              Sửa
                            </button>

                            {!transaction.issold && (
                              <button
                                type="button"
                                onClick={() => openSellForm(transaction)}
                                className="rounded-md border border-amber-800 px-2.5 py-1.5 text-xs text-amber-300 hover:bg-amber-950/40"
                              >
                                Bán
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => void handleDelete(transaction)}
                              disabled={deletingId === transaction.id}
                              className="rounded-md border border-red-900 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                            >
                              {deletingId === transaction.id
                                ? 'Đang xóa...'
                                : 'Xóa'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Danh sách mobile/tablet */}
            <div className="space-y-3 p-3 lg:hidden">
              {paginatedTransactions.map((transaction) => {
                const pnl = getTransactionPnL(transaction)
                const pnlPercent =
                  getTransactionPnLPercentage(transaction)

                return (
                  <article
                    key={transaction.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold">
                            {transaction.assetname}
                          </h4>

                          {transaction.highconviction && <span>⭐</span>}
                        </div>

                        <p className="mt-1 text-xs text-zinc-500">
                          {transaction.category} ·{' '}
                          {formatDate(transaction.buydate)}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          transaction.issold
                            ? 'bg-zinc-800 text-zinc-300'
                            : 'bg-emerald-950 text-emerald-400'
                        }`}
                      >
                        {transaction.issold
                          ? 'Đã bán'
                          : 'Đang nắm giữ'}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <MobileValue
                        label="Khối lượng"
                        value={formatNumber(toNumber(transaction.quantity))}
                      />

                      <MobileValue
                        label="Giá mua"
                        value={formatMoney(toNumber(transaction.buyprice))}
                      />

                      <MobileValue
                        label={transaction.issold ? 'Giá bán' : 'Giá hiện tại'}
                        value={formatMoney(
                          transaction.issold
                            ? toNumber(transaction.sellprice)
                            : toNumber(transaction.currentprice)
                        )}
                      />

                      <MobileValue
                        label="Phí mua"
                        value={formatMoney(toNumber(transaction.transactionfee))}
                      />
                    </div>

                    <div className="mt-4 rounded-lg border border-zinc-800 p-3">
                      <p className="text-xs text-zinc-500">Lãi/lỗ</p>

                      <p
                        className={`mt-1 text-lg font-bold ${
                          pnl >= 0
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        }`}
                      >
                        {pnl > 0 ? '+' : ''}
                        {formatMoney(pnl)}
                      </p>

                      <p
                        className={`mt-1 text-xs ${
                          pnlPercent >= 0
                            ? 'text-emerald-500'
                            : 'text-red-400'
                        }`}
                      >
                        {formatPercent(pnlPercent)}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingTransaction(transaction)
                        }
                        className="rounded-lg border border-blue-800 px-3 py-2 text-xs text-blue-300"
                      >
                        ✏️ Sửa
                      </button>

                      {!transaction.issold && (
                        <button
                          type="button"
                          onClick={() => openSellForm(transaction)}
                          className="rounded-lg border border-amber-800 px-3 py-2 text-xs text-amber-300"
                        >
                          💰 Bán
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => void handleDelete(transaction)}
                        disabled={deletingId === transaction.id}
                        className="rounded-lg border border-red-900 px-3 py-2 text-xs text-red-300 disabled:opacity-50"
                      >
                        {deletingId === transaction.id
                          ? 'Đang xóa...'
                          : '🗑️ Xóa'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}

        {/* PHÂN TRANG */}
        {!loading && filteredTransactions.length > 0 && (
          <div className="flex flex-col justify-between gap-3 border-t border-zinc-800 p-4 sm:flex-row sm:items-center">
            <p className="text-xs text-zinc-500">
              Hiển thị{' '}
              {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(
                currentPage * PAGE_SIZE,
                filteredTransactions.length
              )}{' '}
              trên {filteredTransactions.length} giao dịch
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setPage((previous) => Math.max(1, previous - 1))
                }
                disabled={currentPage <= 1}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Trước
              </button>

              <span className="min-w-16 text-center text-sm text-zinc-300">
                {currentPage}/{totalPages}
              </span>

              <button
                type="button"
                onClick={() =>
                  setPage((previous) =>
                    Math.min(totalPages, previous + 1)
                  )
                }
                disabled={currentPage >= totalPages}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Sau →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* TỔNG KẾT LÃI LỖ ĐÃ THỰC HIỆN */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <p className="text-sm text-zinc-400">
          Lãi/lỗ đã thực hiện từ các giao dịch đã bán
        </p>

        <p
          className={`mt-2 text-xl font-bold ${
            stats.realizedPnL >= 0
              ? 'text-emerald-400'
              : 'text-red-400'
          }`}
        >
          {stats.realizedPnL > 0 ? '+' : ''}
          {formatMoney(stats.realizedPnL)} đ
        </p>
      </div>
    </section>
  )
}

// =========================================================
// COMPONENT PHỤ
// =========================================================
function StatCard({
  title,
  value,
  subtitle,
  valueClass = 'text-white',
}: {
  title: string
  value: string
  subtitle: string
  valueClass?: string
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
      <p className="text-xs text-zinc-400">{title}</p>

      <p className={`mt-2 break-words text-lg font-bold ${valueClass}`}>
        {value}
      </p>

      <p className="mt-2 text-xs text-zinc-500">{subtitle}</p>
    </div>
  )
}

function MobileValue({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 break-words font-medium text-zinc-200">
        {value}
      </p>
    </div>
  )
}

