
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, isValid, parseISO, subDays } from 'date-fns'
import { vi } from 'date-fns/locale'
import { AnimatePresence, motion } from 'framer-motion'
import { Tooltip } from 'react-tooltip'
import { supabase } from '@/lib/supabase'

/* =========================================================
 * TYPES
 * ======================================================= */

type Sentiment = 'bullish' | 'bearish' | 'neutral'
type Tone = 'positive' | 'negative' | 'neutral' | 'warning'

interface MarketSignalRow {
  date: string | null
  signal_type: string | null
  market_sentiment: string | null
  confidence_score: number | string | null
  rsi_score: number | string | null
  volume_spike_ratio: number | string | null
  trend_strength: string | null
  momentum: number | string | null
  macd_signal: string | number | null
  bollinger_band: string | number | null
  foreign_flow: number | string | null
  index_code: string | null
}

interface NormalizedSignal {
  date: string
  indexCode: string
  signalType: string
  sentiment: Sentiment
  confidence: number | null
  rsi: number | null
  volumeSpike: number | null
  trendStrength: string
  momentum: number | null
  macd: string
  bollinger: string
  foreignFlow: number | null
}

interface IndicatorStatus {
  label: string
  tone: Tone
}

interface MarketAnalysis {
  signal: NormalizedSignal
  score: number | null
  sentiment: Sentiment
  confidence: number | null
  source: string
  breadth: string
  indicators: {
    rsi: IndicatorStatus
    volume: IndicatorStatus
    trend: IndicatorStatus
    momentum: IndicatorStatus
    macd: IndicatorStatus
    bollinger: IndicatorStatus
    foreignFlow: IndicatorStatus
  }
}

interface HistoryItem {
  date: string
  sentiment: Sentiment
  signalType: string
  confidence: number | null
  score: number | null
  source: string
}

interface FetchState {
  loading: boolean
  error: string | null
}

/* =========================================================
 * CONFIGURATION
 * ======================================================= */

const PAGE_SIZE = 1000
const HISTORY_DAYS = 7

const INDEX_WEIGHTS: Record<string, number> = {
  VNINDEX: 0.7,
  VN30: 0.3,
}

const SENTIMENT_META: Record<
  Sentiment,
  {
    icon: string
    label: string
    color: string
    border: string
    background: string
    badge: string
  }
> = {
  bullish: {
    icon: '📈',
    label: 'Lạc quan',
    color: 'text-emerald-300',
    border: 'border-emerald-400/30',
    background: 'from-emerald-950/30',
    badge: 'bg-emerald-400/10 text-emerald-300',
  },
  bearish: {
    icon: '📉',
    label: 'Bi quan',
    color: 'text-rose-300',
    border: 'border-rose-400/30',
    background: 'from-rose-950/30',
    badge: 'bg-rose-400/10 text-rose-300',
  },
  neutral: {
    icon: '⚖️',
    label: 'Trung lập',
    color: 'text-amber-300',
    border: 'border-amber-400/30',
    background: 'from-amber-950/20',
    badge: 'bg-amber-400/10 text-amber-300',
  },
}

const SELECT_COLUMNS = [
  'date',
  'signal_type',
  'market_sentiment',
  'confidence_score',
  'rsi_score',
  'volume_spike_ratio',
  'trend_strength',
  'momentum',
  'macd_signal',
  'bollinger_band',
  'foreign_flow',
  'index_code',
].join(',')

/* =========================================================
 * NORMALIZATION
 * ======================================================= */

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return null
  }

  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function normalizeToken(value: unknown): string {
  return normalizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const text = value.trim()
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)

  if (dateOnly) {
    const year = Number(dateOnly[1])
    const month = Number(dateOnly[2])
    const day = Number(dateOnly[3])
    const date = new Date(Date.UTC(year, month - 1, day))

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null
    }

    return text
  }

  const parsed = parseISO(text)

  if (!isValid(parsed)) {
    return null
  }

  return format(parsed, 'yyyy-MM-dd')
}

