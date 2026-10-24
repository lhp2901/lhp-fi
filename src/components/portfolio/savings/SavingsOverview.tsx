'use client'

import {
Banknote,
PiggyBank,
TrendingUp,
Wallet,
CalendarDays,
Clock3,
Landmark,
} from 'lucide-react'

import type { SavingsDeposit } from '@/lib/savings/types'

interface SavingsOverviewProps {
deposits: SavingsDeposit[]
}

interface DepositInterest {
principal: number
accruedInterest: number
expectedInterest: number
estimatedTotal: number
daysElapsed: number
totalDays: number
isActive: boolean
}

function toNumber(value: unknown): number {
const number = Number(value)
return Number.isFinite(number) ? number : 0
}

function parseDate(value: unknown): Date | null {
if (typeof value !== 'string' || !value.trim()) {
return null
}

// Tránh lỗi lệch ngày do múi giờ khi dữ liệu có dạng YYYY-MM-DD.
const dateString = value.slice(0, 10)
const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString)

if (match) {
const year = Number(match[1])
const month = Number(match[2])
const day = Number(match[3])
const date = new Date(year, month - 1, day)


if (
  date.getFullYear() !== year ||
  date.getMonth() !== month - 1 ||
  date.getDate() !== day
) {
  return null
}

date.setHours(0, 0, 0, 0)
return date


}

const date = new Date(value as string)

if (Number.isNaN(date.getTime())) {
return null
}

date.setHours(0, 0, 0, 0)
return date
}

function daysBetween(start: Date, end: Date): number {
const millisecondsPerDay = 24 * 60 * 60 * 1000

return Math.max(
0,
Math.round((end.getTime() - start.getTime()) / millisecondsPerDay),
)
}

function formatVND(value: number): string {
return new Intl.NumberFormat('vi-VN', {
style: 'currency',
currency: 'VND',
maximumFractionDigits: 0,
}).format(Number.isFinite(value) ? value : 0)
}

function formatDate(value: unknown): string {
const date = parseDate(value)

if (!date) {
return 'Chưa xác định'
}

return new Intl.DateTimeFormat('vi-VN').format(date)
}

function calculateDeposit(
deposit: SavingsDeposit,
today: Date,
): DepositInterest {
const principal = Math.max(0, toNumber(deposit.principal))
const annualRate = Math.max(
0,
toNumber(deposit.annual_interest_rate),
)

const startDate = parseDate(deposit.start_date)
const maturityDate = parseDate(deposit.maturity_date)

const status = String(deposit.status ?? 'ACTIVE').toUpperCase()
const isActive = status === 'ACTIVE'

if (!startDate || !maturityDate || maturityDate < startDate) {
return {
principal,
accruedInterest: 0,
expectedInterest: 0,
estimatedTotal: principal,
daysElapsed: 0,
totalDays: 0,
isActive,
}
}

const totalDays = daysBetween(startDate, maturityDate)

// Tiền lãi bắt đầu tính từ ngày gửi, không tính trước ngày gửi.
const effectiveToday = today < startDate
? startDate
: today > maturityDate
? maturityDate
: today

const daysElapsed = daysBetween(startDate, effectiveToday)

// Công thức lãi đơn ước tính: gốc × lãi suất năm × số ngày / 365.
const expectedInterest =
(principal * (annualRate / 100) * totalDays) / 365

const accruedInterest =
(principal * (annualRate / 100) * daysElapsed) / 365

return {
principal,
accruedInterest,
expectedInterest,
estimatedTotal: principal + expectedInterest,
daysElapsed,
totalDays,
isActive,
}
}

function StatCard({
title,
value,
description,
icon: Icon,
accent,
}: {
title: string
value: string
description: string
icon: typeof Wallet
accent: 'blue' | 'green' | 'amber' | 'purple'
}) {
const accents = {
blue: {
icon: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
border: 'border-blue-200 dark:border-blue-900/60',
},
green: {
icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
border: 'border-emerald-200 dark:border-emerald-900/60',
},
amber: {
icon: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
border: 'border-amber-200 dark:border-amber-900/60',
},
purple: {
icon: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
border: 'border-purple-200 dark:border-purple-900/60',
},
}

const color = accents[accent]

return (
<div
className={`rounded-2xl border ${color.border} bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-900`}
> <div className="flex items-start justify-between gap-3"> <div className="min-w-0"> <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
{title} </p>


      <p className="mt-2 break-words text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
        {value}
      </p>
    </div>

    <div className={`rounded-xl p-3 ${color.icon}`}>
      <Icon className="h-5 w-5" aria-hidden="true" />
    </div>
  </div>

  <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
    {description}
  </p>
</div>


)
}

