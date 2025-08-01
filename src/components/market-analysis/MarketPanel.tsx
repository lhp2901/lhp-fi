'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, DotProps
} from 'recharts'
import { useMemo, useState, useEffect } from 'react'
import { FaSort, FaSortUp, FaSortDown } from 'react-icons/fa'
type FilterType = 'all' | 'volume' | 'ai' | 'breakout' | 'distribution' | 'rsi-low'
interface Props {
  data: any[]
  name: string
}
const formatDate = (d: string) => {
  const date = new Date(d)
  return `${date.getDate()}/${date.getMonth() + 1}`
}
const formatNumber = (n: number) =>
  n?.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' ₫'
const formatPercent = (n: number) =>
  n?.toFixed(2) + '%'
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-gray-800 text-white p-2 rounded text-sm shadow">
        <p className="font-semibold">{label}</p>
        {payload.map((entry: any, idx: number) => (
          <p key={idx} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {
              typeof entry.value === 'number'
                ? entry.name.includes('%') || entry.name === 'RSI'
                  ? formatPercent(entry.value)
                  : formatNumber(entry.value)
                : entry.value
            }
          </p>
        ))}
      </div>
    )
  }
  return null
}
export default function MarketPanel({ data, name }: Props) {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'ai' | 'breakout' | 'distribution' | 'rsi-low' | 'volume'>('all')

  useEffect(() => {
    if (!fromDate && !toDate) {
      const todayStr = new Date().toISOString().slice(0, 10)
      const twoWeeksAgoStr = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
      setFromDate(twoWeeksAgoStr)
      setToDate(todayStr)
    }
  }, [name])
 const enrichData = useMemo(() => {
  return data.map((item, i) => {
    const slice = data.slice(Math.max(0, i - 19), i + 1)
    const closes = slice.map(d => d.close)
    const volumes = slice.map(d => d.volume)
    const highs = slice.map(d => d.high)
    const ma20 = closes.reduce((a, b) => a + b, 0) / closes.length
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length
    const stdDev = Math.sqrt(closes.map(x => (x - ma20) ** 2).reduce((a, b) => a + b, 0) / closes.length)
    const upperBB = ma20 + 2 * stdDev
    const lowerBB = ma20 - 2 * stdDev
    const high20 = Math.max(...highs)

    const rsi = i >= 14 ? (() => {
      const gains = data.slice(i - 13, i + 1).map((d, j) => {
        const diff = j === 0 ? 0 : d.close - data[i - 13 + j - 1].close
        return diff > 0 ? diff : 0
      })
      const losses = data.slice(i - 13, i + 1).map((d, j) => {
        const diff = j === 0 ? 0 : data[i - 13 + j - 1].close - d.close
        return diff > 0 ? diff : 0
      })
      const avgGain = gains.reduce((a, b) => a + b, 0) / 14
      const avgLoss = losses.reduce((a, b) => a + b, 0) / 14
      const rs = avgGain / (avgLoss || 1)
      return 100 - 100 / (1 + rs)
    })() : null
    const prev = data[i - 1] ?? item
    const priceChange = ((item.close - prev.close) / prev.close) * 100

    const isVolumeSpike = item.volume > avgVolume * 1.8 && item.volume > prev.volume * 1.5
    const isAboveMA20 = item.close > ma20 * 1.01
    const isBreakHigh20 = item.close > high20 * 1.01

    const isBreakout =
      isAboveMA20 &&
      priceChange > 2 &&
      isVolumeSpike &&
      rsi !== null && rsi > 50 && rsi < 70 &&
      isBreakHigh20

    const isForeignBuy = (item.foreign_buy_value ?? 0) > (item.foreign_sell_value ?? 0) * 1.2
    const isForeignSell = (item.foreign_sell_value ?? 0) > (item.foreign_buy_value ?? 0) * 1.2

    const isAiBuySignal =
      rsi !== null && rsi > 40 && rsi < 60 &&
      priceChange > 0.5 &&
      item.close > ma20 * 1.005 &&
      item.volume > avgVolume * 1.2 &&
      (item.foreign_buy_value ?? 0) > (item.foreign_sell_value ?? 0) * 1.1

    const gomSlice = data.slice(Math.max(0, i - 4), i + 1)
    const isStrongGomHang =
      gomSlice.every(d => d.rsi !== null && d.rsi < 50) &&
      gomSlice.every(d => (d.foreign_buy_value ?? 0) > (d.foreign_sell_value ?? 0)) &&
      gomSlice.every((d, idx) => {
        const prev = data[data.indexOf(d) - 1]
        const diff = prev ? ((d.close - prev.close) / prev.close) * 100 : 0
        return Math.abs(diff) < 1
      })

    const isDistribution =
      rsi !== null && rsi > 70 &&
      priceChange < 0 &&
      isVolumeSpike && isForeignSell

    const isWeakBuy = rsi !== null && rsi < 50 && isForeignBuy
    const isWeakSell = rsi !== null && rsi > 60 && priceChange < 0 && isForeignSell
    const isBreakdown = rsi !== null && rsi > 65 && !isAboveMA20 && priceChange < -0.5

    const isPotentialTrap = isBreakout && rsi > 75

    return {
      ...item,
      ma20, upperBB, lowerBB, rsi, avgVolume, high20,
      isAboveMA20, isVolumeSpike, isBreakHigh20, isBreakout, isAiBuySignal,
      isStrongGomHang, isGomHang: isStrongGomHang, isDistribution, isBreakdown,
      isForeignBuy, isForeignSell, isWeakBuy, isWeakSell, isPotentialTrap,
      isBigBuy: isAiBuySignal || isStrongGomHang || isWeakBuy || isBreakout,
      isBigSell: isDistribution || isWeakSell || isBreakdown,
      priceChange,
    }
  })
}, [data])

  const filteredData = useMemo(() => {
    return enrichData.filter(item => {
      const dateStr = item.date?.slice(0, 10)
      const fromOk = !fromDate || dateStr >= fromDate
      const toOk = !toDate || dateStr <= toDate
      return fromOk && toOk
    })
  }, [enrichData, fromDate, toDate])
  
    const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData
    return [...filteredData].sort((a, b) => {
      const valA = a[sortConfig.key]
      const valB = b[sortConfig.key]
      if (valA === undefined || valB === undefined) return 0
      if (typeof valA === 'string') {
        return sortConfig.direction === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA)
      }
      return sortConfig.direction === 'asc'
        ? valA - valB
        : valB - valA
    })
  }, [filteredData, sortConfig])

  const signalFiltered = useMemo(() => {
    let result = sortedData
    result = result.filter(item => {
      switch (filterType) {
        case 'ai':
          return item.isAiBuySignal
        case 'breakout':
          return item.isBreakout
        case 'distribution':
          return item.isDistribution
        case 'rsi-low':
          return item.rsi !== null && item.rsi < 30
        case 'volume':
          return item.isVolumeSpike
        case 'all':
        default:
          return true
      }
    })
    return result.slice(-90).reverse()
  }, [sortedData, filterType])