function normalizeConfidence(value: number | null): number | null {
  if (value === null) {
    return null
  }

  const normalized = value > 1 ? value / 100 : value

  return normalized >= 0 && normalized <= 1
    ? normalized
    : null
}

function normalizeSentiment(value: unknown): Sentiment {
  const token = normalizeToken(value)

  if (
    token.includes('bullish') ||
    token.includes('positive') ||
    token.includes('buy') ||
    token.includes('lac quan') ||
    token.includes('tang') ||
    token.includes('uptrend')
  ) {
    return 'bullish'
  }

  if (
    token.includes('bearish') ||
    token.includes('negative') ||
    token.includes('sell') ||
    token.includes('bi quan') ||
    token.includes('giam') ||
    token.includes('downtrend')
  ) {
    return 'bearish'
  }

  return 'neutral'
}

function normalizeSignal(
  row: MarketSignalRow,
): NormalizedSignal | null {
  const date = normalizeDate(row.date)

  if (!date) {
    return null
  }

  return {
    date,
    indexCode: normalizeText(row.index_code).toUpperCase() || 'UNKNOWN',
    signalType: normalizeText(row.signal_type) || 'Chưa xác định',
    sentiment: normalizeSentiment(row.market_sentiment),
    confidence: normalizeConfidence(parseNumber(row.confidence_score)),
    rsi: parseNumber(row.rsi_score),
    volumeSpike: parseNumber(row.volume_spike_ratio),
    trendStrength: normalizeText(row.trend_strength) || 'Chưa xác định',
    momentum: parseNumber(row.momentum),
    macd: normalizeText(row.macd_signal) || 'Chưa xác định',
    bollinger: normalizeText(row.bollinger_band) || 'Chưa xác định',
    foreignFlow: parseNumber(row.foreign_flow),
  }
}

/* =========================================================
 * INDICATOR INTERPRETATION
 * ======================================================= */

function makeStatus(label: string, tone: Tone): IndicatorStatus {
  return { label, tone }
}

function getRsiStatus(value: number | null): IndicatorStatus {
  if (value === null) {
    return makeStatus('Chưa có dữ liệu', 'warning')
  }

  if (value < 0 || value > 100) {
    return makeStatus('RSI không hợp lệ', 'warning')
  }

  if (value < 30) {
    return makeStatus('Quá bán', 'warning')
  }

  if (value < 45) {
    return makeStatus('Động lượng yếu', 'negative')
  }

  if (value <= 55) {
    return makeStatus('Trung tính', 'neutral')
  }

  if (value <= 70) {
    return makeStatus('Động lượng tích cực', 'positive')
  }

  return makeStatus('Quá mua', 'warning')
}

function getVolumeStatus(value: number | null): IndicatorStatus {
  if (value === null) {
    return makeStatus('Chưa có dữ liệu', 'warning')
  }

  if (value < 0) {
    return makeStatus('Giá trị không hợp lệ', 'warning')
  }

  if (value < 0.8) {
    return makeStatus('Thanh khoản thấp', 'neutral')
  }

  if (value <= 1.2) {
    return makeStatus('Thanh khoản bình thường', 'neutral')
  }

  if (value <= 2) {
    return makeStatus('Thanh khoản tăng', 'positive')
  }

  return makeStatus('Khối lượng đột biến', 'warning')
}

function getTrendStatus(value: string): IndicatorStatus {
  const token = normalizeToken(value)

  if (
    token.includes('strong bullish') ||
    token.includes('uptrend') ||
    token.includes('bullish') ||
    token.includes('tang manh')
  ) {
    return makeStatus('Xu hướng tăng', 'positive')
  }

  if (
    token.includes('strong bearish') ||
    token.includes('downtrend') ||
    token.includes('bearish') ||
    token.includes('giam manh')
  ) {
    return makeStatus('Xu hướng giảm', 'negative')
  }

  if (token.includes('strong') || token.includes('manh')) {
    return makeStatus('Xu hướng mạnh', 'warning')
  }

  if (token.includes('weak') || token.includes('yeu')) {
    return makeStatus('Xu hướng yếu', 'warning')
  }

  if (token.includes('tang')) {
    return makeStatus('Xu hướng tăng', 'positive')
  }

  if (token.includes('giam')) {
    return makeStatus('Xu hướng giảm', 'negative')
  }

  return makeStatus(value || 'Chưa xác định', 'neutral')
}