export default function SavingsOverview({
deposits,
}: SavingsOverviewProps) {
const today = new Date()
today.setHours(0, 0, 0, 0)

const calculatedDeposits = deposits.map((deposit) => ({
deposit,
interest: calculateDeposit(deposit, today),
}))

const activeDeposits = calculatedDeposits.filter(
({ interest }) => interest.isActive,
)

const totalActivePrincipal = activeDeposits.reduce(
(total, item) => total + item.interest.principal,
0,
)

const totalAccruedInterest = activeDeposits.reduce(
(total, item) => total + item.interest.accruedInterest,
0,
)

const totalExpectedInterest = activeDeposits.reduce(
(total, item) => total + item.interest.expectedInterest,
0,
)

const estimatedMaturityValue =
totalActivePrincipal + totalExpectedInterest

const maturedDeposits = activeDeposits.filter(({ deposit }) => {
const maturityDate = parseDate(deposit.maturity_date)
return maturityDate !== null && maturityDate <= today
})

const upcomingDeposits = activeDeposits.filter(({ deposit }) => {
const maturityDate = parseDate(deposit.maturity_date)
return maturityDate !== null && maturityDate > today
})

const nextMaturity = upcomingDeposits
.map(({ deposit }) => ({
deposit,
date: parseDate(deposit.maturity_date),
}))
.filter(
(item): item is { deposit: SavingsDeposit; date: Date } =>
item.date !== null,
)
.sort((a, b) => a.date.getTime() - b.date.getTime())[0]

const maturityInDays = nextMaturity
? daysBetween(today, nextMaturity.date)
: null

return ( <section className="space-y-5"> 

  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <StatCard
      title="Tổng tiền gốc đang gửi"
      value={formatVND(totalActivePrincipal)}
      description={`${activeDeposits.length} khoản tiết kiệm đang hoạt động`}
      icon={Landmark}
      accent="blue"
    />

    <StatCard
      title="Lãi tạm tính đến hôm nay"
      value={formatVND(totalAccruedInterest)}
      description="Lãi ước tính theo số ngày đã gửi"
      icon={TrendingUp}
      accent="green"
    />

    <StatCard
      title="Tổng lãi dự kiến"
      value={formatVND(totalExpectedInterest)}
      description="Lãi ước tính đến ngày đáo hạn của các khoản đang hoạt động"
      icon={PiggyBank}
      accent="amber"
    />

    <StatCard
      title="Gốc + lãi dự kiến"
      value={formatVND(estimatedMaturityValue)}
      description="Giá trị ước tính nếu giữ các khoản đến hết kỳ hạn"
      icon={Wallet}
      accent="purple"
    />
  </div>

  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="rounded-lg bg-blue-100 p-2.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
        <Banknote className="h-5 w-5" aria-hidden="true" />
      </div>

      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Tổng số khoản
        </p>
        <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
          {deposits.length}
        </p>
      </div>
    </div>

    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="rounded-lg bg-emerald-100 p-2.5 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        <Clock3 className="h-5 w-5" aria-hidden="true" />
      </div>

      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Sắp đến hạn
        </p>
        <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
          {upcomingDeposits.length}
        </p>
      </div>
    </div>

    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="rounded-lg bg-amber-100 p-2.5 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
        <CalendarDays className="h-5 w-5" aria-hidden="true" />
      </div>

      <div className="min-w-0">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Ngày đáo hạn gần nhất
        </p>

        {nextMaturity && maturityInDays !== null ? (
          <>
            <p className="mt-1 truncate text-lg font-bold text-slate-900 dark:text-white">
              {formatDate(nextMaturity.deposit.maturity_date)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {maturityInDays === 0
                ? 'Đến hạn hôm nay'
                : `Còn ${maturityInDays} ngày`}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-300">
            Không có khoản sắp đáo hạn
          </p>
        )}
      </div>
    </div>
  </div>

  {maturedDeposits.length > 0 && (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
      Có <strong>{maturedDeposits.length}</strong> khoản đã đến hoặc quá
      ngày đáo hạn. Lãi tạm tính được giới hạn đến ngày đáo hạn; hãy kiểm
      tra số tiền thực nhận với ngân hàng.
    </div>
  )}

  <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
    Lưu ý: Lãi được tính theo công thức lãi đơn ước tính
    {' '}= tiền gốc × lãi suất năm × số ngày / 365. Đây không phải số dư
    ngân hàng xác nhận. Tiền lãi thực tế có thể khác tùy phương thức trả
    lãi, quy ước tính ngày, thuế/phí và điều kiện của từng ngân hàng.
  </p>
</section>


)
}
