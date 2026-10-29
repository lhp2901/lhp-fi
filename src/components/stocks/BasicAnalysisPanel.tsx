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
  BarChart,
  Bar,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

type StockEntry = {
  id?: string | number
  symbol: string
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  ref_price?: number | null
  foreign_buy_value?: number | null
  foreign_sell_value?: number | null
}

type AnalysisRow = StockEntry & {
  ma20: number | null
  upperBB: number | null
  lowerBB: number | null
  rsi: number | null
  ema20: number | null
  ema50: number | null
  macd: number | null
  macdSignal: number | null
  macdHistogram: number | null
  atr14: number | null
  trendScore: number | null
  avgVolume: number
  limitUp: number | null
  limitDown: number | null
  isBullReversal: boolean
  isBearReversal: boolean
  isBreakout: boolean
  isBreakdown: boolean
  isHammer: boolean
  isShootingStar: boolean
  isDeadlyBreakout: boolean
  isTrapBreakdown: boolean
  volumeSpike: boolean
  foreignBuySpike: boolean
}

type Tab = 'recent' | 'reversal'

const numberOr = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const formatNumber = (value: number | null | undefined, digits = 2) => {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString('vi-VN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits === 0 ? 0 : 0,
  })
}

const formatDate = (value: string) => {
  if (!value) return '—'
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('vi-VN')
}

const safePercent = (current: number, base: number) =>
  base !== 0 ? ((current - base) / base) * 100 : 0

function emaSeries(values: number[], period: number): Array<number | null> {
  const result: Array<number | null> = Array(values.length).fill(null)
  if (values.length < period) return result

  const multiplier = 2 / (period + 1)
  let ema = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period
  result[period - 1] = ema

  for (let i = period; i < values.length; i += 1) {
    ema = values[i] * multiplier + ema * (1 - multiplier)
    result[i] = ema
  }
  return result
}

/** RSI chuẩn Wilder: khởi tạo bằng SMA 14 thay đổi giá, sau đó làm mượt RMA. */
function rsiSeries(closes: number[], period = 14): Array<number | null> {
  const result: Array<number | null> = Array(closes.length).fill(null)
  if (closes.length <= period) return result

  let gainSum = 0
  let lossSum = 0
  for (let i = 1; i <= period; i += 1) {
    const change = closes[i] - closes[i - 1]
    gainSum += Math.max(change, 0)
    lossSum += Math.max(-change, 0)
  }

  let averageGain = gainSum / period
  let averageLoss = lossSum / period
  const value = () => {
    if (averageLoss === 0) return averageGain === 0 ? 50 : 100
    if (averageGain === 0) return 0
    const rs = averageGain / averageLoss
    return 100 - 100 / (1 + rs)
  }
  result[period] = value()

  for (let i = period + 1; i < closes.length; i += 1) {
    const change = closes[i] - closes[i - 1]
    averageGain = (averageGain * (period - 1) + Math.max(change, 0)) / period
    averageLoss = (averageLoss * (period - 1) + Math.max(-change, 0)) / period
    result[i] = value()
  }
  return result
}

function atrSeries(data: StockEntry[], period = 14): Array<number | null> {
  const result: Array<number | null> = Array(data.length).fill(null)
  if (data.length <= period) return result

  const trueRanges = data.map((row, index) => {
    const high = numberOr(row.high)
    const low = numberOr(row.low)
    if (index === 0) return high - low
    const previousClose = numberOr(data[index - 1].close)
    return Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose))
  })

  let atr = trueRanges.slice(1, period + 1).reduce((sum, value) => sum + value, 0) / period
  result[period] = atr
  for (let i = period + 1; i < data.length; i += 1) {
    atr = (atr * (period - 1) + trueRanges[i]) / period
    result[i] = atr
  }
  return result
}