function getMomentumStatus(value: number | null): IndicatorStatus {
  if (value === null) {
    return makeStatus('Chưa có dữ liệu', 'warning')
  }

  if (value > 0) {
    return makeStatus('Động lượng dương', 'positive')
  }

  if (value < 0) {
    return makeStatus('Động lượng âm', 'negative')
  }

  return makeStatus('Trung tính', 'neutral')
}

function getMacdStatus(value: string): IndicatorStatus {
  const token = normalizeToken(value)

  if (
    token.includes('bullish') ||
    token.includes('buy') ||
    token.includes('tang') ||
    token.includes('positive')
  ) {
    return makeStatus('MACD tích cực', 'positive')
  }

  if (
    token.includes('bearish') ||
    token.includes('sell') ||
    token.includes('giam') ||
    token.includes('negative')
  ) {
    return makeStatus('MACD tiêu cực', 'negative')
  }

  if (
    token === '0' ||
    token.includes('neutral') ||
    token.includes('trung lap')
  ) {
    return makeStatus('MACD trung tính', 'neutral')
  }

  return makeStatus('Chưa xác định hướng', 'warning')
}

function getBollingerStatus(value: string): IndicatorStatus {
  const token = normalizeToken(value)

  if (
    token.includes('upper') ||
    token.includes('qua mua') ||
    token.includes('overbought')
  ) {
    return makeStatus('Giá gần biên trên', 'warning')
  }

  if (
    token.includes('lower') ||
    token.includes('qua ban') ||
    token.includes('oversold')
  ) {
    return makeStatus('Giá gần biên dưới', 'warning')
  }

  if (
    token.includes('mo rong') ||
    token.includes('expanding')
  ) {
    return makeStatus('Biến động mở rộng', 'warning')
  }

  if (
    token.includes('thu hep') ||
    token.includes('contracting')
  ) {
    return makeStatus('Biến động thu hẹp', 'neutral')
  }

  return makeStatus(value || 'Chưa xác định', 'neutral')
}

function getForeignFlowStatus(value: number | null): IndicatorStatus {
  if (value === null) {
    return makeStatus('Chưa có dữ liệu', 'warning')
  }

  if (value > 0) {
    return makeStatus('Dương theo dữ liệu nguồn', 'positive')
  }

  if (value < 0) {
    return makeStatus('Âm theo dữ liệu nguồn', 'negative')
  }

  return makeStatus('Cân bằng', 'neutral')
}

/* =========================================================
 * TECHNICAL SCORING
 * ======================================================= */

/**
 * Điểm tham khảo trong khoảng -100 đến +100.
 * Đây không phải xác suất tăng giá.
 */
function calculateTechnicalScore(
  signal: NormalizedSignal,
): number | null {
  let weightedScore = 0
  let totalWeight = 0

  const add = (score: number, weight: number) => {
    weightedScore += score * weight
    totalWeight += weight
  }

  if (
    signal.rsi !== null &&
    signal.rsi >= 0 &&
    signal.rsi <= 100
  ) {
    const rsiScore = Math.max(
      -100,
      Math.min(100, (signal.rsi - 50) * 2.5),
    )

    add(rsiScore, 1.5)
  }

  if (signal.momentum !== null) {
    add(
      signal.momentum > 0 ? 50 :
      signal.momentum < 0 ? -50 : 0,
      1.5,
    )
  }

  const macd = getMacdStatus(signal.macd)

  if (macd.tone === 'positive') {
    add(60, 1.5)
  } else if (macd.tone === 'negative') {
    add(-60, 1.5)
  } else if (macd.tone === 'neutral') {
    add(0, 1)
  }

  const trend = getTrendStatus(signal.trendStrength)

  if (trend.tone === 'positive') {
    add(50, 1)
  } else if (trend.tone === 'negative') {
    add(-50, 1)
  }

  if (signal.foreignFlow !== null) {
    add(
      signal.foreignFlow > 0 ? 40 :
      signal.foreignFlow < 0 ? -40 : 0,
      1,
    )
  }

  if (totalWeight === 0) {
    return null
  }

  return Math.round((weightedScore / totalWeight) * 10) / 10
}

