
'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

import type { SavingsDeposit } from '@/lib/savings/types'

interface SavingsChartsProps {
  deposits: SavingsDeposit[]
}

interface ChartData {
  id: string
  name: string
  principal: number
  expectedInterest: number
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function formatVND(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCompactVND(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toLocaleString('vi-VN', {
      maximumFractionDigits: 1,
    })} tỷ`
  }

  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('vi-VN', {
      maximumFractionDigits: 1,
    })} triệu`
  }

  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toLocaleString('vi-VN', {
      maximumFractionDigits: 0,
    })} nghìn`
  }

  return value.toLocaleString('vi-VN')
}

function calculateExpectedInterest(
  principal: number,
  annualRate: number,
  startDate: string | null | undefined,
  maturityDate: string | null | undefined,
): number {
  if (
    principal <= 0 ||
    annualRate <= 0 ||
    !startDate ||
    !maturityDate
  ) {
    return 0
  }

  const start = new Date(`${startDate.slice(0, 10)}T00:00:00`)
  const maturity = new Date(`${maturityDate.slice(0, 10)}T00:00:00`)

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(maturity.getTime()) ||
    maturity <= start
  ) {
    return 0
  }

  const days = Math.round(
    (maturity.getTime() - start.getTime()) /
      (24 * 60 * 60 * 1000),
  )

  return (principal * annualRate * days) / (100 * 365)
}

export default function SavingsCharts({
  deposits,
}: SavingsChartsProps) {
  const chartData = useMemo<ChartData[]>(() => {
    return deposits
      .filter((deposit) => {
        const status = String(deposit.status ?? 'ACTIVE').toUpperCase()

        return !['SETTLED', 'CLOSED', 'CANCELLED'].includes(status)
      })
      .map((deposit, index) => {
        const principal = Math.max(0, toNumber(deposit.principal))
        const annualRate = Math.max(
          0,
          toNumber(deposit.annual_interest_rate),
        )

        const name = String(
          deposit.deposit_name ?? deposit.bank_name ?? '',
        ).trim()

        return {
          id: String(deposit.id ?? index),
          name: name || `Khoản tiết kiệm ${index + 1}`,
          principal,
          expectedInterest: calculateExpectedInterest(
            principal,
            annualRate,
            deposit.start_date,
            deposit.maturity_date,
          ),
        }
      })
      .filter((item) => item.principal > 0)
      .sort((a, b) => b.principal - a.principal)
  }, [deposits])

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Tiền gốc và lãi theo từng khoản
        </h2>

        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          So sánh số tiền gốc và lãi dự kiến của từng khoản tiết kiệm.
        </p>
      </div>

      {chartData.length === 0 ? (
        <div className="flex min-h-64 items-center justify-center text-center text-sm text-slate-500 dark:text-slate-400">
          Chưa có khoản tiết kiệm để hiển thị biểu đồ.
        </div>
      ) : (
        <div className="h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{
                top: 12,
                right: 12,
                left: 12,
                bottom: 55,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#94a3b8"
                opacity={0.25}
              />

              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#64748b' }}
                angle={-25}
                textAnchor="end"
                interval={0}
                height={75}
              />

              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={formatCompactVND}
                width={75}
              />

              <Tooltip
                formatter={(value, name) => [
                  formatVND(toNumber(value)),
                  String(name),
                ]}
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                }}
              />

              <Legend />

              <Bar
                dataKey="principal"
                name="Tiền gốc"
                fill="#2563eb"
                radius={[5, 5, 0, 0]}
                maxBarSize={48}
              />

              <Bar
                dataKey="expectedInterest"
                name="Lãi dự kiến"
                fill="#16a34a"
                radius={[5, 5, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