function analyzeEntries(entries: StockEntry[]): AnalysisRow[] {
  const data = [...entries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )
  const closes = data.map((row) => numberOr(row.close))
  const ema20Series = emaSeries(closes, 20)
  const ema50Series = emaSeries(closes, 50)
  const rsiValues = rsiSeries(closes, 14)
  const ema12 = emaSeries(closes, 12)
  const ema26 = emaSeries(closes, 26)
  const macdValues = closes.map((_, index) =>
    ema12[index] != null && ema26[index] != null
      ? (ema12[index] as number) - (ema26[index] as number)
      : 0,
  )
  const macdLine: Array<number | null> = closes.map((_, index) =>
    ema12[index] != null && ema26[index] != null ? macdValues[index] : null,
  )
  // MACD Signal chỉ khởi tạo sau khi MACD có đủ 9 điểm hợp lệ.
  const firstMacdIndex = macdLine.findIndex((value) => value != null)
  const macdSignal: Array<number | null> = Array(data.length).fill(null)
  if (firstMacdIndex >= 0) {
    const validMacd = macdLine
      .slice(firstMacdIndex)
      .filter((value): value is number => value != null)
    const validSignal = emaSeries(validMacd, 9)
    validSignal.forEach((value, offset) => {
      macdSignal[firstMacdIndex + offset] = value
    })
  }
  const atrValues = atrSeries(data, 14)

  return data.map((item, index) => {
    const currentClose = numberOr(item.close)
    const window = data.slice(Math.max(0, index - 19), index + 1)
    const closesWindow = window.map((row) => numberOr(row.close))
    const volumes = window.map((row) => numberOr(row.volume))
    const ma20 = closesWindow.length
      ? closesWindow.reduce((sum, value) => sum + value, 0) / closesWindow.length
      : null
    const avgVolume = volumes.length
      ? volumes.reduce((sum, value) => sum + value, 0) / volumes.length
      : 0
    const deviation = ma20 == null
      ? 0
      : Math.sqrt(
          closesWindow.reduce((sum, value) => sum + (value - ma20) ** 2, 0) /
            closesWindow.length,
        )
    const upperBB = ma20 == null ? null : ma20 + 2 * deviation
    const lowerBB = ma20 == null ? null : ma20 - 2 * deviation
    const rsi = rsiValues[index]
    const ema20 = ema20Series[index]
    const ema50 = ema50Series[index]
    const macd = macdLine[index]
    const signal = macdSignal[index]
    const histogram = macd != null && signal != null ? macd - signal : null
    const atr14 = atrValues[index]

    // So sánh với 20 phiên trước, không đưa chính cây nến hiện tại vào đỉnh/đáy.
    const previousWindow = data.slice(Math.max(0, index - 20), index)
    const priorHigh = previousWindow.length
      ? Math.max(...previousWindow.map((row) => numberOr(row.high)))
      : null
    const priorLow = previousWindow.length
      ? Math.min(...previousWindow.map((row) => numberOr(row.low)))
      : null

    const volume = numberOr(item.volume)
    const isBreakout =
      index >= 20 &&
      priorHigh != null &&
      currentClose > priorHigh * 1.01 &&
      volume > avgVolume * 1.5 &&
      rsi != null &&
      rsi > 55 &&
      ma20 != null &&
      currentClose > ma20 &&
      upperBB != null &&
      currentClose > upperBB

    const isBreakdown =
      index >= 20 &&
      priorLow != null &&
      currentClose < priorLow * 0.99 &&
      volume > avgVolume * 1.5 &&
      rsi != null &&
      rsi < 35 &&
      ma20 != null &&
      currentClose < ma20 &&
      lowerBB != null &&
      currentClose < lowerBB

    const body = Math.abs(numberOr(item.close) - numberOr(item.open))
    const safeBody = Math.max(body, currentClose * 0.0001, 0.000001)
    const upperShadow = Math.max(
      0,
      numberOr(item.high) - Math.max(numberOr(item.open), numberOr(item.close)),
    )
    const lowerShadow = Math.max(
      0,
      Math.min(numberOr(item.open), numberOr(item.close)) - numberOr(item.low),
    )
    const isHammer =
      lowerShadow > safeBody * 2 &&
      upperShadow < safeBody * 0.5 &&
      numberOr(item.close) > numberOr(item.open)
    const isShootingStar =
      upperShadow > safeBody * 2 &&
      lowerShadow < safeBody * 0.5 &&
      numberOr(item.close) < numberOr(item.open)

    const ref = numberOr(item.ref_price, currentClose)
    const limitUp = ref > 0 ? ref * 1.07 : null
    const limitDown = ref > 0 ? ref * 0.93 : null
    const isBullReversal =
      limitDown != null &&
      numberOr(item.low) <= limitDown &&
      currentClose > numberOr(item.open) &&
      volume > avgVolume * 2
    const isBearReversal =
      limitUp != null &&
      numberOr(item.high) >= limitUp &&
      currentClose < numberOr(item.open) &&
      volume > avgVolume * 2

    const priorVolumes = data.slice(Math.max(0, index - 5), index).map((row) => numberOr(row.volume))
    const priorForeignBuys = data.slice(Math.max(0, index - 5), index).map((row) => numberOr(row.foreign_buy_value))
    const avgPriorVolume = priorVolumes.length
      ? priorVolumes.reduce((sum, value) => sum + value, 0) / priorVolumes.length
      : 0
    const avgPriorForeignBuy = priorForeignBuys.length
      ? priorForeignBuys.reduce((sum, value) => sum + value, 0) / priorForeignBuys.length
      : 0
    const foreignBuy = numberOr(item.foreign_buy_value)

    // Composite score: mỗi thành phần có trọng số 1, chỉ chấm khi dữ liệu thành phần đã sẵn sàng.
    let score = 0
    let scoreParts = 0
    if (ema20 != null) {
      score += currentClose > ema20 ? 1 : currentClose < ema20 ? -1 : 0
      scoreParts += 1
    }
    if (ema20 != null && ema50 != null) {
      score += ema20 > ema50 ? 1 : ema20 < ema50 ? -1 : 0
      scoreParts += 1
    }
    if (histogram != null) {
      score += histogram > 0 ? 1 : histogram < 0 ? -1 : 0
      scoreParts += 1
    }
    if (rsi != null) {
      score += rsi > 55 ? 1 : rsi < 45 ? -1 : 0
      scoreParts += 1
    }
    const trendScore = scoreParts === 4 ? score : null

    return {
      ...item,
      open: numberOr(item.open),
      high: numberOr(item.high),
      low: numberOr(item.low),
      close: currentClose,
      volume,
      foreign_buy_value: foreignBuy,
      foreign_sell_value: numberOr(item.foreign_sell_value),
      ma20,
      upperBB,
      lowerBB,
      rsi,
      ema20,
      ema50,
      macd,
      macdSignal: signal,
      macdHistogram: histogram,
      atr14,
      trendScore,
      avgVolume,
      limitUp,
      limitDown,
      isBreakout,
      isBreakdown,
      isHammer,
      isShootingStar,
      isDeadlyBreakout: isBreakout && isHammer,
      isTrapBreakdown: isBreakdown && isShootingStar,
      isBullReversal,
      isBearReversal,
      volumeSpike: index >= 5 && avgPriorVolume > 0 && volume > avgPriorVolume * 2,
      foreignBuySpike:
        index >= 5 &&
        avgPriorForeignBuy > 0 &&
        foreignBuy > avgPriorForeignBuy * 2,
    }
  })
}

