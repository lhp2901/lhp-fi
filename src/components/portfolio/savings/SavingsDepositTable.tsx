
'use client'

import { useState } from 'react'
import {
  Pencil,
  Trash2,
  CheckCircle2,
  CalendarDays,
  Wallet,
  Landmark,
  Clock3,
  Loader2,
  CircleAlert,
  TrendingUp,
  PiggyBank,
} from 'lucide-react'

import type { SavingsDeposit } from '@/lib/savings/types'

interface SavingsDepositTableProps {
  deposits: SavingsDeposit[]
  loading?: boolean
  onEdit?: (deposit: SavingsDeposit) => void
  onSettle?: (deposit: SavingsDeposit) => void | Promise<void>
  onDelete?: (deposit: SavingsDeposit) => void | Promise<void>
}

const CLOSED_STATUSES = ['SETTLED', 'CLOSED', 'CANCELLED']

const formatVND = (value: number | string | null | undefined) => {
  const amount = Number(value ?? 0)

  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0)
}

const formatDate = (value: string | null | undefined) => {
  if (!value) return '—'

  const date = new Date(`${value.slice(0, 10)}T00:00:00`)

  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('vi-VN')
}

const parseDate = (value: string | null | undefined) => {
  if (!value) return null

  const date = new Date(`${value.slice(0, 10)}T00:00:00`)

  return Number.isNaN(date.getTime()) ? null : date
}

