'use client'

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts'

import type { SavingsDeposit } from '@/lib/savings/types'
import { formatVND } from '@/lib/savings/calculations'

interface SavingsChartsProps {
  deposits: SavingsDeposit[]
}

const COLORS = [
  '#10b981',
  '#3b82f6',
  '#f59e0b',
  '#a855f7',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
]

export default function SavingsCharts({
  deposits,
}: SavingsChartsProps) {
  // Chỉ thống kê các khoản đang gửi hoặc đã đến hạn.
  const eligibleDeposits = deposits.filter(
    (deposit) =>
      deposit.status === 'ACTIVE' ||
      deposit.status === 'MATURED'
  )

  // Chuẩn hóa tên để tránh BIDV, bidv và "BIDV " bị tách thành nhiều dòng.
  // Dùng tên đã chuẩn hóa làm khóa nhóm.
  const bankTotals = new Map<
    string,
    {
      name: string
      value: number
    }
  >()

  for (const deposit of eligibleDeposits) {
    const rawName = String(deposit.bank_name ?? '').trim()
    const bankName = rawName || 'Chưa xác định'

    const normalizedKey = bankName
      .normalize('NFC')
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase('vi-VN')

    const principal = Number(deposit.principal)

    // Bỏ qua số tiền không hợp lệ hoặc âm.
    if (!Number.isFinite(principal) || principal < 0) {
      continue
    }

    const existing = bankTotals.get(normalizedKey)

    if (existing) {
      existing.value += principal
    } else {
      bankTotals.set(normalizedKey, {
        name: bankName.replace(/\s+/g, ' '),
        value: principal,
      })
    }
  }

  // Mỗi ngân hàng chỉ có một phần tử trong dữ liệu biểu đồ.
  const chartData = Array.from(bankTotals.values())
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)

  // Tính tổng một lần để dùng cho tất cả tỷ lệ.
  const totalPrincipal = chartData.reduce(
    (sum, item) => sum + item.value,
    0
  )

  return (
    <section className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-4 text-lg font-bold text-white">
        📊 Phân bổ tiền gửi theo ngân hàng
      </h2>

      {chartData.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={false}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`bank-${entry.name}-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>

              <Tooltip
                formatter={(value) =>
                  formatVND(Number(value ?? 0))
                }
                contentStyle={{
                  backgroundColor: '#18181b',
                  border: '1px solid #3f3f46',
                  borderRadius: '8px',
                  color: '#fff',
                }}
                itemStyle={{
                  color: '#fff',
                }}
                labelStyle={{
                  color: '#fff',
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="mt-4 space-y-4">
            {chartData.map((item, index) => {
              const percentage =
                totalPrincipal > 0
                  ? (item.value / totalPrincipal) * 100
                  : 0

              return (
                <div
                  key={`legend-${item.name
                    .normalize('NFC')
                    .replace(/\s+/g, ' ')
                    .toLocaleLowerCase('vi-VN')}`}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            COLORS[index % COLORS.length],
                        }}
                      />

                      <span className="truncate text-sm text-zinc-300">
                        {item.name}
                      </span>
                    </div>

                    <span className="whitespace-nowrap text-sm font-medium text-white">
                      {formatVND(item.value)}
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor:
                          COLORS[index % COLORS.length],
                      }}
                    />
                  </div>

                  <p className="text-right text-xs text-zinc-500">
                    {percentage.toLocaleString('vi-VN', {
                      maximumFractionDigits: 2,
                    })}
                    %
                  </p>
                </div>
              )
            })}
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-4">
            <span className="text-sm text-zinc-400">
              Tổng tiền gửi
            </span>

            <span className="text-base font-bold text-emerald-400">
              {formatVND(totalPrincipal)}
            </span>
          </div>
        </>
      ) : (
        <div className="flex h-[280px] items-center justify-center text-center text-sm text-zinc-500">
          Chưa có dữ liệu tiền gửi để hiển thị biểu đồ.
        </div>
      )}
    </section>
  )
}