function getSignal(row: AnalysisRow) {
  if (row.isDeadlyBreakout) return 'Breakout + Hammer'
  if (row.isTrapBreakdown) return 'Breakdown + Shooting Star'
  if (row.isBreakout) return 'Breakout xác nhận'
  if (row.isBreakdown) return 'Breakdown cảnh báo'
  if (row.isHammer) return 'Hammer'
  if (row.isShootingStar) return 'Shooting Star'
  if (row.isBullReversal) return 'Rũ bỏ / đảo chiều'
  if (row.isBearReversal) return 'Bẫy tăng / đảo chiều'
  if (row.rsi != null && row.rsi < 30 && row.close < (row.ma20 ?? Infinity))
    return 'RSI quá bán'
  if (row.volumeSpike) return 'Đột biến khối lượng'
  if (row.foreignBuySpike) return 'Khối ngoại mua đột biến'
  return 'Quan sát'
}

function getAdvice(row: AnalysisRow) {
  if (row.isDeadlyBreakout) return 'Theo dõi điểm retest'
  if (row.isTrapBreakdown) return 'Ưu tiên quản trị rủi ro'
  if (row.isBreakout) return 'Chờ xác nhận / retest'
  if (row.isBreakdown) return 'Rà soát ngưỡng dừng lỗ'
  if (row.isHammer || row.isBullReversal) return 'Theo dõi xác nhận tăng'
  if (row.isShootingStar || row.isBearReversal) return 'Thận trọng áp lực bán'
  if (row.rsi != null && row.rsi < 30) return 'Theo dõi hồi phục'
  if (row.rsi != null && row.rsi > 70) return 'Cân nhắc chốt từng phần'
  return 'Chờ tín hiệu rõ hơn'
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
  tone?: 'neutral' | 'positive' | 'negative' | 'accent'
}) {
  const tones = {
    neutral: 'border-slate-700 bg-slate-900/70',
    positive: 'border-emerald-500/30 bg-emerald-500/5',
    negative: 'border-rose-500/30 bg-rose-500/5',
    accent: 'border-sky-500/30 bg-sky-500/5',
  }

  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-tight text-slate-100">{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-400">{detail}</p>}
    </div>
  )
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

