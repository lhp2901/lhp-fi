'use client'

import React, { useMemo } from 'react'

export interface PortfolioItem {
  symbol: string
  probability: number
  recommendation: string
  allocation: number
}

interface Props {
  loading: boolean
  date: string
  sourceDate?: string
  portfolio: PortfolioItem[]
}

type Recommendation = 'BUY' | 'SELL' | 'HOLD' | 'WATCH' | 'UNKNOWN'

const numberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/**
 * Accepts either a fraction (0.72) or percentage (72).
 * Ambiguous values are treated as percentage only when > 1.
 */
const probabilityPercent = (value: unknown): number | null => {
  const n = numberOrNull(value)
  if (n === null) return null
  const percent = n > 1 ? n : n * 100
  return Math.min(100, Math.max(0, percent))
}

/** Allocation is expected as a fraction (0.25 = 25%); also accepts percent values. */
const allocationPercent = (value: unknown): number | null => {
  const n = numberOrNull(value)
  if (n === null) return null
  const percent = n > 1 ? n : n * 100
  return Math.min(100, Math.max(0, percent))
}

const formatDateVN = (dateStr?: string): string => {
  if (!dateStr?.trim()) return '—'
  // Date-only strings are parsed at local noon to avoid UTC date rollover.
  const dateOnly = /^\\d{4}-\\d{2}-\\d{2}$/.test(dateStr)
  const parsed = new Date(dateOnly ? `${dateStr}T12:00:00` : dateStr)
  if (Number.isNaN(parsed.getTime())) return dateStr
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
}

const normalizeRecommendation = (value: unknown): Recommendation => {
  const normalized = String(value ?? '').trim().toUpperCase()
  if (['BUY', 'MUA', 'STRONG_BUY', 'BUY_STRONG'].includes(normalized)) return 'BUY'
  if (['SELL', 'BÁN', 'BAN', 'STRONG_SELL', 'SELL_STRONG'].includes(normalized)) return 'SELL'
  if (['HOLD', 'GIỮ', 'GIU', 'NEUTRAL'].includes(normalized)) return 'HOLD'
  if (['WATCH', 'QUAN SÁT', 'QUAN SAT', 'WAIT'].includes(normalized)) return 'WATCH'
  return 'UNKNOWN'
}

const recommendationMeta: Record<Recommendation, { label: string; tone: string; row: string; dot: string }> = {
  BUY: {
    label: 'MUA',
    tone: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
    row: 'hover:bg-emerald-500/[0.045]',
    dot: 'bg-emerald-400',
  },
  SELL: {
    label: 'BÁN',
    tone: 'border-rose-500/25 bg-rose-500/10 text-rose-300',
    row: 'hover:bg-rose-500/[0.045]',
    dot: 'bg-rose-400',
  },
  HOLD: {
    label: 'GIỮ',
    tone: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
    row: 'hover:bg-amber-500/[0.045]',
    dot: 'bg-amber-400',
  },
  WATCH: {
    label: 'QUAN SÁT',
    tone: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
    row: 'hover:bg-sky-500/[0.045]',
    dot: 'bg-sky-400',
  },
  UNKNOWN: {
    label: 'CHƯA RÕ',
    tone: 'border-slate-500/25 bg-slate-500/10 text-slate-300',
    row: 'hover:bg-white/[0.025]',
    dot: 'bg-slate-400',
  },
}

const formatPercent = (value: number | null, digits = 1) =>
  value === null ? '—' : `${value.toLocaleString('vi-VN', { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`

const formatAllocation = (value: number | null) =>
  value === null ? '—' : `${value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`