function deriveSentiment(
  score: number | null,
  sourceSentiment: Sentiment,
): Sentiment {
  if (score === null) {
    return sourceSentiment
  }

  if (score >= 15) {
    return 'bullish'
  }

  if (score <= -15) {
    return 'bearish'
  }

  return 'neutral'
}

/* =========================================================
 * MARKET AGGREGATION
 * ======================================================= */

function weightedAverage(
  rows: NormalizedSignal[],
  getter: (row: NormalizedSignal) => number | null,
): number | null {
  let total = 0
  let totalWeight = 0

  for (const row of rows) {
    const value = getter(row)

    if (value === null) {
      continue
    }

    const weight = INDEX_WEIGHTS[row.indexCode] ?? 1

    total += value * weight
    totalWeight += weight
  }

  if (totalWeight === 0) {
    return null
  }

  return Math.round((total / totalWeight) * 100) / 100
}

function buildAnalysis(
  inputRows: NormalizedSignal[],
): MarketAnalysis | null {
  if (inputRows.length === 0) {
    return null
  }

  // Mỗi chỉ số chỉ lấy bản ghi mới nhất trong ngày.
  const latestByIndex = new Map<string, NormalizedSignal>()

  for (const row of inputRows) {
    const current = latestByIndex.get(row.indexCode)

    if (!current || row.date >= current.date) {
      latestByIndex.set(row.indexCode, row)
    }
  }

  const knownRows = ['VNINDEX', 'VN30']
    .map((code) => latestByIndex.get(code))
    .filter((row): row is NormalizedSignal => row !== undefined)

  const selected = knownRows.length > 0
    ? knownRows
    : [inputRows[0]]

  const first = selected[0]

  const merged: NormalizedSignal = {
    date: selected.reduce(
      (latest, row) => row.date > latest ? row.date : latest,
      first.date,
    ),
    indexCode: selected.length > 1 ? 'MERGED' : first.indexCode,
    signalType: selected.length > 1
      ? 'Tổng hợp thị trường'
      : first.signalType,
    sentiment: first.sentiment,
    confidence: weightedAverage(selected, (row) => row.confidence),
    rsi: weightedAverage(selected, (row) => row.rsi),
    volumeSpike: weightedAverage(selected, (row) => row.volumeSpike),
    trendStrength: selected
      .map((row) => row.trendStrength)
      .filter((value) => value !== 'Chưa xác định')
      .join(' / ') || 'Chưa xác định',
    momentum: weightedAverage(selected, (row) => row.momentum),
    macd: selected
      .map((row) => `${row.indexCode}: ${row.macd}`)
      .join(' | '),
    bollinger: selected
      .map((row) => `${row.indexCode}: ${row.bollinger}`)
      .join(' | '),
    foreignFlow: weightedAverage(
      selected,
      (row) => row.foreignFlow,
    ),
  }

  const scoredRows = selected
    .map((row) => ({
      score: calculateTechnicalScore(row),
      weight: INDEX_WEIGHTS[row.indexCode] ?? 1,
    }))
    .filter(
      (item): item is { score: number; weight: number } =>
        item.score !== null,
    )

  const scoreWeight = scoredRows.reduce(
    (sum, item) => sum + item.weight,
    0,
  )

  const score = scoreWeight > 0
    ? Math.round(
        (
          scoredRows.reduce(
            (sum, item) => sum + item.score * item.weight,
            0,
          ) / scoreWeight
        ) * 10,
      ) / 10
    : null

  const sentiment = deriveSentiment(score, first.sentiment)

  const bullishCount = selected.filter(
    (row) => row.sentiment === 'bullish',
  ).length

  const bearishCount = selected.filter(
    (row) => row.sentiment === 'bearish',
  ).length

  const breadth = selected.length === 1
    ? 'Chỉ có một chỉ số hợp lệ'
    : bullishCount > bearishCount
      ? 'Các nguồn nghiêng tích cực'
      : bearishCount > bullishCount
        ? 'Các nguồn nghiêng tiêu cực'
        : 'Các nguồn chưa đồng thuận'

  return {
    signal: merged,
    score,
    sentiment,
    confidence: merged.confidence,
    source: selected.map((row) => row.indexCode).join(' + '),
    breadth,
    indicators: {
      rsi: getRsiStatus(merged.rsi),
      volume: getVolumeStatus(merged.volumeSpike),
      trend: getTrendStatus(merged.trendStrength),
      momentum: getMomentumStatus(merged.momentum),
      macd: getMacdStatus(merged.macd),
      bollinger: getBollingerStatus(merged.bollinger),
      foreignFlow: getForeignFlowStatus(merged.foreignFlow),
    },
  }
}

