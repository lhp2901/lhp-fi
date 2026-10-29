'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine,
} from 'recharts'

type Recommendation = 'BUY' | 'SELL' | 'HOLD'

type AIPrediction = {
  symbol?: string
  date?: string
  probability?: number | string | null
  recommendation?: Recommendation | string
  confidence?: number | string | null
  model?: string
  [key: string]: unknown
}

type AnalysisRow = {
  symbol?: string
  date: string
  close?: number | string | null
  open?: number | string | null
  high?: number | string | null
  low?: number | string | null
  volume?: number | string | null
  ma20?: number | string | null
  rsi?: number | string | null
  bb_upper?: number | string | null
  bb_lower?: number | string | null
  foreign_buy_value?: number | string | null
  foreign_sell_value?: number | string | null
  [key: string]: unknown
}

interface Props {
  symbol: string
}

const COLORS = {
  text: '#e5edf7',
  muted: '#8b9bb0',
  border: '#263448',
  grid: '#263448',
  blue: '#60a5fa',
  green: '#34d399',
  red: '#fb7185',
  amber: '#fbbf24',
  violet: '#a78bfa',
  panel: '#0c1420',
}

const numberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(/,/g, ''))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const formatNumber = (value: unknown, digits = 2) => {
  const number = numberOrNull(value)
  if (number === null) return '—'
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(number)
}

const formatPrice = (value: unknown) => formatNumber(value, 2)