function ProbabilityBar({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-xs text-slate-500">Chưa có</span>
  }

  const tone = value >= 70 ? 'bg-emerald-400' : value >= 55 ? 'bg-sky-400' : value >= 45 ? 'bg-amber-400' : 'bg-rose-400'

  return (
    <div className="mx-auto flex min-w-[112px] max-w-[160px] items-center gap-2">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-700/70"
        role="progressbar"
        aria-label="Xác suất mô hình"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <div className={`h-full rounded-full transition-[width] duration-300 ${tone}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-14 text-right tabular-nums text-slate-200">{formatPercent(value, 2)}</span>
    </div>
  )
}

function AllocationBar({ value }: { value: number | null }) {
  if (value === null || value <= 0) return <span className="text-slate-500">—</span>

  const width = Math.min(value, 100)
  return (
    <div className="mx-auto flex min-w-[110px] max-w-[150px] items-center gap-2">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-700/70"
        role="progressbar"
        aria-label="Tỷ trọng phân bổ vốn"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={width}
      >
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400" style={{ width: `${width}%` }} />
      </div>
      <span className="w-12 text-right font-semibold tabular-nums text-emerald-300">{formatAllocation(value)}</span>
    </div>
  )
}

function SkeletonRows() {
  return (
    <div className="space-y-3 p-4" aria-label="Đang tải danh mục">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((cell) => (
            <div key={cell} className="h-10 animate-pulse rounded-lg bg-slate-800/80" />
          ))}
        </div>
      ))}
    </div>
  )
}

export default function PortfolioTable({ loading, date, sourceDate, portfolio }: Props) {
  const rows = useMemo(() => {
    const seen = new Set<string>()

    return (Array.isArray(portfolio) ? portfolio : [])
      .map((item) => {
        const symbol = String(item?.symbol ?? '').trim().toUpperCase()
        const recommendation = normalizeRecommendation(item?.recommendation)
        const probability = probabilityPercent(item?.probability)
        const allocation = allocationPercent(item?.allocation)

        return {
          symbol,
          recommendation,
          probability,
          allocation,
        }
      })
      .filter((item) => {
        if (!item.symbol || seen.has(item.symbol)) return false
        seen.add(item.symbol)
        return true
      })
      .sort((a, b) => {
        const order: Record<Recommendation, number> = { BUY: 0, WATCH: 1, HOLD: 2, SELL: 3, UNKNOWN: 4 }
        return order[a.recommendation] - order[b.recommendation]
          || (b.probability ?? -1) - (a.probability ?? -1)
      })
  }, [portfolio])

  const stats = useMemo(() => {
    const buyCount = rows.filter((row) => row.recommendation === 'BUY').length
    const watchCount = rows.filter((row) => row.recommendation === 'WATCH').length
    const allocationTotal = rows.reduce((sum, row) => sum + (row.allocation ?? 0), 0)
    const probabilityValues = rows
      .filter((row) => row.recommendation === 'BUY' && row.probability !== null)
      .map((row) => row.probability as number)
    const averageBuyProbability = probabilityValues.length
      ? probabilityValues.reduce((sum, value) => sum + value, 0) / probabilityValues.length
      : null

    return { buyCount, watchCount, allocationTotal, averageBuyProbability }
  }, [rows])

  const allocationWarning = stats.allocationTotal > 100.01

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950/70 shadow-[0_18px_60px_-30px_rgba(0,0,0,0.8)]">
      <div className="border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/30 px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-lg">💼</span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/80">LHP · AI Portfolio</p>
                <h2 className="mt-0.5 text-lg font-bold tracking-tight text-white sm:text-xl">Danh mục đầu tư AI đề xuất</h2>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
              <span>Ngày phân tích: <strong className="font-medium text-slate-200">{formatDateVN(date)}</strong></span>
              {sourceDate && (
                <>
                  <span className="hidden text-slate-600 sm:inline">•</span>
                  <span>Dữ liệu nguồn: <strong className="font-medium text-slate-300">{formatDateVN(sourceDate)}</strong></span>
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 px-3 py-2">
              <p className="text-[11px] text-slate-500">Mã đề xuất MUA</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-300">{stats.buyCount}</p>
            </div>
            <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 px-3 py-2">
              <p className="text-[11px] text-slate-500">Mã quan sát</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-sky-300">{stats.watchCount}</p>
            </div>
            <div className="col-span-2 rounded-xl border border-slate-700/70 bg-slate-950/60 px-3 py-2 sm:col-span-1">
              <p className="text-[11px] text-slate-500">Tổng phân bổ</p>
              <p className={`mt-0.5 text-lg font-bold tabular-nums ${allocationWarning ? 'text-amber-300' : 'text-white'}`}>
                {formatAllocation(stats.allocationTotal)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-3xl text-xs leading-5 text-slate-400">
            Danh mục được sắp xếp theo nhóm khuyến nghị. Xác suất là đầu ra mô hình; tỷ trọng vốn là giá trị backend cung cấp, không tự động tái cân bằng tại giao diện.
          </p>
          {stats.averageBuyProbability !== null && (
            <span className="shrink-0 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs text-emerald-200">
              Xác suất MUA trung bình: <strong>{formatPercent(stats.averageBuyProbability, 2)}</strong>
            </span>
          )}
        </div>

        {allocationWarning && !loading && (
          <div className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Lưu ý: tổng tỷ trọng phân bổ đang vượt 100%. Hãy kiểm tra thuật toán phân bổ vốn ở backend.
          </div>
        )}

        {loading ? (
          <SkeletonRows />
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/30 px-5 py-12 text-center">
            <span className="text-2xl">📊</span>
            <p className="mt-3 font-semibold text-slate-200">Chưa có danh mục gợi ý</p>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              Hệ thống chưa trả về mã phù hợp trong ngày phân tích. Có thể tiếp tục theo dõi hoặc kiểm tra dữ liệu đầu vào.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-900/90 text-left text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 font-semibold">Mã cổ phiếu</th>
                  <th className="px-4 py-3 text-center font-semibold">Xác suất mô hình</th>
                  <th className="px-4 py-3 text-center font-semibold">Khuyến nghị</th>
                  <th className="px-4 py-3 text-center font-semibold">Tỷ trọng vốn</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const meta = recommendationMeta[item.recommendation]
                  return (
                    <tr key={item.symbol} className={`border-t border-slate-800/90 transition-colors ${meta.row}`}>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                          <span className="font-bold tracking-wide text-sky-300">{item.symbol}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <ProbabilityBar value={item.probability} />
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide ${meta.tone}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <AllocationBar value={item.allocation} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 border-t border-slate-800 pt-3 text-[11px] leading-5 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>{rows.length} mã trong danh mục · Số liệu được định dạng theo locale Việt Nam</span>
          <span>Thông tin tham khảo, không phải cam kết lợi nhuận hay khuyến nghị đầu tư cá nhân.</span>
        </div>
      </div>
    </section>
  )
}
