
'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type {
  DotProps,
  TooltipProps,
} from 'recharts'

import {
  FaSort,
  FaSortDown,
  FaSortUp,
} from 'react-icons/fa'

type FilterType =
  | 'all'
  | 'volume'
  | 'ai'
  | 'breakout'
  | 'distribution'
  | 'rsi-low'

type SortDirection = 'asc' | 'desc'

type SortKey =
  | 'date'
  | 'close'
  | 'rsi'
  | 'volume'
  | 'ma20'
  | 'isAboveMA20'
  | 'isAiBuySignal'
  | 'isBreakout'
  | 'isBreakdown'
  | 'isBigBuy'
  | 'isBigSell'

interface MarketRow {
  date?: string | null
  close?: number | string | null
  open?: number | string | null
  high?: number | string | null
  low?: number | string | null
  volume?: number | string | null
  foreign_buy_value?: number | string | null
  foreign_sell_value?: number | string | null
}

interface MarketPoint {
  date: string
  timestamp: number
  close: number
  open: number | null
  high: number
  low: number
  volume: number
  foreign_buy_value: number | null
  foreign_sell_value: number | null
}

interface EnrichedPoint extends MarketPoint {
  ma20: number | null
  upperBB: number | null
  lowerBB: number | null
  rsi: number | null
  avgVolume: number | null
  high20: number | null
  priceChange: number | null
  foreignNetValue: number | null
  foreignBuySellRatio: number | null

  isAboveMA20: boolean
  isVolumeSpike: boolean
  isBreakHigh20: boolean
  isBreakout: boolean
  isAiBuySignal: boolean
  isStrongGomHang: boolean
  isGomHang: boolean
  isDistribution: boolean
  isBreakdown: boolean
  isForeignBuy: boolean
  isForeignSell: boolean
  isWeakBuy: boolean
  isWeakSell: boolean
  isPotentialTrap: boolean
  isBigBuy: boolean
  isBigSell: boolean

  suggestion: string
  suggestionLevel: number
  isBuyOpportunity: boolean
  isSellOpportunity: boolean
}

interface Props {
  data: MarketRow[]
  name: string
}

interface TooltipEntry {
  name?: string
  value?: number | string | null
  color?: string
  dataKey?: string | number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
}

const NUMBER_FORMATTER = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 2,
})

const INTEGER_FORMATTER = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 0,
})

const formatNumber = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return '—'
  return NUMBER_FORMATTER.format(value)
}

const formatMoney = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${INTEGER_FORMATTER.format(value)} ₫`
}

const formatPercent = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toFixed(2)}%`
}

const formatDate = (value: string): string => {
  const timestamp = Date.parse(value)

  if (!Number.isFinite(timestamp)) return value

  const date = new Date(timestamp)

  return `${String(date.getDate()).padStart(2, '0')}/${String(
    date.getMonth() + 1,
  ).padStart(2, '0')}`
}

const toNumber = (
  value: number | string | null | undefined,
): number | null => {
  if (value == null || value === '') return null

  const result = typeof value === 'number'
    ? value
    : Number(value)

  return Number.isFinite(result) ? result : null
}

const average = (values: number[]): number | null => {
  if (values.length === 0) return null

  return values.reduce((sum, value) => sum + value, 0) /
    values.length
}

const standardDeviation = (
  values: number[],
  mean: number,
): number => {
  if (values.length === 0) return 0

  const variance = values.reduce(
    (sum, value) => sum + (value - mean) ** 2,
    0,
  ) / values.length

  return Math.sqrt(variance)
}

const calculateRsi = (
  closes: number[],
  index: number,
  period = 14,
): number | null => {
  if (index < period) return null

  let gainSum = 0
  let lossSum = 0

  for (let i = 1; i <= period; i += 1) {
    const difference = closes[i] - closes[i - 1]

    if (difference > 0) {
      gainSum += difference
    } else {
      lossSum += Math.abs(difference)
    }
  }

  let averageGain = gainSum / period
  let averageLoss = lossSum / period

  for (let i = period + 1; i <= index; i += 1) {
    const difference = closes[i] - closes[i - 1]

    const gain = Math.max(difference, 0)
    const loss = Math.max(-difference, 0)

    averageGain =
      (averageGain * (period - 1) + gain) / period

    averageLoss =
      (averageLoss * (period - 1) + loss) / period
  }

  if (averageGain === 0 && averageLoss === 0) {
    return 50
  }

  if (averageLoss === 0) {
    return 100
  }

  const rs = averageGain / averageLoss

  return 100 - 100 / (1 + rs)
}