function buildHistory(
  rows: NormalizedSignal[],
): HistoryItem[] {
  const groups = new Map<string, NormalizedSignal[]>()

  for (const row of rows) {
    const group = groups.get(row.date) ?? []
    group.push(row)
    groups.set(row.date, group)
  }

  return Array.from(groups.entries())
    .map(([date, dailyRows]) => {
      const analysis = buildAnalysis(dailyRows)

      if (!analysis) {
        return null
      }

      return {
        date,
        sentiment: analysis.sentiment,
        signalType: analysis.signal.signalType,
        confidence: analysis.confidence,
        score: analysis.score,
        source: analysis.source,
      }
    })
    .filter((item): item is HistoryItem => item !== null)
    .sort((a, b) => b.date.localeCompare(a.date))
}

/* =========================================================
 * FORMATTERS
 * ======================================================= */

function formatNumber(
  value: number | null,
  digits = 2,
): string {
  if (value === null || !Number.isFinite(value)) {
    return '—'
  }

  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: digits,
  }).format(value)
}

function formatConfidence(value: number | null): string {
  if (value === null) {
    return '—'
  }

  return `${(value * 100).toFixed(1)}%`
}

function formatDate(value: string): string {
  const parsed = parseISO(value)

  return isValid(parsed)
    ? format(parsed, 'dd/MM/yyyy', { locale: vi })
    : value
}

function formatWeekday(value: string): string {
  const parsed = parseISO(value)

  return isValid(parsed)
    ? format(parsed, 'EEEE', { locale: vi })
    : ''
}

function toneClass(tone: Tone): string {
  switch (tone) {
    case 'positive':
      return 'text-emerald-300'
    case 'negative':
      return 'text-rose-300'
    case 'warning':
      return 'text-amber-300'
    default:
      return 'text-slate-300'
  }
}

/* =========================================================
 * INDICATOR ROW
 * ======================================================= */

function IndicatorRow({
  id,
  icon,
  label,
  value,
  status,
  tooltip,
}: {
  id: string
  icon: string
  label: string
  value: string
  status: IndicatorStatus
  tooltip: string
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 border-b border-white/10 py-2.5 last:border-b-0"
      data-tooltip-id={id}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true">{icon}</span>
        <span className="text-sm text-slate-300">{label}</span>
      </div>

      <div className="min-w-0 text-right">
        <p className="break-words text-sm font-semibold text-white">
          {value}
        </p>
        <p className={`mt-0.5 text-xs ${toneClass(status.tone)}`}>
          {status.label}
        </p>
      </div>

      <Tooltip id={id} content={tooltip} place="top" />
    </div>
  )
}

/* =========================================================
 * MAIN COMPONENT
 * ======================================================= */