export default function BasicAnalysisPanel({
  symbol,
  userId,
}: {
  symbol: string
  userId: string
}) {
  const [rawData, setRawData] = useState<StockEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('recent')
  const [refreshKey, setRefreshKey] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  useEffect(() => {
    let active = true

    const fetchData = async () => {
      if (!symbol || !userId) {
        setRawData([])
        setLoading(false)
        setError('Thiếu mã cổ phiếu hoặc thông tin người dùng.')
        return
      }

      setLoading(true)
      setError('')

      // Đọc toàn bộ lịch sử theo từng lô. Supabase/PostgREST thường giới hạn
      // số dòng mỗi request, vì vậy không dùng limit(90) hoặc chỉ lấy một trang.
      const batchSize = 1000
      const allRows: StockEntry[] = []
      let offset = 0
      let queryError: { message: string } | null = null

      while (true) {
        const { data: batch, error: batchError } = await supabase
          .from('stock_entries')
          .select('*')
          .eq('symbol', symbol)
          .order('date', { ascending: true })
          .range(offset, offset + batchSize - 1)

        if (batchError) {
          queryError = batchError
          break
        }

        if (!batch?.length) break
        allRows.push(...(batch as StockEntry[]))
        if (batch.length < batchSize) break
        offset += batchSize
      }

      if (!active) return

      if (queryError) {
        console.error('Lỗi truy vấn stock_entries:', queryError.message)
        setError('Không thể tải toàn bộ dữ liệu phân tích. Vui lòng thử lại.')
        setRawData([])
      } else if (!allRows.length) {
        setError('Chưa có dữ liệu cho mã cổ phiếu này.')
        setRawData([])
      } else {
        setRawData(allRows)
      }

      setLoading(false)
    }

    fetchData()
    return () => {
      active = false
    }
  }, [symbol, userId, refreshKey])

  const data = useMemo(() => analyzeEntries(rawData), [rawData])
  const last = data[data.length - 1]
  const first = data[0]
  const priceChange = first && last ? safePercent(last.close, first.close) : 0
  const reversalRows = data.filter((row) => row.isBullReversal || row.isBearReversal)
  const tableRows = activeTab === 'recent' ? [...data].reverse() : [...reversalRows].reverse()
  const totalPages = Math.max(1, Math.ceil(tableRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRows = tableRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const rangeStart = tableRows.length ? (currentPage - 1) * pageSize + 1 : 0
  const rangeEnd = Math.min(currentPage * pageSize, tableRows.length)
  const signalCount = data.filter(
    (row) =>
      row.isBreakout ||
      row.isBreakdown ||
      row.isHammer ||
      row.isShootingStar ||
      row.isBullReversal ||
      row.isBearReversal,
  ).length

  const trendScore = last?.trendScore ?? null
  const trendLabel =
    trendScore == null
      ? 'Chưa đủ dữ liệu để chấm điểm xu hướng'
      : trendScore >= 3
        ? 'Xu hướng tăng mạnh — các chỉ báo khá đồng thuận'
        : trendScore >= 1
          ? 'Xu hướng nghiêng tăng — cần theo dõi xác nhận'
          : trendScore <= -3
            ? 'Xu hướng giảm mạnh — áp lực bán chiếm ưu thế'
            : trendScore <= -1
              ? 'Xu hướng nghiêng giảm — cần theo dõi xác nhận'
              : 'Xu hướng trung tính — tín hiệu chưa đồng thuận'

  const indicatorNotes = last
    ? [
        last.ema20 != null
          ? `Giá ${last.close >= last.ema20 ? 'trên' : 'dưới'} EMA20`
          : 'EMA20 chưa đủ dữ liệu',
        last.ema20 != null && last.ema50 != null
          ? `EMA20 ${last.ema20 >= last.ema50 ? 'trên' : 'dưới'} EMA50`
          : 'EMA50 chưa đủ dữ liệu',
        last.macdHistogram != null
          ? `MACD Histogram ${last.macdHistogram >= 0 ? 'dương' : 'âm'}`
          : 'MACD chưa đủ dữ liệu',
        last.rsi != null
          ? `RSI ${formatNumber(last.rsi)} (${last.rsi >= 55 ? 'động lượng tăng' : last.rsi <= 45 ? 'động lượng giảm' : 'trung tính'})`
          : 'RSI chưa đủ dữ liệu',
      ]
    : []

  const aiSignal =
    last?.rsi == null || trendScore == null
      ? 'Chưa đủ dữ liệu lịch sử để đánh giá đồng thuận chỉ báo.'
      : `${trendLabel}. Điểm xu hướng ${trendScore > 0 ? '+' : ''}${trendScore}/4.`


  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-8 text-center">
        <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
        <p className="text-sm text-slate-400">Đang tải dữ liệu {symbol}…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-6">
        <p className="text-sm text-slate-300">{error}</p>
        <button
          type="button"
          onClick={() => setRefreshKey((value) => value + 1)}
          className="mt-4 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500"
        >
          Tải lại dữ liệu
        </button>
      </div>
    )
  }

  if (!data.length || !last || !first) return null

  const priceTone = priceChange >= 0 ? 'positive' : 'negative'

  return (
    <div className="space-y-5 pt-4 text-slate-100">
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-sky-500/10 px-2 py-1 text-xs font-bold text-sky-300">
              {symbol}
            </span>
            <span className="text-xs text-slate-400">Phân tích kỹ thuật · {data.length} phiên</span>
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">Tổng quan thị trường</h2>
          <p className="mt-1 text-sm text-slate-400">
            Dữ liệu đến {formatDate(last.date)} · Phân tích mang tính tham khảo
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((value) => value + 1)}
          className="self-start rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-sky-500 hover:text-white sm:self-auto"
        >
          ↻ Làm mới
        </button>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Giá đóng cửa gần nhất"
          value={formatNumber(last.close)}
          detail={`Phiên ${formatDate(last.date)}`}
          tone="accent"
        />
        <MetricCard
          label="Biến động trong kỳ"
          value={`${priceChange >= 0 ? '+' : ''}${formatNumber(priceChange)}%`}
          detail={`${formatNumber(first.close)} → ${formatNumber(last.close)}`}
          tone={priceTone}
        />
        <MetricCard
          label="RSI (14)"
          value={last.rsi == null ? '—' : formatNumber(last.rsi)}
          detail={
            last.rsi == null
              ? 'Cần tối thiểu 15 mức giá'
              : last.rsi < 30
                ? 'Vùng quá bán'
                : last.rsi > 70
                  ? 'Vùng quá mua'
                  : 'Vùng trung tính'
          }
          tone={last.rsi != null && last.rsi < 30 ? 'positive' : last.rsi != null && last.rsi > 70 ? 'negative' : 'neutral'}
        />
        <MetricCard
          label="Tín hiệu kỹ thuật"
          value={String(signalCount)}
          detail="Số phiên có tín hiệu trong dữ liệu"
          tone="accent"
        />
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 sm:p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Nhận định chỉ báo</p>
        <p className="mt-2 text-sm font-semibold text-slate-100">{aiSignal}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {indicatorNotes.map((note) => (
            <div key={note} className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
              {note}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
          <span>EMA20: <strong className="text-slate-200">{formatNumber(last.ema20)}</strong></span>
          <span>EMA50: <strong className="text-slate-200">{formatNumber(last.ema50)}</strong></span>
          <span>MACD: <strong className="text-slate-200">{formatNumber(last.macd)}</strong></span>
          <span>Signal: <strong className="text-slate-200">{formatNumber(last.macdSignal)}</strong></span>
          <span>ATR14: <strong className="text-slate-200">{formatNumber(last.atr14)}</strong></span>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Điểm xu hướng tổng hợp 4 thành phần (giá/EMA20, EMA20/EMA50, MACD Histogram, RSI), mỗi thành phần ±1 điểm.
          Đây là mô hình quy tắc tham khảo, không phải dự báo chắc chắn hay khuyến nghị mua bán.
          Luôn kết hợp bối cảnh thị trường, thanh khoản và quản trị rủi ro.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Giá đóng cửa · MA20 · Bollinger Bands" subtitle="Theo dõi xu hướng và độ biến động giá">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#263244" strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={24} stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis domain={['auto', 'auto']} stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <Tooltip
                labelFormatter={(label) => formatDate(String(label))}
                formatter={(value) => formatNumber(numberOr(value))}
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10 }}
              />
              <Legend />
              <Line type="monotone" dataKey="close" stroke="#60a5fa" strokeWidth={2} dot={false} name="Đóng cửa" />
              <Line type="monotone" dataKey="ma20" stroke="#34d399" strokeWidth={1.4} dot={false} name="SMA20" />
              <Line type="monotone" dataKey="ema20" stroke="#22d3ee" strokeWidth={1.6} dot={false} name="EMA20" />
              <Line type="monotone" dataKey="ema50" stroke="#a78bfa" strokeWidth={1.6} dot={false} name="EMA50" />
              <Line type="monotone" dataKey="upperBB" stroke="#fb923c" strokeDasharray="4 4" dot={false} name="BB trên" />
              <Line type="monotone" dataKey="lowerBB" stroke="#fb923c" strokeDasharray="4 4" dot={false} name="BB dưới" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Dòng tiền khối ngoại" subtitle="Giá trị mua và bán theo phiên">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#263244" strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={24} stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <Tooltip
                labelFormatter={(label) => formatDate(String(label))}
                formatter={(value) => formatNumber(numberOr(value))}
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10 }}
              />
              <Legend />
              <Bar dataKey="foreign_buy_value" fill="#34d399" name="Mua" radius={[3, 3, 0, 0]} />
              <Bar dataKey="foreign_sell_value" fill="#fb7185" name="Bán" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="RSI (14)" subtitle="Mốc tham chiếu 30 — quá bán · 70 — quá mua">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#263244" strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={24} stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} ticks={[0, 30, 50, 70, 100]} stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <ReferenceLine y={30} stroke="#34d399" strokeDasharray="5 5" />
            <ReferenceLine y={70} stroke="#fb7185" strokeDasharray="5 5" />
            <Tooltip
              labelFormatter={(label) => formatDate(String(label))}
              formatter={(value) => formatNumber(numberOr(value))}
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10 }}
            />
            <Line type="monotone" dataKey="rsi" stroke="#c084fc" strokeWidth={2} dot={false} name="RSI" connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Lịch sử tín hiệu</h3>
            <p className="mt-1 text-xs text-slate-400">{activeTab === 'recent' ? `Toàn bộ ${data.length.toLocaleString('vi-VN')} bản ghi lịch sử` : `${reversalRows.length.toLocaleString('vi-VN')} bản ghi có tín hiệu đảo chiều`}</p>
          </div>
          <div className="flex rounded-lg border border-slate-800 bg-slate-900 p-1">
            <button
              type="button"
              onClick={() => { setActiveTab('recent'); setPage(1) }}
              className={`rounded-md px-3 py-2 text-xs font-medium transition ${
                activeTab === 'recent' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Dữ liệu gần đây
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('reversal'); setPage(1) }}
              className={`rounded-md px-3 py-2 text-xs font-medium transition ${
                activeTab === 'reversal' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tín hiệu đảo chiều
            </button>
          </div>
        </div>

        <div className="max-h-[620px] overflow-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-3 py-3 text-left">Ngày</th>
                <th className="px-3 py-3 text-right">Đóng cửa</th>
                <th className="px-3 py-3 text-right">RSI</th>
                <th className="px-3 py-3 text-right">Khối lượng</th>
                <th className="px-3 py-3 text-right">MA20</th>
                <th className="px-3 py-3 text-right">Khối ngoại mua</th>
                <th className="px-3 py-3 text-right">Khối ngoại bán</th>
                <th className="px-3 py-3 text-left">Tín hiệu</th>
                <th className="px-3 py-3 text-left">Diễn giải</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, index) => {
                const highlighted = row.isDeadlyBreakout
                  ? 'bg-emerald-500/10'
                  : row.isTrapBreakdown
                    ? 'bg-rose-500/10'
                    : row.isBreakout
                      ? 'bg-green-500/5'
                      : row.isBreakdown
                        ? 'bg-red-500/5'
                        : ''

                return (
                  <tr key={`${row.date}-${row.id ?? index}`} className={`border-b border-slate-800/70 transition hover:bg-slate-900/70 ${highlighted}`}>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-300">{formatDate(row.date)}</td>
                    <td className="px-3 py-3 text-right font-medium text-slate-100">{formatNumber(row.close)}</td>
                    <td className={`px-3 py-3 text-right ${
                      row.rsi != null && row.rsi < 30
                        ? 'font-semibold text-emerald-400'
                        : row.rsi != null && row.rsi > 70
                          ? 'font-semibold text-rose-400'
                          : 'text-slate-300'
                    }`}>
                      {row.rsi == null ? '—' : formatNumber(row.rsi)}
                    </td>
                    <td className={`px-3 py-3 text-right ${row.volumeSpike ? 'font-semibold text-amber-300' : 'text-slate-300'}`}>
                      {formatNumber(row.volume, 0)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-300">{formatNumber(row.ma20)}</td>
                    <td className={`px-3 py-3 text-right ${row.foreignBuySpike ? 'font-semibold text-emerald-300' : 'text-slate-300'}`}>
                      {formatNumber(row.foreign_buy_value)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-300">{formatNumber(row.foreign_sell_value)}</td>
                    <td className="px-3 py-3 text-left font-medium text-slate-200">{getSignal(row)}</td>
                    <td className="px-3 py-3 text-left text-slate-400">{getAdvice(row)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span>Hiển thị <strong className="text-slate-200">{rangeStart}–{rangeEnd}</strong> / <strong className="text-slate-200">{tableRows.length.toLocaleString('vi-VN')}</strong> bản ghi</span>
            <label className="flex items-center gap-2">
              Số dòng
              <select
                value={pageSize}
                onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-200 outline-none focus:border-sky-500"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" disabled={currentPage <= 1} onClick={() => setPage(1)} className="rounded-md border border-slate-700 px-2.5 py-2 text-xs text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Trang đầu">«</button>
            <button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">Trước</button>
            <span className="min-w-[100px] px-2 text-center text-xs text-slate-400">Trang <strong className="text-slate-200">{currentPage}</strong> / {totalPages}</span>
            <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">Sau</button>
            <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage(totalPages)} className="rounded-md border border-slate-700 px-2.5 py-2 text-xs text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Trang cuối">»</button>
          </div>
        </div>

        {activeTab === 'reversal' && reversalRows.length === 0 && (
          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 text-center text-sm text-slate-400">
            Không phát hiện tín hiệu đảo chiều theo bộ quy tắc trong khoảng dữ liệu hiện có.
          </div>
        )}
      </section>
    </div>
  )
}