const normalizeData = (data: MarketRow[]): MarketPoint[] => {
  const normalized = data.flatMap((item): MarketPoint[] => {
    if (!item.date) return []

    const timestamp = Date.parse(item.date)
    const close = toNumber(item.close)

    if (
      !Number.isFinite(timestamp) ||
      close == null ||
      close <= 0
    ) {
      return []
    }

    const rawHigh = toNumber(item.high)
    const rawLow = toNumber(item.low)
    const rawOpen = toNumber(item.open)
    const rawVolume = toNumber(item.volume)

    return [{
      date: item.date,
      timestamp,
      close,
      open: rawOpen,
      high: rawHigh != null && rawHigh > 0
        ? Math.max(rawHigh, close)
        : close,
      low: rawLow != null && rawLow > 0
        ? Math.min(rawLow, close)
        : close,
      volume: rawVolume != null && rawVolume >= 0
        ? rawVolume
        : 0,
      foreign_buy_value: toNumber(item.foreign_buy_value),
      foreign_sell_value: toNumber(item.foreign_sell_value),
    }]
  })

  // Sắp xếp theo thời gian tăng dần.
  normalized.sort((a, b) => a.timestamp - b.timestamp)

  // Nếu dữ liệu có nhiều bản ghi cùng thời điểm,
  // giữ bản ghi xuất hiện cuối cùng.
  const unique = new Map<number, MarketPoint>()

  for (const point of normalized) {
    unique.set(point.timestamp, point)
  }

  return Array.from(unique.values())
    .sort((a, b) => a.timestamp - b.timestamp)
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: CustomTooltipProps) => {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-gray-600 bg-gray-950 p-3 text-sm text-white shadow-xl">
      <p className="mb-2 font-semibold">
        {typeof label === 'string'
          ? formatDate(label)
          : label}
      </p>

      {payload.map((entry, index) => {
        const key = String(entry.dataKey ?? entry.name ?? index)
        const value = toNumber(
          typeof entry.value === 'string' ||
          typeof entry.value === 'number'
            ? entry.value
            : null,
        )

        const isRsi = key === 'rsi'
        const isPercent = key === 'priceChange'

        return (
          <p
            key={`${key}-${index}`}
            className="text-xs"
            style={{ color: entry.color ?? '#ffffff' }}
          >
            {entry.name ?? key}:{' '}
            {value == null
              ? '—'
              : isRsi || isPercent
                ? formatPercent(value)
                : key === 'volume'
                  ? INTEGER_FORMATTER.format(value)
                  : formatNumber(value)}
          </p>
        )
      })}
    </div>
  )
}