const formatDate = (value: unknown) => {
  if (value == null || value === '') return '—'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

const formatDateTime = (value: unknown) => {
  if (value == null || value === '') return '—'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const normalizeProbability = (value: unknown): number | null => {
  const number = numberOrNull(value)
  if (number === null) return null
  // API thường trả xác suất dạng 0..1; hỗ trợ cả 0..100.
  const percent = number <= 1 ? number * 100 : number
  return Math.max(0, Math.min(100, percent))
}

const pctChange = (first: unknown, last: unknown): number | null => {
  const start = numberOrNull(first)
  const end = numberOrNull(last)
  if (start === null || end === null || start === 0) return null
  return ((end - start) / Math.abs(start)) * 100
}

function Panel({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`min-w-0 rounded-2xl border p-4 sm:p-5 ${className}`} style={{ background: COLORS.panel, borderColor: COLORS.border }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold tracking-wide text-slate-100">{title}</h3>
        {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

function MetricCard({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string
  value: string
  detail?: string
  tone?: 'neutral' | 'positive' | 'negative' | 'warning' | 'blue'
}) {
  const color =
    tone === 'positive' ? COLORS.green :
    tone === 'negative' ? COLORS.red :
    tone === 'warning' ? COLORS.amber :
    tone === 'blue' ? COLORS.blue : COLORS.text

  return (
    <div className="rounded-xl border p-3 sm:p-4" style={{ borderColor: COLORS.border, background: '#101b2a' }}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 break-words text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-24 animate-pulse rounded-xl border bg-slate-800/40" style={{ borderColor: COLORS.border }} />
      ))}
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed px-5 py-10 text-center" style={{ borderColor: COLORS.border }}>
      <div className="mb-2 text-2xl">◌</div>
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
    </div>
  )
}

export default function AIAnalysisPanel({ symbol }: Props) {
  const normalizedSymbol = symbol.trim().toUpperCase()
  const [history, setHistory] = useState<AnalysisRow[]>([])
  const [prediction, setPrediction] = useState<AIPrediction | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [predictionLoading, setPredictionLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [predictionError, setPredictionError] = useState('')
  const [predictionUpdatedAt, setPredictionUpdatedAt] = useState<Date | null>(null)

  useEffect(() => {
    if (!normalizedSymbol) {
      setHistory([])
      return
    }

    const controller = new AbortController()
    let active = true

    const loadHistory = async () => {
      setHistoryLoading(true)
      setHistoryError('')

      try {
        const { data, error } = await supabase
          .from('ai_signals')
          .select('*')
          .eq('symbol', normalizedSymbol)
          .order('date', { ascending: true })
          .limit(90)

        if (!active) return
        if (error) throw error

        const rows = (data ?? []) as AnalysisRow[]
        setHistory(rows)
      } catch (error) {
        if (!active) return
        console.error('[AIAnalysisPanel] history fetch failed:', error)
        setHistory([])
        setHistoryError('Không thể tải dữ liệu phân tích lịch sử. Vui lòng thử lại.')
      } finally {
        if (active) setHistoryLoading(false)
      }
    }

    void loadHistory()
    return () => {
      active = false
      controller.abort()
    }
  }, [normalizedSymbol])

  useEffect(() => {
    if (!normalizedSymbol) {
      setPrediction(null)
      return
    }

    const controller = new AbortController()
    let active = true

    const loadPrediction = async () => {
      setPredictionLoading(true)
      setPredictionError('')
      setPrediction(null)

      try {
        const response = await fetch(
          `/api/predict?symbol=${encodeURIComponent(normalizedSymbol)}`,
          { signal: controller.signal, cache: 'no-store' },
        )
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          const message =
            payload && typeof payload.error === 'string'
              ? payload.error
              : `AI server trả về lỗi (${response.status}).`
          throw new Error(message)
        }

        if (!active) return
        setPrediction(payload as AIPrediction)
        setPredictionUpdatedAt(new Date())
      } catch (error) {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return
        console.error('[AIAnalysisPanel] prediction fetch failed:', error)
        setPredictionError(error instanceof Error ? error.message : 'Không thể kết nối AI server.')
      } finally {
        if (active) setPredictionLoading(false)
      }
    }

    void loadPrediction()
    return () => {
      active = false
      controller.abort()
    }
  }, [normalizedSymbol])

  const chartData = useMemo(() => {
    return history.map((row) => ({
      ...row,
      close: numberOrNull(row.close),
      ma20: numberOrNull(row.ma20),
      rsi: numberOrNull(row.rsi),
      bb_upper: numberOrNull(row.bb_upper),
      bb_lower: numberOrNull(row.bb_lower),
      foreign_buy_value: numberOrNull(row.foreign_buy_value) ?? 0,
      foreign_sell_value: numberOrNull(row.foreign_sell_value) ?? 0,
      dateLabel: formatDate(row.date),
    }))
  }, [history])

  const first = chartData[0]
  const last = chartData[chartData.length - 1]
  const change = pctChange(first?.close, last?.close)
  const changeTone = change === null ? 'neutral' : change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral'
  const changeLabel = change === null ? '—' : `${change > 0 ? '+' : ''}${formatNumber(change, 2)}%`

  const rsi = numberOrNull(last?.rsi)
  const rsiTone = rsi === null ? 'neutral' : rsi >= 70 ? 'negative' : rsi <= 30 ? 'positive' : 'blue'
  const rsiText = rsi === null ? 'Chưa có RSI' : rsi >= 70 ? 'Vùng quá mua' : rsi <= 30 ? 'Vùng quá bán' : 'Vùng trung tính'

  const aiProbability = normalizeProbability(prediction?.probability ?? prediction?.confidence)
  const recommendation = String(prediction?.recommendation ?? 'HOLD').toUpperCase()
  const recommendationTone = recommendation === 'BUY' ? 'positive' : recommendation === 'SELL' ? 'negative' : 'warning'
  const recommendationLabel = recommendation === 'BUY' ? 'MUA' : recommendation === 'SELL' ? 'BÁN' : recommendation === 'HOLD' ? 'GIỮ' : recommendation

  const foreignNet = last
    ? (numberOrNull(last.foreign_buy_value) ?? 0) - (numberOrNull(last.foreign_sell_value) ?? 0)
    : null

  const signalText = useMemo(() => {
    if (rsi === null || numberOrNull(last?.close) === null || numberOrNull(last?.ma20) === null) {
      return 'Chưa đủ dữ liệu chỉ báo để tạo nhận định kỹ thuật.'
    }

    const close = numberOrNull(last?.close) as number
    const ma20 = numberOrNull(last?.ma20) as number

    if (rsi <= 30 && close < ma20) return 'RSI ở vùng quá bán và giá dưới MA20: có thể xuất hiện nhịp hồi kỹ thuật, nhưng cần xác nhận bằng thanh khoản và hành động giá.'
    if (rsi >= 70 && close > ma20) return 'RSI ở vùng quá mua và giá trên MA20: xu hướng có thể mạnh nhưng rủi ro điều chỉnh ngắn hạn tăng.'
    if (close > ma20 && rsi >= 50) return 'Giá đang trên MA20, RSI duy trì trên 50: động lượng ngắn hạn nghiêng tích cực.'
    if (close < ma20 && rsi < 50) return 'Giá dưới MA20, RSI dưới 50: động lượng ngắn hạn nghiêng tiêu cực.'
    return 'Các tín hiệu chưa đồng thuận rõ ràng. Nên chờ xác nhận thêm thay vì chỉ dựa vào một chỉ báo.'
  }, [last, rsi])

  return (
    <div className="space-y-5 text-slate-100">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">LHP • Intelligence</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">AI phân tích cổ phiếu <span className="text-sky-400">{normalizedSymbol || '—'}</span></h2>
          <p className="mt-1 text-sm text-slate-400">Tổng hợp tín hiệu mô hình, chỉ báo kỹ thuật và dữ liệu dòng tiền.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className={`h-2 w-2 rounded-full ${predictionLoading || historyLoading ? 'animate-pulse bg-amber-400' : predictionError || historyError ? 'bg-rose-400' : 'bg-emerald-400'}`} />
          {predictionLoading || historyLoading ? 'Đang đồng bộ dữ liệu' : predictionError || historyError ? 'Có lỗi dữ liệu' : 'Đã cập nhật'}
        </div>
      </header>

      {(historyError || predictionError) && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {historyError || predictionError}
          {historyError && predictionError && <p className="mt-1">{predictionError}</p>}
        </div>
      )}

      {historyLoading && history.length === 0 ? (
        <LoadingSkeleton />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Giá gần nhất"
            value={formatPrice(last?.close)}
            detail={last?.date ? `Ngày ${formatDateTime(last.date)}` : 'Chưa có dữ liệu'}
            tone="blue"
          />
          <MetricCard
            label="Biến động trong kỳ"
            value={changeLabel}
            detail={first && last ? `${formatPrice(first.close)} → ${formatPrice(last.close)}` : 'Không đủ dữ liệu'}
            tone={changeTone}
          />
          <MetricCard
            label="RSI (backend)"
            value={rsi === null ? '—' : formatNumber(rsi, 2)}
            detail={rsiText}
            tone={rsiTone}
          />
          <MetricCard
            label="Dòng tiền ngoại ròng"
            value={foreignNet === null ? '—' : formatNumber(foreignNet, 0)}
            detail="Mua vào − bán ra • phiên gần nhất"
            tone={foreignNet === null ? 'neutral' : foreignNet > 0 ? 'positive' : foreignNet < 0 ? 'negative' : 'neutral'}
          />
        </div>
      )}

      <Panel
        title="Tín hiệu mô hình AI"
        subtitle="Xác suất là đầu ra của mô hình API; không đồng nghĩa với xác suất lợi nhuận chắc chắn."
      >
        {predictionLoading ? (
          <div className="flex items-center gap-3 py-4 text-sm text-slate-400">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
            AI đang phân tích mã {normalizedSymbol}…
          </div>
        ) : prediction ? (
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${
                  recommendation === 'BUY' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' :
                  recommendation === 'SELL' ? 'border-rose-400/30 bg-rose-400/10 text-rose-300' :
                  'border-amber-400/30 bg-amber-400/10 text-amber-300'
                }`}>{recommendationLabel}</span>
                <span className="text-sm text-slate-400">Ngày dự báo: {formatDateTime(prediction.date)}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {recommendation === 'BUY' ? 'Mô hình đang nghiêng về kịch bản tích cực.' :
                 recommendation === 'SELL' ? 'Mô hình đang nghiêng về kịch bản tiêu cực.' :
                 'Mô hình chưa đưa ra lợi thế rõ ràng giữa hai phía.'}
                {' '}Hãy đối chiếu thêm xu hướng giá, thanh khoản và mức quản trị rủi ro.
              </p>
              {prediction.model && <p className="mt-2 text-xs text-slate-500">Mô hình: {prediction.model}</p>}
            </div>
            <div className="min-w-40 rounded-xl border p-4 text-center" style={{ borderColor: COLORS.border, background: '#101b2a' }}>
              <p className="text-xs uppercase tracking-wider text-slate-400">Xác suất / độ tin cậy</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-sky-300">
                {aiProbability === null ? '—' : `${formatNumber(aiProbability, 2)}%`}
              </p>
              {aiProbability !== null && (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-700">
                  <div className="h-full rounded-full bg-sky-400" style={{ width: `${aiProbability}%` }} />
                </div>
              )}
              <p className="mt-2 text-[11px] text-slate-500">Cập nhật {predictionUpdatedAt?.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) ?? '—'}</p>
            </div>
          </div>
        ) : (
          <EmptyState title="Chưa có dự báo AI" description={predictionError || 'API chưa trả về dự báo cho mã này.'} />
        )}
      </Panel>

      {historyLoading && history.length === 0 ? null : history.length === 0 ? (
        <Panel title="Dữ liệu lịch sử">
          <EmptyState title="Chưa có dữ liệu lịch sử" description="Bảng ai_signals chưa có bản ghi phù hợp với mã cổ phiếu này." />
        </Panel>
      ) : (
        <>
          <Panel title="Phân tích kỹ thuật" subtitle="Nhận định dưới đây được suy ra từ các trường chỉ báo đã lưu trong ai_signals.">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-lg bg-sky-400/10 px-2 py-1 text-sky-300">✦</span>
              <p className="text-sm leading-6 text-slate-300">{signalText}</p>
            </div>
            <p className="mt-3 border-t pt-3 text-xs leading-5 text-slate-500" style={{ borderColor: COLORS.border }}>
              Lưu ý: MA20, RSI và Bollinger Bands được hiển thị theo dữ liệu backend. Component không tự tái tính chỉ báo khi thiếu dữ liệu OHLC đầy đủ, nhằm tránh tạo ra kết quả khác với pipeline nguồn.
            </p>
          </Panel>

          <div className="grid gap-5 xl:grid-cols-2">
            <Panel title="Giá, MA20 & Bollinger Bands" subtitle="Diễn biến giá đóng cửa và các vùng tham chiếu kỹ thuật.">
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="dateLabel" tick={{ fill: COLORS.muted, fontSize: 11 }} minTickGap={24} />
                    <YAxis tick={{ fill: COLORS.muted, fontSize: 11 }} tickFormatter={(value) => formatNumber(value, 0)} domain={['auto', 'auto']} width={66} />
                    <Tooltip
                      contentStyle={{ background: '#0b1220', border: `1px solid ${COLORS.border}`, borderRadius: 12, color: COLORS.text }}
                      labelStyle={{ color: COLORS.muted }}
                      formatter={(value: unknown, name: string) => [formatPrice(value), name]}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.date ? formatDateTime(payload[0].payload.date) : ''}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: COLORS.muted }} />
                    <Line type="monotone" dataKey="close" stroke={COLORS.blue} strokeWidth={2.2} dot={false} connectNulls name="Close" />
                    <Line type="monotone" dataKey="ma20" stroke={COLORS.green} strokeWidth={1.7} dot={false} connectNulls name="MA20" />
                    <Line type="monotone" dataKey="bb_upper" stroke={COLORS.amber} strokeWidth={1.3} strokeDasharray="5 4" dot={false} connectNulls name="BB Upper" />
                    <Line type="monotone" dataKey="bb_lower" stroke={COLORS.amber} strokeWidth={1.3} strokeDasharray="5 4" dot={false} connectNulls name="BB Lower" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Dòng tiền khối ngoại" subtitle="Giá trị mua/bán ngoại theo từng bản ghi lịch sử.">
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="dateLabel" tick={{ fill: COLORS.muted, fontSize: 11 }} minTickGap={24} />
                    <YAxis tick={{ fill: COLORS.muted, fontSize: 11 }} tickFormatter={(value) => formatNumber(value, 0)} width={66} />
                    <Tooltip
                      contentStyle={{ background: '#0b1220', border: `1px solid ${COLORS.border}`, borderRadius: 12, color: COLORS.text }}
                      formatter={(value: unknown, name: string) => [formatNumber(value, 0), name]}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.date ? formatDateTime(payload[0].payload.date) : ''}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: COLORS.muted }} />
                    <Bar dataKey="foreign_buy_value" fill={COLORS.green} name="Mua" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="foreign_sell_value" fill={COLORS.red} name="Bán" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <Panel title="RSI — Relative Strength Index" subtitle="RSI theo backend, thang đo 0–100. Mốc 30/70 là vùng tham khảo phổ biến, không phải tín hiệu mua/bán độc lập.">
            <div className="h-[230px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="dateLabel" tick={{ fill: COLORS.muted, fontSize: 11 }} minTickGap={24} />
                  <YAxis domain={[0, 100]} ticks={[0, 30, 50, 70, 100]} tick={{ fill: COLORS.muted, fontSize: 11 }} width={42} />
                  <Tooltip
                    contentStyle={{ background: '#0b1220', border: `1px solid ${COLORS.border}`, borderRadius: 12, color: COLORS.text }}
                    formatter={(value: unknown) => [value == null ? '—' : `${formatNumber(value, 2)}`, 'RSI']}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.date ? formatDateTime(payload[0].payload.date) : ''}
                  />
                  <ReferenceLine y={70} stroke={COLORS.red} strokeDasharray="5 4" />
                  <ReferenceLine y={50} stroke={COLORS.muted} strokeDasharray="3 5" />
                  <ReferenceLine y={30} stroke={COLORS.green} strokeDasharray="5 4" />
                  <Line type="monotone" dataKey="rsi" stroke={COLORS.violet} strokeWidth={2} dot={false} connectNulls name="RSI" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </>
      )}

      <footer className="text-[11px] leading-5 text-slate-500">
        Thông tin chỉ mang tính tham khảo, không phải khuyến nghị đầu tư. Xác suất mô hình không đảm bảo kết quả giao dịch; cần kiểm định hiệu quả dự báo, tính phí/thuế và quản trị rủi ro trước khi sử dụng thực tế.
      </footer>
    </div>
  )
}
