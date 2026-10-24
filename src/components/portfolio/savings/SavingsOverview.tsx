
'use client'

import type { SavingsDeposit } from '@/lib/savings/types'
import {
  calculateCurrentInterest,
  calculateExpectedInterest,
  formatVND,
} from '@/lib/savings/calculations'

interface SavingsOverviewProps {
  deposits: SavingsDeposit[]
}

export default function SavingsOverview({
  deposits,
}: SavingsOverviewProps) {
  // Chỉ tính các khoản đang gửi hoặc đã đến hạn.
  const eligibleDeposits = deposits.filter(
    (deposit) =>
      deposit.status === 'ACTIVE' ||
      deposit.status === 'MATURED'
  )

  const totalPrincipal = eligibleDeposits.reduce(
    (sum, deposit) => sum + Number(deposit.principal || 0),
    0
  )

  const expectedInterest = eligibleDeposits.reduce(
    (sum, deposit) => sum + calculateExpectedInterest(deposit),
    0
  )

  const currentInterest = eligibleDeposits.reduce(
    (sum, deposit) => sum + calculateCurrentInterest(deposit),
    0
  )

  const activeCount = deposits.filter(
    (deposit) => deposit.status === 'ACTIVE'
  ).length

  const maturedCount = deposits.filter(
    (deposit) =>
      deposit.status === 'MATURED' ||
      (
        deposit.status === 'ACTIVE' &&
        deposit.maturity_date < getTodayString()
      )
  ).length

  const cards = [
    {
      title: 'Tổng tiền gốc',
      value: formatVND(totalPrincipal),
      description: 'Tiền gửi đang hoạt động và đã đến hạn',
      color: 'text-white',
      icon: '💰',
    },
    {
      title: 'Lãi hiện tại tạm tính',
      value: formatVND(currentInterest),
      description: 'Lãi tích lũy ước tính đến hôm nay',
      color: 'text-sky-400',
      icon: '📈',
    },
    {
      title: 'Lãi dự kiến',
      value: formatVND(expectedInterest),
      description: 'Lãi ước tính đến ngày đáo hạn',
      color: 'text-emerald-400',
      icon: '💵',
    },
    {
      title: 'Số sổ đang gửi',
      value: activeCount.toLocaleString('vi-VN'),
      description: `${maturedCount} sổ đã đến hạn`,
      color: 'text-amber-400',
      icon: '🏦',
    },
  ]

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold text-white">
        📊 Tổng quan tiết kiệm
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-zinc-400">
                {card.title}
              </p>

              <span className="text-xl" aria-hidden="true">
                {card.icon}
              </span>
            </div>

            <p
              className={`mt-3 break-words text-xl font-bold ${card.color}`}
            >
              {card.value}
            </p>

            <p className="mt-2 text-xs text-zinc-500">
              {card.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function getTodayString(): string {
  const today = new Date()

  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