export default function MarketPanel({
  data,
  name,
}: Props) {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey
    direction: SortDirection
  } | null>(null)

  const [filterType, setFilterType] =
    useState<FilterType>('all')

  const normalizedData = useMemo(
    () => normalizeData(data),
    [data],
  )

  // Mặc định xem 14 ngày gần nhất có dữ liệu.
  useEffect(() => {
    if (normalizedData.length === 0) return

    if (!fromDate && !toDate) {
      const lastTimestamp =
        normalizedData[normalizedData.length - 1].timestamp

      const startTimestamp = lastTimestamp - 14 * 86400000

      setFromDate(
        new Date(startTimestamp).toISOString().slice(0, 10),
      )

      setToDate(
        new Date(lastTimestamp).toISOString().slice(0, 10),
      )
    }
  }, [normalizedData, fromDate, toDate])

  const enrichData = useMemo((): EnrichedPoint[] => {
    const closes = normalizedData.map(item => item.close)

    return normalizedData.map((item, index) => {
      const currentWindow = normalizedData.slice(
        Math.max(0, index - 19),
        index + 1,
      )

      const previousWindow = normalizedData.slice(
        Math.max(0, index - 20),
        index,
      )

      const currentCloses = currentWindow.map(
        point => point.close,
      )

      const ma20 = currentWindow.length === 20
        ? average(currentCloses)
        : null

      const deviation = ma20 == null
        ? null
        : standardDeviation(currentCloses, ma20)

      const upperBB =
        ma20 != null && deviation != null
          ? ma20 + 2 * deviation
          : null

      const lowerBB =
        ma20 != null && deviation != null
          ? ma20 - 2 * deviation
          : null

      const previousVolumes = previousWindow
        .filter(point => point.volume > 0)
        .map(point => point.volume)

      const avgVolume = previousVolumes.length > 0
        ? average(previousVolumes)
        : null

      const previousHighs = previousWindow.map(
        point => point.high,
      )

      const high20 = previousWindow.length >= 20
        ? Math.max(...previousHighs)
        : null

      const rsi = calculateRsi(closes, index, 14)

      const previous = normalizedData[index - 1]

      const priceChange =
        previous && previous.close > 0
          ? ((item.close - previous.close) / previous.close) * 100
          : null

      const foreignDataAvailable =
        item.foreign_buy_value != null &&
        item.foreign_sell_value != null

      const foreignNetValue = foreignDataAvailable
        ? item.foreign_buy_value! - item.foreign_sell_value!
        : null

      const foreignBuySellRatio =
        foreignDataAvailable &&
        item.foreign_sell_value! > 0
          ? item.foreign_buy_value! /
            item.foreign_sell_value!
          : null

      const isForeignBuy =
        foreignNetValue != null &&
        foreignNetValue > 0

      const isForeignSell =
        foreignNetValue != null &&
        foreignNetValue < 0

      const isVolumeSpike =
        avgVolume != null &&
        avgVolume > 0 &&
        item.volume >= avgVolume * 1.8

      const isAboveMA20 =
        ma20 != null &&
        item.close > ma20

      const isBreakHigh20 =
        high20 != null &&
        item.close > high20

      const isBreakout =
        isBreakHigh20 &&
        isAboveMA20 &&
        isVolumeSpike &&
        rsi != null &&
        rsi >= 50 &&
        rsi < 70 &&
        priceChange != null &&
        priceChange > 0

      const isAiBuySignal =
        rsi != null &&
        rsi >= 40 &&
        rsi < 60 &&
        priceChange != null &&
        priceChange > 0.5 &&
        isAboveMA20 &&
        isVolumeSpike &&
        isForeignBuy

      const accumulationWindow = normalizedData.slice(
        Math.max(0, index - 4),
        index + 1,
      )

      const isStrongGomHang =
        accumulationWindow.length === 5 &&
        accumulationWindow.every((point, offset) => {
          const pointIndex =
            index - accumulationWindow.length + 1 + offset

          const pointRsi = calculateRsi(
            closes,
            pointIndex,
            14,
          )

          const prior = normalizedData[pointIndex - 1]

          const change = prior && prior.close > 0
            ? Math.abs(
                ((point.close - prior.close) / prior.close) * 100,
              )
            : Infinity

          return (
            pointRsi != null &&
            pointRsi < 55 &&
            point.foreign_buy_value != null &&
            point.foreign_sell_value != null &&
            point.foreign_buy_value > point.foreign_sell_value &&
            change < 1.5
          )
        })

      const isDistribution =
        rsi != null &&
        rsi >= 65 &&
        priceChange != null &&
        priceChange < 0 &&
        isVolumeSpike &&
        isForeignSell

      const isBreakdown =
        rsi != null &&
        rsi < 45 &&
        !isAboveMA20 &&
        priceChange != null &&
        priceChange < -0.5

      const isWeakBuy =
        rsi != null &&
        rsi < 50 &&
        isForeignBuy

      const isWeakSell =
        rsi != null &&
        rsi > 60 &&
        priceChange != null &&
        priceChange < 0 &&
        isForeignSell

      const isPotentialTrap =
        isBreakout &&
        rsi != null &&
        rsi >= 70

      const isBigBuy =
        isAiBuySignal ||
        isStrongGomHang ||
        isWeakBuy ||
        isBreakout

      const isBigSell =
        isDistribution ||
        isWeakSell ||
        isBreakdown

      let suggestion = '🔵 Quan sát'
      let suggestionLevel = 0

      if (isDistribution) {
        suggestion = '🔴 Cảnh báo phân phối'
        suggestionLevel = -2
      } else if (isBreakdown) {
        suggestion = '🔴 Cảnh báo suy yếu'
        suggestionLevel = -1
      } else if (isBreakout) {
        suggestion = '🟢 Breakout xác nhận điều kiện'
        suggestionLevel = 2
      } else if (isAiBuySignal) {
        suggestion = '🟢 Tín hiệu mua theo điều kiện'
        suggestionLevel = 1
      } else if (isStrongGomHang) {
        suggestion = '🟡 Theo dõi khả năng tích lũy'
        suggestionLevel = 0.5
      }

      return {
        ...item,
        ma20,
        upperBB,
        lowerBB,
        rsi,
        avgVolume,
        high20,
        priceChange,
        foreignNetValue,
        foreignBuySellRatio,
        isAboveMA20,
        isVolumeSpike,
        isBreakHigh20,
        isBreakout,
        isAiBuySignal,
        isStrongGomHang,
        isGomHang: isStrongGomHang,
        isDistribution,
        isBreakdown,
        isForeignBuy,
        isForeignSell,
        isWeakBuy,
        isWeakSell,
        isPotentialTrap,
        isBigBuy,
        isBigSell,
        suggestion,
        suggestionLevel,
        isBuyOpportunity:
          isBreakout || isAiBuySignal || isStrongGomHang,
        isSellOpportunity:
          isDistribution || isBreakdown,
      }
    })
  }, [normalizedData])

  const filteredData = useMemo(() => {
    return enrichData.filter(item => {
      const date = item.date.slice(0, 10)

      return (
        (!fromDate || date >= fromDate) &&
        (!toDate || date <= toDate)
      )
    })
  }, [enrichData, fromDate, toDate])

  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData

    return [...filteredData].sort((a, b) => {
      const left = a[sortConfig.key]
      const right = b[sortConfig.key]

      let result = 0

      if (typeof left === 'boolean' && typeof right === 'boolean') {
        result = Number(left) - Number(right)
      } else if (
        typeof left === 'number' &&
        typeof right === 'number'
      ) {
        result = left - right
      } else if (
        typeof left === 'string' &&
        typeof right === 'string'
      ) {
        result = left.localeCompare(right)
      } else if (left == null) {
        result = 1
      } else if (right == null) {
        result = -1
      }

      return sortConfig.direction === 'asc'
        ? result
        : -result
    })
  }, [filteredData, sortConfig])

  const signalFiltered = useMemo(() => {
    const result = sortedData.filter(item => {
      switch (filterType) {
        case 'ai':
          return item.isAiBuySignal

        case 'breakout':
          return item.isBreakout

        case 'distribution':
          return item.isDistribution

        case 'rsi-low':
          return item.rsi != null && item.rsi < 30

        case 'volume':
          return item.isVolumeSpike

        default:
          return true
      }
    })

    return result.slice(-90).reverse()
  }, [sortedData, filterType])

  const handleSort = useCallback((key: SortKey) => {
    setSortConfig(previous => ({
      key,
      direction:
        previous?.key === key &&
        previous.direction === 'asc'
          ? 'desc'
          : 'asc',
    }))
  }, [])

  const last = filteredData[filteredData.length - 1]
  const first = filteredData[0]

  const periodChange =
    first && last && first.close > 0
      ? ((last.close - first.close) / first.close) * 100
      : null

  const SortableHeader = ({
    label,
    sortKey,
  }: {
    label: string
    sortKey: SortKey
  }) => (
    <th
      onClick={() => handleSort(sortKey)}
      className="cursor-pointer select-none whitespace-nowrap border border-gray-700 px-3 py-2"
    >
      {label}

      {sortConfig?.key === sortKey ? (
        sortConfig.direction === 'asc'
          ? <FaSortUp className="ml-1 inline" />
          : <FaSortDown className="ml-1 inline" />
      ) : (
        <FaSort className="ml-1 inline text-gray-500" />
      )}
    </th>
  )

  const customDotRSI = (
    props: DotProps & { payload?: EnrichedPoint },
  ) => {
    const { cx, cy, payload } = props

    if (
      typeof cx !== 'number' ||
      typeof cy !== 'number' ||
      payload?.rsi == null
    ) {
      return <g />
    }

    return (
      <circle
        cx={cx}
        cy={cy}
        r={payload.rsi < 30 || payload.rsi > 70 ? 5 : 3}
        fill={
          payload.rsi < 30
            ? '#22c55e'
            : payload.rsi > 70
              ? '#ef4444'
              : '#f43f5e'
        }
        stroke="#ffffff"
        strokeWidth={1}
      />
    )
  }

  const resetFilters = () => {
    setFromDate('')
    setToDate('')
    setFilterType('all')
    setSortConfig(null)
  }

  return (
    <div className="space-y-6 text-white">
      <section className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-700 bg-gray-900 p-4">
        <label className="text-sm">
          <span className="mb-1 block text-gray-400">Từ ngày</span>
          <input
            type="date"
            value={fromDate}
            onChange={event => setFromDate(event.target.value)}
            className="rounded border border-gray-600 bg-gray-800 px-3 py-2"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-gray-400">Đến ngày</span>
          <input
            type="date"
            value={toDate}
            onChange={event => setToDate(event.target.value)}
            className="rounded border border-gray-600 bg-gray-800 px-3 py-2"
          />
        </label>

        <button
          type="button"
          onClick={resetFilters}
          className="rounded bg-gray-700 px-4 py-2 text-sm hover:bg-gray-600"
        >
          Xóa bộ lọc
        </button>
      </section>

      <section className="rounded-xl border border-gray-700 bg-gray-900 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-400">Mã theo dõi</p>
            <h2 className="text-2xl font-bold">{name}</h2>
          </div>

          <span className="rounded-lg bg-gray-800 px-3 py-2 text-sm">
            {filteredData.length} phiên dữ liệu
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-gray-800 p-4">
            <p className="text-sm text-gray-400">Giá đầu kỳ</p>
            <p className="mt-1 text-xl font-semibold">
              {formatNumber(first?.close)}
            </p>
          </div>

          <div className="rounded-lg bg-gray-800 p-4">
            <p className="text-sm text-gray-400">Giá cuối kỳ</p>
            <p className="mt-1 text-xl font-semibold">
              {formatNumber(last?.close)}
            </p>
          </div>

          <div className="rounded-lg bg-gray-800 p-4">
            <p className="text-sm text-gray-400">Biến động giá</p>
            <p
              className={`mt-1 text-xl font-bold ${
                periodChange == null
                  ? 'text-gray-300'
                  : periodChange >= 0
                    ? 'text-green-400'
                    : 'text-red-400'
              }`}
            >
              {formatPercent(periodChange)}
            </p>
          </div>
        </div>

        {last && (
          <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800 p-4">
            <p className="mb-2 text-sm text-gray-400">
              Đánh giá phiên gần nhất
            </p>

            <p className="font-semibold">
              {last.suggestion}
            </p>

            <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-300">
              <span>RSI: {formatNumber(last.rsi)}</span>
              <span>MA20: {formatNumber(last.ma20)}</span>
              <span>
                Volume / TB phiên trước:{' '}
                {last.avgVolume != null && last.avgVolume > 0
                  ? `${(last.volume / last.avgVolume).toFixed(2)}x`
                  : '—'}
              </span>
              <span>
                Dòng tiền ngoại ròng:{' '}
                {last.foreignNetValue == null
                  ? 'Chưa đủ dữ liệu'
                  : formatMoney(last.foreignNetValue)}
              </span>
            </div>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
          <h3 className="mb-4 font-semibold">
            Giá đóng cửa · MA20 · Bollinger Bands
          </h3>

          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />

              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#9ca3af"
                minTickGap={30}
              />

              <YAxis
                stroke="#9ca3af"
                domain={['auto', 'auto']}
                tickFormatter={value => formatNumber(Number(value))}
              />

              <Tooltip content={<CustomTooltip />} />

              <Line
                type="monotone"
                dataKey="close"
                stroke="#818cf8"
                name="Giá đóng cửa"
                dot={false}
                connectNulls={false}
              />

              <Line
                type="monotone"
                dataKey="ma20"
                stroke="#22c55e"
                name="MA20"
                dot={false}
                connectNulls={false}
              />

              <Line
                type="monotone"
                dataKey="upperBB"
                stroke="#f97316"
                name="BB trên"
                dot={false}
                connectNulls={false}
              />

              <Line
                type="monotone"
                dataKey="lowerBB"
                stroke="#f97316"
                name="BB dưới"
                dot={false}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
          <h3 className="mb-4 font-semibold">
            Dòng tiền mua / bán khối ngoại
          </h3>

          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />

              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#9ca3af"
                minTickGap={30}
              />

              <YAxis
                stroke="#9ca3af"
                tickFormatter={value => formatMoney(Number(value))}
              />

              <Tooltip content={<CustomTooltip />} />

              <Bar
                dataKey="foreign_buy_value"
                fill="#22c55e"
                name="Giá trị mua"
              />

              <Bar
                dataKey="foreign_sell_value"
                fill="#ef4444"
                name="Giá trị bán"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-gray-700 bg-gray-900 p-4">
        <h3 className="mb-4 font-semibold">
          RSI 14 · Động lượng thị trường
        </h3>

        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={filteredData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />

            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#9ca3af"
              minTickGap={30}
            />

            <YAxis
              domain={[0, 100]}
              ticks={[0, 30, 50, 70, 100]}
              stroke="#9ca3af"
            />

            <Tooltip content={<CustomTooltip />} />

            <ReferenceLine
              y={70}
              stroke="#ef4444"
              strokeDasharray="5 5"
            />

            <ReferenceLine
              y={30}
              stroke="#22c55e"
              strokeDasharray="5 5"
            />

            <Line
              type="monotone"
              dataKey="rsi"
              stroke="#f43f5e"
              name="RSI"
              dot={customDotRSI}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="rounded-xl border border-gray-700 bg-gray-900 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">
              Tín hiệu phân tích kỹ thuật
            </h3>

            <p className="mt-1 text-xs text-gray-400">
              Tín hiệu dựa trên dữ liệu giá, khối lượng và dòng tiền có sẵn.
            </p>
          </div>

          <select
            value={filterType}
            onChange={event =>
              setFilterType(event.target.value as FilterType)
            }
            className="rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm"
          >
            <option value="all">Tất cả tín hiệu</option>
            <option value="ai">AI vào hàng</option>
            <option value="breakout">Breakout</option>
            <option value="distribution">Phân phối</option>
            <option value="rsi-low">RSI dưới 30</option>
            <option value="volume">Khối lượng đột biến</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1500px] w-full border-collapse text-left text-sm">
            <thead className="bg-gray-800 text-xs uppercase text-purple-300">
              <tr>
                <SortableHeader label="Ngày" sortKey="date" />
                <SortableHeader label="Close" sortKey="close" />
                <SortableHeader label="RSI" sortKey="rsi" />
                <SortableHeader label="Volume" sortKey="volume" />
                <SortableHeader label="MA20" sortKey="ma20" />
                <SortableHeader label="Trên MA20" sortKey="isAboveMA20" />
                <SortableHeader label="AI mua" sortKey="isAiBuySignal" />
                <SortableHeader label="Breakout" sortKey="isBreakout" />
                <SortableHeader label="Breakdown" sortKey="isBreakdown" />
                <SortableHeader label="Big Buy" sortKey="isBigBuy" />
                <SortableHeader label="Big Sell" sortKey="isBigSell" />

                <th className="border border-gray-700 px-3 py-2">
                  Ngoại ròng
                </th>

                <th className="border border-gray-700 px-3 py-2">
                  Tín hiệu
                </th>

                <th className="border border-gray-700 px-3 py-2">
                  Đánh giá
                </th>
              </tr>
            </thead>

            <tbody>
              {signalFiltered.map(item => {
                const rowClass = item.isDistribution || item.isBreakdown
                  ? 'bg-red-950/30'
                  : item.isBreakout || item.isAiBuySignal
                    ? 'bg-green-950/30'
                    : item.isGomHang
                      ? 'bg-yellow-950/20'
                      : ''

                const notes: string[] = []

                if (item.isAiBuySignal) notes.push('AI mua')
                if (item.isGomHang) notes.push('Tích lũy tiềm năng')
                if (item.isBreakout) notes.push('Breakout')
                if (item.isVolumeSpike) notes.push('Volume tăng')
                if (item.isDistribution) notes.push('Phân phối')
                if (item.isBreakdown) notes.push('Suy yếu')

                return (
                  <tr
                    key={item.timestamp}
                    className={`border-t border-gray-700 ${rowClass}`}
                  >
                    <td className="border border-gray-800 px-3 py-2">
                      {formatDate(item.date)}
                    </td>

                    <td className="border border-gray-800 px-3 py-2">
                      {formatNumber(item.close)}
                    </td>

                    <td
                      className={`border border-gray-800 px-3 py-2 ${
                        item.rsi != null && item.rsi >= 70
                          ? 'font-bold text-red-400'
                          : item.rsi != null && item.rsi < 30
                            ? 'font-bold text-green-400'
                            : ''
                      }`}
                    >
                      {formatNumber(item.rsi)}
                    </td>

                    <td className="border border-gray-800 px-3 py-2">
                      {INTEGER_FORMATTER.format(item.volume)}
                    </td>

                    <td className="border border-gray-800 px-3 py-2">
                      {formatNumber(item.ma20)}
                    </td>

                    <td className="border border-gray-800 px-3 py-2 text-center">
                      {item.isAboveMA20 ? '✓' : '—'}
                    </td>

                    <td className="border border-gray-800 px-3 py-2 text-center">
                      {item.isAiBuySignal ? '🧠' : '—'}
                    </td>

                    <td className="border border-gray-800 px-3 py-2 text-center">
                      {item.isBreakout ? '⚡' : '—'}
                    </td>

                    <td className="border border-gray-800 px-3 py-2 text-center">
                      {item.isBreakdown ? '📉' : '—'}
                    </td>

                    <td className="border border-gray-800 px-3 py-2 text-center">
                      {item.isBigBuy ? '🟢' : '—'}
                    </td>

                    <td className="border border-gray-800 px-3 py-2 text-center">
                      {item.isBigSell ? '🔴' : '—'}
                    </td>

                    <td className="border border-gray-800 px-3 py-2">
                      <span
                        className={
                          item.foreignNetValue == null
                            ? 'text-gray-400'
                            : item.foreignNetValue > 0
                              ? 'text-green-400'
                              : item.foreignNetValue < 0
                                ? 'text-red-400'
                                : 'text-gray-300'
                        }
                      >
                        {formatMoney(item.foreignNetValue)}
                      </span>
                    </td>

                    <td className="border border-gray-800 px-3 py-2">
                      {notes.length > 0
                        ? notes.join(' · ')
                        : '—'}
                    </td>

                    <td className="border border-gray-800 px-3 py-2">
                      <span
                        className={
                          item.suggestionLevel > 0
                            ? 'font-semibold text-green-300'
                            : item.suggestionLevel < 0
                              ? 'font-semibold text-red-300'
                              : 'text-blue-300'
                        }
                      >
                        {item.suggestion}
                      </span>
                    </td>
                  </tr>
                )
              })}

              {signalFiltered.length === 0 && (
                <tr>
                  <td
                    colSpan={14}
                    className="px-4 py-10 text-center text-gray-400"
                  >
                    Không có dữ liệu phù hợp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