const enhancedData = useMemo(() => {
  return signalFiltered.map(item => {
    const isBuyOpportunity =
      item.isBreakout ||
      (item.rsi < 60 && item.isAboveMA20 && (item.isVolumeSpike || item.isBigBuy))

    const isSellOpportunity =
      item.rsi > 70 && !item.isAboveMA20 &&
      item.priceChange < -0.5 && (item.isBigSell || item.isBreakdown)

    let suggestion = '🔵 Quan sát'
    let suggestionLevel = 0

    if (item.isBreakout) {
      suggestion = '🟢 MUA mạnh – Break xác nhận'
      suggestionLevel = 2
    } else if (item.isAiBuySignal) {
      suggestion = '🟢 MUA nhẹ – tín hiệu AI'
      suggestionLevel = 1
    } else if (item.isGomHang) {
      suggestion = '🟡 Gom hàng – theo dõi'
      suggestionLevel = 0.5
    } else if (item.isBreakdown) {
      suggestion = '🔴 Cảnh báo bán – breakdown'
      suggestionLevel = -1
    } else if (item.isDistribution) {
      suggestion = '🔴 Phân phối mạnh – thoát dần'
      suggestionLevel = -2
    }
    return {
      ...item,
      suggestion,
      suggestionLevel,
      isBuyOpportunity,
      isSellOpportunity,
    }
  })
}, [signalFiltered])

  const handleSort = (key: string) => {
    setSortConfig(prev =>
      prev?.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    )
  }

  const SortableHeader = ({ label, keyName }: { label: string, keyName: string }) => (
    <th onClick={() => handleSort(keyName)} className="cursor-pointer px-3 py-2 border select-none">
      {label}
      {sortConfig?.key === keyName ? (
        sortConfig.direction === 'asc' ? <FaSortUp className="inline ml-1" /> : <FaSortDown className="inline ml-1" />
      ) : <FaSort className="inline ml-1 text-gray-500" />}
    </th>
  )

  const customDotRSI = (props: DotProps & { payload?: any }) => {
    const { cx, cy, payload } = props
    if (payload?.rsi < 30) {
      return <circle cx={cx} cy={cy} r={5} fill="#dc2626" stroke="white" strokeWidth={1} />
    }
    return <circle cx={cx} cy={cy} r={3} fill="#f43f5e" />
  }

  const last = sortedData[sortedData.length - 1]
  const first = sortedData[0]
  const priceChange = last && first ? ((last.close - first.close) / first.close * 100).toFixed(2) : '0'
  const trend = parseFloat(priceChange) > 0 ? '📈 Tăng' : '📉 Giảm'

    return (
    <div className="space-y-6 text-white">
      {/* Filter ngày + xoá lọc */}
      <div className="flex gap-4 items-center">
        <label className="text-sm">
          Từ:
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="ml-1 px-2 py-1 rounded bg-gray-800 border border-gray-600 text-white" />
        </label>
        <label className="text-sm">
          Đến:
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="ml-1 px-2 py-1 rounded bg-gray-800 border border-gray-600 text-white" />
        </label>
        <button onClick={() => { setFromDate(''); setToDate('') }} className="ml-2 text-sm px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600">
          ❌ Xoá lọc
        </button>
      </div>

      {/* Tổng quan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6"></div>
      <div>
        <p className="text-lg">Chỉ số: <strong>{name}</strong></p>
        <p>Giá đầu: <strong>{first?.close}</strong> – Giá hiện tại: <strong>{last?.close}</strong></p>
        <p>
          Lợi nhuận: <strong className={parseFloat(priceChange) >= 0 ? 'text-green-400' : 'text-red-400'}>{priceChange}%</strong> – {trend}
        </p>
      </div>
      {/* Gợi ý Mua/Bán theo RSI + MA20 */}
        {last && last.rsi && last.ma20 && (
        <div className="mt-2 p-3 rounded bg-gray-800 text-sm border border-gray-600">
            {last.rsi > 70 && last.close > last.ma20 && (
            <p className="text-red-400 font-semibold">🔴 Gợi ý: <strong>BÁN</strong> (RSI cao, trên MA20)</p>
            )}
            {last.rsi < 30 && last.close < last.ma20 && (
            <p className="text-green-400 font-semibold">🟢 Gợi ý: <strong>MUA</strong> (RSI thấp, dưới MA20)</p>
            )}
        </div>
        )}  
      {/* Biểu đồ giá + MA + BB */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  {/* Biểu đồ giá + MA + BB */}
  <div>
    <h3 className="font-medium mb-2">📉 Biểu đồ giá + MA + BB</h3>
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={sortedData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#444" />
        <XAxis dataKey="date" tickFormatter={formatDate} stroke="#ccc" />
        <YAxis stroke="#ccc" />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Line type="monotone" dataKey="close" stroke="#4f46e5" name="Close" />
        <Line type="monotone" dataKey="ma20" stroke="#22c55e" name="MA20" />
        <Line type="monotone" dataKey="upperBB" stroke="#f97316" name="Upper BB" />
        <Line type="monotone" dataKey="lowerBB" stroke="#f97316" name="Lower BB" />
      </LineChart>
    </ResponsiveContainer>
  </div>
  {/* BarChart Dòng tiền khối ngoại */}
  <div>
    <h3 className="font-medium mb-2">💸 Dòng tiền khối ngoại</h3>
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={sortedData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#444" />
        <XAxis dataKey="date" tickFormatter={formatDate} stroke="#ccc" />
        <YAxis stroke="#ccc" />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar dataKey="foreign_buy_value" fill="#16a34a" name="Mua" />
        <Bar dataKey="foreign_sell_value" fill="#dc2626" name="Bán" />
      </BarChart>
    </ResponsiveContainer>
  </div>
</div>
      {/* LineChart RSI */}
      <div>
        <h3 className="font-medium mb-2">📊 RSI</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={sortedData}>
            <XAxis dataKey="date" tickFormatter={formatDate} stroke="#ccc" />
            <YAxis domain={[0, 100]} stroke="#ccc" />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="rsi" stroke="#f43f5e" name="RSI" dot={customDotRSI} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    
      {/* Bảng tín hiệu + Filter */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium">🗍 Tín hiệu Cá Mập Mới Nhất</h3>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as FilterType)}
            className="text-sm bg-gray-800 border border-gray-600 text-white px-2 py-1 rounded"
          >
            <option value="all">🎯 Tất cả</option>
            <option value="ai">🧠 AI Vào hàng</option>
            <option value="breakout">⚡ Breakout</option>
            <option value="distribution">🔴 Phân phối</option>
            <option value="rsi-low">📉 RSI thấp</option>
            <option value="volume">📊 Volume spike</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm text-left text-white bg-gray-900 rounded shadow">
            <thead className="bg-gray-900 text-purple-300 text-xs uppercase tracking-wide">
              <tr>
                <SortableHeader label="📅 Ngày" keyName="date" />
                <SortableHeader label="💰 Close" keyName="close" />
                <SortableHeader label="📊 RSI" keyName="rsi" />
                <SortableHeader label="🔉 Volume" keyName="volume" />
                <SortableHeader label="🧮 MA20" keyName="ma20" />
                <SortableHeader label="📈 Trên MA20" keyName="isAboveMA20" />
                <SortableHeader label="🤖 AI Mua" keyName="isAiBuySignal" />
                <SortableHeader label="⚡ Breakout" keyName="isBreakout" />
                <SortableHeader label="📉 Breakdown" keyName="isBreakdown" />
                <SortableHeader label="🟢 BigBuy" keyName="isBigBuy" />
                <SortableHeader label="🔴 BigSell" keyName="isBigSell" />
                <th className="border px-3 py-2">🌏 Mua/Bán (Ngoại)</th>
                <th className="border px-3 py-2">📌 Tín hiệu</th>
                <th className="border px-3 py-2">💡 Gợi ý</th>
              </tr>
            </thead>
            <tbody>
                {enhancedData.map((item, index) => {
                  const bgClass = item.isAiBuySignal
                    ? 'bg-green-900 bg-opacity-20'
                    : item.isDistribution
                    ? 'bg-red-900 bg-opacity-20'
                    : item.isBreakout
                    ? 'bg-yellow-800 bg-opacity-10'
                    : item.isBreakdown
                    ? 'bg-red-700 bg-opacity-10'
                    : 'bg-gray-800 bg-opacity-5'

                  const signalNotes = [
                    item.isAiBuySignal && '🧠 AI Vào Hàng',
                    item.isGomHang && '🟢 Gom Hàng Lặng Lẽ',
                    item.isBreakout && '⚡ Breakout MA20 + Volume',
                    item.isVolumeSpike && '📊 Volume đột biến',
                    item.isDistribution && '🔴 Phân Phối đỉnh',
                    item.isBreakdown && '📉 Gãy MA20 rõ ràng',
                  ].filter(Boolean)

                  return (
                    <tr key={index} className={`${bgClass} border-t border-gray-700`}>
                      <td className="border px-3 py-1">{formatDate(item.date)}</td>
                      <td className="border px-3 py-1">{item.close?.toFixed(2)}</td>
                      <td className={`border px-3 py-1 ${
                        item.rsi > 70 ? 'text-red-400 font-bold' :
                        item.rsi < 30 ? 'text-green-400 font-bold' : ''
                      }`}>
                        {item.rsi?.toFixed(2) || '—'}
                      </td>
                      <td className="border px-3 py-1">{item.volume?.toLocaleString('vi-VN')}</td>
                      <td className="border px-3 py-1">{item.ma20?.toFixed(2) || '—'}</td>
                      <td className="border px-3 py-1 text-center">{item.isAboveMA20 ? '✅' : '—'}</td>
                      <td className="border px-3 py-1 text-center">{item.isAiBuySignal ? '🧠' : '—'}</td>
                      <td className="border px-3 py-1 text-center">{item.isBreakout ? '⚡' : '—'}</td>
                      <td className="border px-3 py-1 text-center">{item.isBreakdown ? '📉' : '—'}</td>
                      <td className="border px-3 py-1 text-center">{item.isBigBuy ? '🟢' : '—'}</td>
                      <td className="border px-3 py-1 text-center">{item.isBigSell ? '🔴' : '—'}</td>
                      <td className="border px-3 py-1 leading-tight text-xs">
                        <span className="block">🟢 {item.foreign_buy_value?.toLocaleString('vi-VN')}</span>
                        <span className="block">🔴 {item.foreign_sell_value?.toLocaleString('vi-VN')}</span>
                      </td>
                      <td className="border px-3 py-1 text-xs font-medium leading-tight space-y-1 text-white">
                        {signalNotes.map((note, i) => (
                          <div key={i}>{note}</div>
                        ))}
                      </td>
                      <td className={`
                        px-3 py-1 font-bold text-sm text-center border-l-4 rounded-r
                        ${item.suggestion?.startsWith('🟢') ? 'border-green-500 text-green-200' :
                          item.suggestion?.startsWith('🔴') ? 'border-red-500 text-red-200' :
                          item.suggestion?.startsWith('🟡') ? 'border-yellow-400 text-yellow-200' :
                          'border-blue-500 text-blue-200'}
                      `}>
                        {item.suggestion}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