const getDaysRemaining = (maturityDate: string | null | undefined) => {
  const maturity = parseDate(maturityDate)

  if (!maturity) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return Math.round(
    (maturity.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  )
}

const getDaysBetween = (
  startValue: string | null | undefined,
  endValue: string | null | undefined,
) => {
  const start = parseDate(startValue)
  const end = parseDate(endValue)

  if (!start || !end || end < start) return null

  return Math.round(
    (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
  )
}

const getStatus = (deposit: SavingsDeposit) => {
  const status = String(deposit.status ?? '').toUpperCase()

  if (status === 'SETTLED' || status === 'CLOSED') {
    return {
      label: 'Đã tất toán',
      className:
        'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    }
  }

  if (status === 'CANCELLED') {
    return {
      label: 'Đã hủy',
      className:
        'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    }
  }

  const days = getDaysRemaining(deposit.maturity_date)

  if (days !== null && days < 0) {
    return {
      label: 'Quá hạn',
      className:
        'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
    }
  }

  if (days === 0) {
    return {
      label: 'Đến hạn hôm nay',
      className:
        'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    }
  }

  return {
    label: 'Đang gửi',
    className:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  }
}

/**
 * Tính lãi đơn:
 * Tiền lãi = Tiền gốc × Lãi suất năm × Số ngày / 365.
 *
 * Lãi tạm tính:
 * - Tính đến hôm nay.
 * - Không vượt quá ngày đáo hạn.
 * - Nếu đã quá hạn, giữ lãi ước tính tại ngày đáo hạn.
 *
 * Lãi dự kiến:
 * - Tính theo toàn bộ kỳ hạn từ ngày gửi đến ngày đáo hạn.
 *
 * Đây là ước tính, không thay thế cách tính thực tế của ngân hàng.
 */
const calculateInterest = (deposit: SavingsDeposit) => {
  const principal = Number(deposit.principal ?? 0)
  const rate = Number(deposit.annual_interest_rate ?? 0)

  const start = parseDate(deposit.start_date)
  const maturity = parseDate(deposit.maturity_date)

  const invalid =
    !Number.isFinite(principal) ||
    !Number.isFinite(rate) ||
    principal <= 0 ||
    rate < 0 ||
    !start ||
    !maturity ||
    maturity < start

  if (invalid || !start || !maturity) {
    return {
      elapsedDays: 0,
      termDays: 0,
      accruedInterest: 0,
      expectedInterest: 0,
      estimatedTotal: Math.max(0, Number.isFinite(principal) ? principal : 0),
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const termDays = getDaysBetween(deposit.start_date, deposit.maturity_date) ?? 0

  // Chỉ tính lãi trong thời gian gửi thực tế.
  // Nếu ngày hiện tại sau ngày đáo hạn, dừng tại ngày đáo hạn.
  const effectiveEnd =
    today.getTime() < maturity.getTime() ? today : maturity

  const elapsedDays =
    today.getTime() <= start.getTime()
      ? 0
      : Math.max(
          0,
          Math.round(
            (effectiveEnd.getTime() - start.getTime()) /
              (24 * 60 * 60 * 1000),
          ),
        )

  const dailyRate = rate / 100 / 365

  const expectedInterest = principal * dailyRate * termDays
  const accruedInterest = principal * dailyRate * elapsedDays

  return {
    elapsedDays,
    termDays,
    accruedInterest,
    expectedInterest,
    estimatedTotal: principal + expectedInterest,
  }
}

export default function SavingsDepositTable({
  deposits,
  loading = false,
  onEdit,
  onSettle,
  onDelete,
}: SavingsDepositTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [settlingId, setSettlingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async (deposit: SavingsDeposit) => {
    if (!onDelete) return

    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa sổ tiết kiệm "${deposit.deposit_name}" tại ${deposit.bank_name} không?\n\nThao tác này không thể tự hoàn tác.`,
    )

    if (!confirmed) return

    setError(null)
    setDeletingId(deposit.id)

    try {
      await onDelete(deposit)
    } catch (err) {
      console.error('Lỗi xóa sổ tiết kiệm:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Không thể xóa sổ tiết kiệm. Vui lòng thử lại.',
      )
    } finally {
      setDeletingId(null)
    }
  }

  const handleSettle = async (deposit: SavingsDeposit) => {
    if (!onSettle) return

    const confirmed = window.confirm(
      `Xác nhận đánh dấu sổ "${deposit.deposit_name}" tại ${deposit.bank_name} là đã tất toán?\n\nĐây là thao tác cập nhật trạng thái trên LHP-FI, không phải giao dịch rút tiền thực tế tại ngân hàng.`,
    )

    if (!confirmed) return

    setError(null)
    setSettlingId(deposit.id)

    try {
      await onSettle(deposit)
    } catch (err) {
      console.error('Lỗi tất toán sổ tiết kiệm:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Không thể tất toán sổ tiết kiệm. Vui lòng thử lại.',
      )
    } finally {
      setSettlingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-48 items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white p-8 text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Đang tải danh sách sổ tiết kiệm...</span>
      </div>
    )
  }

  const activeDeposits = deposits.filter(
    (deposit) =>
      !CLOSED_STATUSES.includes(
        String(deposit.status ?? '').toUpperCase(),
      ),
  )

  const totalPrincipal = activeDeposits.reduce(
    (sum, deposit) => sum + Math.max(0, Number(deposit.principal) || 0),
    0,
  )

  const totalAccruedInterest = activeDeposits.reduce(
    (sum, deposit) => sum + calculateInterest(deposit).accruedInterest,
    0,
  )

  const totalExpectedInterest = activeDeposits.reduce(
    (sum, deposit) => sum + calculateInterest(deposit).expectedInterest,
    0,
  )

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-col gap-2 border-b border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Danh sách sổ tiết kiệm
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Tổng cộng {deposits.length} sổ tiết kiệm
            </p>
          </div>

          <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
            Đang theo dõi: {activeDeposits.length} sổ
          </div>
        </div>

        {deposits.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
            <div className="mb-4 rounded-full bg-blue-50 p-4 dark:bg-blue-950/40">
              <Landmark className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>

            <h4 className="font-semibold text-gray-900 dark:text-white">
              Chưa có sổ tiết kiệm
            </h4>

            <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
              Các khoản tiền gửi sẽ xuất hiện tại đây để theo dõi tiền gốc,
              lãi tạm tính và ngày đáo hạn.
            </p>
          </div>
        ) : (
          <>
            {/* Thẻ hiển thị trên điện thoại */}
            <div className="space-y-3 p-3 md:hidden">
              {deposits.map((deposit) => {
                const status = getStatus(deposit)
                const interest = calculateInterest(deposit)
                const days = getDaysRemaining(deposit.maturity_date)

                const isDeleting = deletingId === deposit.id
                const isSettling = settlingId === deposit.id

                const closed = CLOSED_STATUSES.includes(
                  String(deposit.status ?? '').toUpperCase(),
                )

                return (
                  <article
                    key={deposit.id}
                    className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-950/40">
                          <Landmark className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>

                        <div className="min-w-0">
                          <h4 className="break-words font-semibold text-gray-900 dark:text-white">
                            {deposit.deposit_name}
                          </h4>
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {deposit.bank_name}
                          </p>
                          {deposit.account_reference && (
                            <p className="mt-1 break-all text-xs text-gray-400">
                              {deposit.account_reference}
                            </p>
                          )}
                        </div>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Tiền gốc
                        </p>
                        <p className="mt-1 break-words font-semibold text-gray-900 dark:text-white">
                          {formatVND(deposit.principal)}
                        </p>
                      </div>

                      <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/30">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Lãi suất năm
                        </p>
                        <p className="mt-1 font-semibold text-emerald-700 dark:text-emerald-300">
                          {Number(deposit.annual_interest_rate).toLocaleString(
                            'vi-VN',
                            { maximumFractionDigits: 4 },
                          )}
                          %
                        </p>
                      </div>

                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                        <p className="text-xs text-emerald-700 dark:text-emerald-300">
                          Lãi tạm tính
                        </p>
                        <p className="mt-1 break-words font-bold text-emerald-700 dark:text-emerald-300">
                          {formatVND(interest.accruedInterest)}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {interest.elapsedDays} ngày tích lũy
                        </p>
                      </div>

                      <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-900 dark:bg-blue-950/30">
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          Lãi dự kiến
                        </p>
                        <p className="mt-1 break-words font-bold text-blue-700 dark:text-blue-300">
                          {formatVND(interest.expectedInterest)}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {interest.termDays} ngày kỳ hạn
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Ngày gửi
                        </p>
                        <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                          {formatDate(deposit.start_date)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Ngày đáo hạn
                        </p>
                        <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                          {formatDate(deposit.maturity_date)}
                        </p>

                        {days !== null && !closed && (
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {days < 0
                              ? `Quá hạn ${Math.abs(days)} ngày`
                              : days === 0
                                ? 'Đáo hạn hôm nay'
                                : `Còn ${days} ngày`}
                          </p>
                        )}
                      </div>

                      <div className="col-span-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Tổng gốc + lãi dự kiến
                        </p>
                        <p className="mt-1 break-words font-bold text-gray-900 dark:text-white">
                          {formatVND(interest.estimatedTotal)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
                      {onEdit && !closed && (
                        <button
                          type="button"
                          onClick={() => onEdit(deposit)}
                          disabled={isDeleting || isSettling}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/40"
                        >
                          <Pencil className="h-4 w-4" />
                          Sửa
                        </button>
                      )}

                      {onSettle && !closed && (
                        <button
                          type="button"
                          onClick={() => void handleSettle(deposit)}
                          disabled={isDeleting || isSettling}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                        >
                          {isSettling ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          {isSettling ? 'Đang xử lý...' : 'Tất toán'}
                        </button>
                      )}

                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => void handleDelete(deposit)}
                          disabled={isDeleting || isSettling}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                        >
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          {isDeleting ? 'Đang xóa...' : 'Xóa'}
                        </button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>

            {/* Bảng hiển thị trên máy tính */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1450px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">
                      Ngân hàng / Sổ
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Tiền gốc
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Lãi suất
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Lãi tạm tính
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Lãi dự kiến
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Tổng gốc + lãi
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      Ngày gửi
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      Đáo hạn
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      Trạng thái
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Thao tác
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {deposits.map((deposit) => {
                    const status = getStatus(deposit)
                    const interest = calculateInterest(deposit)
                    const days = getDaysRemaining(deposit.maturity_date)

                    const isDeleting = deletingId === deposit.id
                    const isSettling = settlingId === deposit.id

                    const closed = CLOSED_STATUSES.includes(
                      String(deposit.status ?? '').toUpperCase(),
                    )

                    return (
                      <tr
                        key={deposit.id}
                        className="transition hover:bg-gray-50/80 dark:hover:bg-gray-800/50"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-start gap-3">
                            <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-950/40">
                              <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>

                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {deposit.bank_name}
                              </p>
                              <p className="mt-1 text-gray-600 dark:text-gray-300">
                                {deposit.deposit_name}
                              </p>

                              {deposit.account_reference && (
                                <p className="mt-1 text-xs text-gray-400">
                                  {deposit.account_reference}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-gray-900 dark:text-white">
                          {formatVND(deposit.principal)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right">
                          <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                            {Number(deposit.annual_interest_rate).toLocaleString(
                              'vi-VN',
                              { maximumFractionDigits: 4 },
                            )}
                            %
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right">
                          <p className="font-bold text-emerald-700 dark:text-emerald-300">
                            {formatVND(interest.accruedInterest)}
                          </p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {interest.elapsedDays} ngày
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right">
                          <p className="font-semibold text-blue-700 dark:text-blue-300">
                            {formatVND(interest.expectedInterest)}
                          </p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {interest.termDays} ngày kỳ hạn
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-gray-900 dark:text-white">
                          {formatVND(interest.estimatedTotal)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-gray-600 dark:text-gray-300">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-4 w-4 text-gray-400" />
                            {formatDate(deposit.start_date)}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4">
                          <p className="text-gray-900 dark:text-white">
                            {formatDate(deposit.maturity_date)}
                          </p>

                          {days !== null && !closed && (
                            <p
                              className={`mt-1 inline-flex items-center gap-1 text-xs ${
                                days < 0
                                  ? 'text-orange-600 dark:text-orange-400'
                                  : days === 0
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-gray-500 dark:text-gray-400'
                              }`}
                            >
                              <Clock3 className="h-3 w-3" />
                              {days < 0
                                ? `Quá hạn ${Math.abs(days)} ngày`
                                : days === 0
                                  ? 'Đến hạn hôm nay'
                                  : `Còn ${days} ngày`}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-1.5">
                            {onEdit && !closed && (
                              <button
                                type="button"
                                title="Sửa sổ tiết kiệm"
                                aria-label={`Sửa sổ ${deposit.deposit_name}`}
                                onClick={() => onEdit(deposit)}
                                disabled={isDeleting || isSettling}
                                className="rounded-lg border border-blue-200 p-2 text-blue-700 transition hover:bg-blue-50 disabled:opacity-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/40"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}

                            {onSettle && !closed && (
                              <button
                                type="button"
                                title="Tất toán sổ tiết kiệm"
                                aria-label={`Tất toán sổ ${deposit.deposit_name}`}
                                onClick={() => void handleSettle(deposit)}
                                disabled={isDeleting || isSettling}
                                className="rounded-lg border border-emerald-200 p-2 text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                              >
                                {isSettling ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4" />
                                )}
                              </button>
                            )}

                            {onDelete && (
                              <button
                                type="button"
                                title="Xóa sổ tiết kiệm"
                                aria-label={`Xóa sổ ${deposit.deposit_name}`}
                                onClick={() => void handleDelete(deposit)}
                                disabled={isDeleting || isSettling}
                                className="rounded-lg border border-red-200 p-2 text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                              >
                                {isDeleting ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>

                <tfoot className="border-t-2 border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                  <tr>
                    <td className="px-4 py-4 font-bold text-gray-900 dark:text-white">
                      TỔNG CỘNG
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-right font-bold text-gray-900 dark:text-white">
                      {formatVND(totalPrincipal)}
                    </td>

                    <td className="px-4 py-4 text-right text-gray-500">
                      —
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-right font-bold text-emerald-700 dark:text-emerald-300">
                      {formatVND(totalAccruedInterest)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-right font-bold text-blue-700 dark:text-blue-300">
                      {formatVND(totalExpectedInterest)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-right font-bold text-gray-900 dark:text-white">
                      {formatVND(totalPrincipal + totalExpectedInterest)}
                    </td>

                    <td colSpan={4} className="px-4 py-4 text-xs text-gray-500 dark:text-gray-400">
                      Lãi tạm tính theo số ngày thực tế, quy đổi 365 ngày/năm.
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>

      <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
        Lưu ý: Lãi tạm tính được ước lượng theo tiền gốc, lãi suất năm và số
        ngày đã gửi, không vượt quá ngày đáo hạn. Lãi dự kiến được tính cho
        toàn bộ kỳ hạn. Số tiền thực nhận có thể khác do phương thức trả lãi,
        thuế/phí nếu có, quy tắc làm tròn và điều kiện tất toán trước hạn của
        ngân hàng. Nếu sổ đã tất toán, các số lãi trên vẫn là ước tính theo
        thông tin gốc, không phải số tiền thực nhận đã xác nhận.
      </p>
    </div>
  )
}