export default function MarketMoodCardUltra() {
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const [state, setState] = useState<FetchState>({
    loading: true,
    error: null,
  })

  const fetchData = useCallback(async () => {
    setState({ loading: true, error: null })

    try {
      const { data: latestRow, error: latestError } = await supabase
        .from('ai_market_signals')
        .select('date')
        .not('date', 'is', null)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestError) {
        throw new Error(
          `Không thể lấy ngày dữ liệu mới nhất: ${latestError.message}`,
        )
      }

      const latestDate = normalizeDate(latestRow?.date)

      if (!latestDate) {
        setAnalysis(null)
        setHistory([])
        setState({ loading: false, error: null })
        return
      }

      const weekAgo = format(
        subDays(parseISO(latestDate), HISTORY_DAYS),
        'yyyy-MM-dd',
      )

      const allRows: MarketSignalRow[] = []
      let offset = 0

      // Phân trang để không bị giới hạn 1.000 bản ghi của Supabase.
      while (true) {
        const { data, error } = await supabase
          .from('ai_market_signals')
          .select(SELECT_COLUMNS)
          .gte('date', weekAgo)
          .lte('date', latestDate)
          .order('date', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1)

        if (error) {
          throw new Error(
            `Không thể tải dữ liệu phân tích: ${error.message}`,
          )
        }

        const page = (data ?? []) as unknown as MarketSignalRow[]

        allRows.push(...page)

        if (page.length < PAGE_SIZE) {
          break
        }

        offset += PAGE_SIZE
      }

      const normalized = allRows
        .map(normalizeSignal)
        .filter(
          (row): row is NormalizedSignal => row !== null,
        )

      const latestDayRows = normalized.filter(
        (row) => row.date === latestDate,
      )

      setAnalysis(buildAnalysis(latestDayRows))
      setHistory(buildHistory(normalized))
      setState({ loading: false, error: null })
    } catch (error: unknown) {
      console.error('[MarketMoodCard] Fetch error:', error)

      setState({
        loading: false,
        error: error instanceof Error
          ? error.message
          : 'Không xác định được nguyên nhân lỗi.',
      })
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData, refreshKey])

  const sentimentMeta = useMemo(
    () => SENTIMENT_META[analysis?.sentiment ?? 'neutral'],
    [analysis],
  )

  if (state.loading && !analysis) {
    return (
      <div className="mt-6 w-full rounded-xl border border-slate-700 bg-slate-900 p-5 text-sm text-slate-300">
        <span className="mr-2 inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-sky-400" />
        Đang phân tích dữ liệu thị trường...
      </div>
    )
  }

  if (state.error && !analysis) {
    return (
      <div className="mt-6 w-full rounded-xl border border-rose-500/30 bg-slate-900 p-5">
        <h3 className="font-semibold text-rose-300">
          Không thể tải dữ liệu thị trường
        </h3>

        <p className="mt-2 break-words text-sm text-slate-300">
          {state.error}
        </p>

        <button
          type="button"
          onClick={() => setRefreshKey((value) => value + 1)}
          className="mt-3 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400"
        >
          Thử tải lại
        </button>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="mt-6 w-full rounded-xl border border-slate-700 bg-slate-900 p-5">
        <p className="text-sm text-slate-300">
          Chưa có dữ liệu hợp lệ trong bảng ai_market_signals.
        </p>

        <button
          type="button"
          onClick={() => setRefreshKey((value) => value + 1)}
          className="mt-3 rounded-lg border border-slate-600 px-4 py-2 text-sm text-white hover:bg-slate-800"
        >
          Tải lại dữ liệu
        </button>
      </div>
    )
  }

  const { signal, indicators } = analysis

  const scoreColor = analysis.score === null
    ? 'text-slate-300'
    : analysis.score >= 15
      ? 'text-emerald-300'
      : analysis.score <= -15
        ? 'text-rose-300'
        : 'text-amber-300'

  return (
    <div className="mt-6 w-full min-w-0">
      <AnimatePresence mode="wait">
        <motion.section
          key={`${signal.date}-${analysis.source}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.2 }}
          className={`w-full min-w-0 overflow-hidden rounded-xl border bg-gradient-to-br ${sentimentMeta.background} via-slate-900 to-slate-800 text-white shadow-xl ${sentimentMeta.border}`}
        >
          {/* HEADER GỌN */}
          <div className="border-b border-white/10 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  LHP-FI · Market Intelligence
                </p>

                <h2 className={`mt-2 text-xl font-bold ${sentimentMeta.color}`}>
                  {sentimentMeta.icon} {sentimentMeta.label}
                </h2>

                <p className="mt-1 text-sm text-slate-300">
                  {signal.signalType}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {formatWeekday(signal.date)} · {formatDate(signal.date)}
                </p>
              </div>

              <button
                type="button"
                disabled={state.loading}
                onClick={() => setRefreshKey((value) => value + 1)}
                className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
              >
                {state.loading ? 'Đang tải...' : '↻ Làm mới'}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                <p className="text-xs text-slate-400">Điểm kỹ thuật</p>
                <p className={`mt-1 text-xl font-bold ${scoreColor}`}>
                  {analysis.score === null
                    ? '—'
                    : `${analysis.score > 0 ? '+' : ''}${formatNumber(analysis.score, 1)}`}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Thang điểm −100 đến +100
                </p>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                <p className="text-xs text-slate-400">Độ tin cậy nguồn</p>
                <p className="mt-1 text-xl font-bold text-sky-300">
                  {formatConfidence(analysis.confidence)}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Theo confidence_score
                </p>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                <p className="text-xs text-slate-400">Nguồn dữ liệu</p>
                <p className="mt-1 break-words text-sm font-bold text-white">
                  {analysis.source}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  {analysis.breadth}
                </p>
              </div>
            </div>
          </div>

          {/* CHỈ BÁO — DẠNG BẢNG GỌN */}
          <div className="p-4 sm:p-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">
                📊 Phân tích chỉ báo
              </h3>
              <span className="text-[10px] text-slate-500">
                Dữ liệu nguồn
              </span>
            </div>

            <div className="divide-y divide-white/10">
              <IndicatorRow
                id="market-rsi"
                icon="🔬"
                label="RSI"
                value={formatNumber(signal.rsi)}
                status={indicators.rsi}
                tooltip="RSI dưới 30 thường là vùng quá bán; trên 70 thường là vùng quá mua."
              />

              <IndicatorRow
                id="market-volume"
                icon="💥"
                label="Volume Spike"
                value={signal.volumeSpike === null
                  ? '—'
                  : `${formatNumber(signal.volumeSpike)}×`}
                status={indicators.volume}
                tooltip="Tỷ lệ khối lượng so với mức tham chiếu theo cách tính của nguồn dữ liệu."
              />

              <IndicatorRow
                id="market-trend"
                icon="📈"
                label="Trend Strength"
                value={signal.trendStrength}
                status={indicators.trend}
                tooltip="Diễn giải theo nhãn trend_strength trong dữ liệu nguồn."
              />

              <IndicatorRow
                id="market-momentum"
                icon="⚡"
                label="Momentum"
                value={formatNumber(signal.momentum)}
                status={indicators.momentum}
                tooltip="Dấu dương hoặc âm của Momentum phụ thuộc công thức tính tại nguồn."
              />

              <IndicatorRow
                id="market-macd"
                icon="📉"
                label="MACD"
                value={signal.macd}
                status={indicators.macd}
                tooltip="Trạng thái MACD được diễn giải theo nhãn nguồn; giá trị số cần có quy ước riêng."
              />

              <IndicatorRow
                id="market-bollinger"
                icon="🎯"
                label="Bollinger Band"
                value={signal.bollinger}
                status={indicators.bollinger}
                tooltip="Trạng thái dải Bollinger theo dữ liệu nguồn."
              />

              <IndicatorRow
                id="market-foreign"
                icon="🌍"
                label="Dòng tiền ngoại"
                value={formatNumber(signal.foreignFlow)}
                status={indicators.foreignFlow}
                tooltip="Hiển thị dấu của giá trị nguồn; cần xác nhận đơn vị và quy ước mua/bán ròng."
              />
            </div>

            {/* LỊCH SỬ */}
            <div className="mt-4 border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={() => setShowHistory((previous) => !previous)}
                aria-expanded={showHistory}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <span className="text-sm font-semibold text-slate-100">
                  🕰 Lịch sử tâm lý thị trường
                </span>

                <span className="shrink-0 text-xs text-sky-300">
                  {showHistory ? 'Ẩn lịch sử ▲' : 'Xem lịch sử ▼'}
                </span>
              </button>

              <AnimatePresence initial={false}>
                {showHistory && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 w-full min-w-0 overflow-x-auto rounded-lg border border-white/10">
                      {history.length === 0 ? (
                        <p className="p-4 text-sm text-slate-400">
                          Chưa có dữ liệu lịch sử trong khoảng thời gian này.
                        </p>
                      ) : (
                        <table className="w-full min-w-[650px] table-auto text-left text-xs sm:text-sm">
                          <thead className="bg-white/5 text-[11px] text-slate-400">
                            <tr>
                              <th className="whitespace-nowrap px-3 py-3 font-medium">
                                Ngày
                              </th>

                              <th className="whitespace-nowrap px-3 py-3 font-medium">
                                Tâm lý
                              </th>

                              <th className="min-w-[160px] px-3 py-3 font-medium">
                                Tín hiệu
                              </th>

                              <th className="whitespace-nowrap px-3 py-3 text-right font-medium">
                                Điểm
                              </th>

                              <th className="whitespace-nowrap px-3 py-3 text-right font-medium">
                                Tin cậy
                              </th>

                              <th className="whitespace-nowrap px-3 py-3 font-medium">
                                Nguồn
                              </th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-white/10">
                            {history.map((item) => {
                              const meta = SENTIMENT_META[item.sentiment]

                              const itemScoreColor =
                                item.score === null
                                  ? 'text-slate-300'
                                  : item.score >= 15
                                    ? 'text-emerald-300'
                                    : item.score <= -15
                                      ? 'text-rose-300'
                                      : 'text-amber-300'

                              return (
                                <tr
                                  key={`${item.date}-${item.source}`}
                                  className="transition hover:bg-white/[0.035]"
                                >
                                  <td className="whitespace-nowrap px-3 py-3 text-slate-300">
                                    {formatDate(item.date)}
                                  </td>

                                  <td className={`whitespace-nowrap px-3 py-3 font-medium ${meta.color}`}>
                                    {meta.icon} {meta.label}
                                  </td>

                                  <td className="px-3 py-3 text-slate-300">
                                    {item.signalType}
                                  </td>

                                  <td className={`whitespace-nowrap px-3 py-3 text-right font-semibold ${itemScoreColor}`}>
                                    {item.score === null
                                      ? '—'
                                      : `${item.score > 0 ? '+' : ''}${formatNumber(item.score, 1)}`}
                                  </td>

                                  <td className="whitespace-nowrap px-3 py-3 text-right text-slate-200">
                                    {formatConfidence(item.confidence)}
                                  </td>

                                  <td className="whitespace-nowrap px-3 py-3 text-slate-400">
                                    {item.source || '—'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>

                    <p className="mt-2 text-[10px] text-slate-500">
                      Có {history.length} bản ghi theo ngày. Trên điện thoại,
                      vuốt ngang để xem các cột còn lại.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {state.error && (
              <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-200">
                Cập nhật dữ liệu chưa thành công: {state.error}
              </p>
            )}

            <p className="mt-3 text-[10px] leading-5 text-slate-500">
              Phân tích mang tính tham khảo, không phải xác suất thị trường
              tăng/giảm hay khuyến nghị mua/bán. Chất lượng kết quả phụ thuộc
              vào dữ liệu và công thức do hệ thống nguồn cung cấp.
            </p>
          </div>
        </motion.section>
      </AnimatePresence>
    </div>
  )
}

