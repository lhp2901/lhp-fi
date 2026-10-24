'use client'

import type { SavingsDeposit } from '@/lib/savings/types'

import {
  calculateCurrentInterest,
  calculateExpectedInterest,
  formatVND,
  getDaysRemaining,
} from '@/lib/savings/calculations'

interface SavingsDepositTableProps {
  deposits: SavingsDeposit[]
  loading?: boolean
  onEdit?: (deposit: SavingsDeposit) => void
  onSettle?: (deposit: SavingsDeposit) => void
  onDelete?: (deposit: SavingsDeposit) => void | Promise<void>
}

const statusLabels: Record<string, string> = {
  ACTIVE: 'Đang gửi',
  MATURED: 'Đã đến hạn',
  RENEWED: 'Đã tái tục',
  SETTLED: 'Đã tất toán',
  EARLY_WITHDRAWAL: 'Rút trước hạn',
}

export default function SavingsDepositTable({
  deposits,
  loading = false,
  onEdit,
  onSettle,
  onDelete,
}: SavingsDepositTableProps) {
  if (loading) {
    return (
      <div className="rounded-xl bg-zinc-900 p-8 text-center text-zinc-400">
        Đang tải danh sách tiết kiệm...
      </div>
    )
  }

  const handleDelete = async (deposit: SavingsDeposit) => {
    if (!onDelete) return

    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa khoản tiết kiệm "${deposit.deposit_name}" tại ${deposit.bank_name}?\n\n` +
        `Tiền gốc: ${formatVND(Number(deposit.principal))}\n\n` +
        'Thao tác này sẽ xóa bản ghi khỏi hệ thống và không thể tự khôi phục.'
    )

    if (!confirmed) return

    try {
      await onDelete(deposit)
    } catch (error) {
      console.error('Lỗi xóa khoản tiết kiệm:', error)

      window.alert(
        error instanceof Error
          ? error.message
          : 'Không thể xóa khoản tiết kiệm. Vui lòng thử lại.'
      )
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="mb-4 text-lg font-bold text-white">
        📋 Danh sách khoản tiết kiệm
      </h2>

      {deposits.length === 0 ? (
        <div className="py-10 text-center text-zinc-400">
          Chưa có khoản tiết kiệm nào. Hãy thêm khoản đầu tiên.
        </div>
      ) : (
        <table className="min-w-full text-left text-sm text-white">
          <thead>
            <tr className="border-b border-zinc-700 text-zinc-400">
              <th className="whitespace-nowrap p-3">Ngân hàng</th>
              <th className="whitespace-nowrap p-3">Tiền gốc</th>
              <th className="whitespace-nowrap p-3">Lãi suất</th>
              <th className="whitespace-nowrap p-3">Ngày đáo hạn</th>
              <th className="whitespace-nowrap p-3">Còn lại</th>
              <th className="whitespace-nowrap p-3">Lãi dự kiến</th>
              <th className="whitespace-nowrap p-3">
                Lãi hiện tại tạm tính
              </th>
              <th className="whitespace-nowrap p-3">Trạng thái</th>
              <th className="whitespace-nowrap p-3">Thao tác</th>
            </tr>
          </thead>

          <tbody>
            {deposits.map((deposit) => {
              const remaining = getDaysRemaining(deposit.maturity_date)

              const status =
                deposit.status === 'ACTIVE' && remaining < 0
                  ? 'MATURED'
                  : deposit.status

              const currentInterest =
                deposit.status === 'ACTIVE'
                  ? calculateCurrentInterest(deposit)
                  : 0

              return (
                <tr
                  key={deposit.id}
                  className="border-b border-zinc-800 hover:bg-zinc-800/60"
                >
                  <td className="whitespace-nowrap p-3">
                    <div className="font-medium">{deposit.bank_name}</div>
                    <div className="text-xs text-zinc-500">
                      {deposit.deposit_name}
                    </div>
                    {deposit.account_reference && (
                      <div className="text-xs text-zinc-500">
                        Số tham chiếu: {deposit.account_reference}
                      </div>
                    )}
                  </td>

                  <td className="whitespace-nowrap p-3">
                    {formatVND(Number(deposit.principal))}
                  </td>

                  <td className="whitespace-nowrap p-3">
                    {Number(deposit.annual_interest_rate).toLocaleString(
                      'vi-VN'
                    )}
                    %
                  </td>

                  <td className="whitespace-nowrap p-3">
                    {deposit.maturity_date}
                  </td>

                  <td className="whitespace-nowrap p-3">
                    {remaining < 0
                      ? `Quá hạn ${Math.abs(remaining)} ngày`
                      : remaining === 0
                        ? 'Đến hạn hôm nay'
                        : `${remaining} ngày`}
                  </td>

                  <td className="whitespace-nowrap p-3 text-emerald-400">
                    {formatVND(calculateExpectedInterest(deposit))}
                  </td>

                  <td className="whitespace-nowrap p-3">
                    <div className="font-semibold text-sky-400">
                      {formatVND(currentInterest)}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      Lãi đơn ước tính
                    </div>
                  </td>

                  <td className="whitespace-nowrap p-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        status === 'ACTIVE'
                          ? 'bg-emerald-950 text-emerald-400'
                          : status === 'MATURED'
                            ? 'bg-amber-950 text-amber-400'
                            : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {statusLabels[status] ?? status}
                    </span>
                  </td>

                  <td className="whitespace-nowrap p-3">
                    <div className="flex items-center gap-3">
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(deposit)}
                          className="text-blue-400 hover:underline"
                        >
                          Sửa
                        </button>
                      )}

                      {onSettle &&
                        (deposit.status === 'ACTIVE' ||
                          deposit.status === 'MATURED') && (
                          <button
                            type="button"
                            onClick={() => onSettle(deposit)}
                            className="text-emerald-400 hover:underline"
                          >
                            Tất toán
                          </button>
                        )}

                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => void handleDelete(deposit)}
                          className="text-red-400 hover:text-red-300 hover:underline"
                          title="Xóa bản ghi tiết kiệm"
                        >
                          Xóa sổ TK
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <p className="mt-4 text-xs text-zinc-500">
        Lãi hiện tại là giá trị ước tính theo lãi đơn, cơ sở 365 ngày.
        Số tiền thực nhận khi tất toán có thể khác cách tính của ngân hàng.
      </p>
    </div>
  )
}