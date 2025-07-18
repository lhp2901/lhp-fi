'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, ResponsiveContainer
} from 'recharts'

export default function BasicAnalysisPanel({ symbol, userId }: { symbol: string, userId: string }) {
  const [rawData, setRawData] = useState<any[]>([])
  const [message, setMessage] = useState("")
  const [activeTab, setActiveTab] = useState<'recent' | 'reversal'>('recent')

  useEffect(() => {
    const fetchData = async () => {
      if (!symbol || !userId) return

      const { data, error } = await supabase
        .from("stock_entries")
        .select("*")
        .eq("symbol", symbol)
        .order("date", { ascending: true })
        .limit(90)

      if (error) {
        console.error("❌ Lỗi truy vấn stock_entries:", error.message)
        setMessage("Không thể truy vấn dữ liệu.")
        return
      }

      if (!data || data.length === 0) {
        setMessage("⚠️ Không có dữ liệu cho mã này.")
        return
      }

      setRawData(data)
      setMessage("")
    }

    fetchData()
  }, [symbol, userId])

  const formatDate = (d: string) => new Date(d).toLocaleDateString("vi-VN")
  const formatNumber = (num: number | null | undefined) =>
    typeof num === 'number' ? `${num.toLocaleString("vi-VN")}` : '—'

  const getVolumeSpikeDays = (data: any[]) => {
    const spikes = new Set()
    for (let i = 5; i < data.length; i++) {
      const avgVol = data.slice(i - 5, i).reduce((sum, d) => sum + d.volume, 0) / 5
      if (data[i].volume > avgVol * 2) spikes.add(data[i].date)
    }
    return spikes
  }

  const getForeignBuySpikes = (data: any[]) => {
    const alerts = new Set()
    for (let i = 5; i < data.length; i++) {
      const avgBuy = data.slice(i - 5, i).reduce((sum, d) => sum + d.foreign_buy_value, 0) / 5
      if (data[i].foreign_buy_value > avgBuy * 2) alerts.add(data[i].date)
    }
    return alerts
  }

  const calculateIndicators = (data: any[]) =>
    data.map((item, i) => {
      const slice = data.slice(Math.max(0, i - 19), i + 1)
      const closes = slice.map((d) => d.close)
      const volumes = slice.map((d) => d.volume)

      const ma20 = closes.reduce((a, b) => a + b, 0) / closes.length
      const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length
      const stdDev = Math.sqrt(closes.map((x) => (x - ma20) ** 2).reduce((a, b) => a + b, 0) / closes.length) || 0
      const upperBB = ma20 + 2 * stdDev
      const lowerBB = ma20 - 2 * stdDev

      const tickSize = 0.01
      const ref = item.ref_price ?? item.close
      const limitUp = Math.round(ref * 1.07 / tickSize) * tickSize
      const limitDown = Math.round(ref * 0.93 / tickSize) * tickSize

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
//isBreakout và isBreakdown
      const highestHigh20 = slice.map(d => d.high).reduce((a, b) => Math.max(a, b), -Infinity)
      const lowestLow20 = slice.map(d => d.low).reduce((a, b) => Math.min(a, b), Infinity)
      const isBreakout =
      item.close > highestHigh20 * 1.01 && // vượt đỉnh ít nhất 1%
      item.volume > avgVolume * 1.5 &&     // volume phải lớn hơn TB 50%
      rsi != null && rsi > 55 &&           // sức mạnh thị trường xác nhận
      item.close > ma20 &&                 // đóng cửa > MA20
      item.close > upperBB                 // đóng cửa vượt khỏi dải BB trên

      const isBreakdown =
      item.close < lowestLow20 * 0.99 &&   // thủng đáy thật
      item.volume > avgVolume * 1.5 &&     // volume xả cao
      rsi != null && rsi < 35 &&           // RSI rất yếu
      item.close < ma20 &&                 // đóng cửa dưới MA20
      item.close < lowerBB     
//Hammer      
      const isHammer = (() => {
        const body = Math.abs(item.close - item.open)
        const lowerShadow = item.low < item.open && item.low < item.close
          ? Math.min(item.open, item.close) - item.low
          : 0
        const upperShadow = item.high - Math.max(item.open, item.close)

        return (
          lowerShadow > body * 2 &&
          upperShadow < body * 0.5 &&
          item.close > item.open // nến xanh thì đẹp hơn
        )
      })()
//Shooting Star  
      const isShootingStar = (() => {
        const body = Math.abs(item.close - item.open)
        const upperShadow = item.high > item.open && item.high > item.close
          ? item.high - Math.max(item.open, item.close)
          : 0
        const lowerShadow = Math.min(item.open, item.close) - item.low

        return (
          upperShadow > body * 2 &&
          lowerShadow < body * 0.5 &&
          item.close < item.open // nến đỏ thì tốt hơn
        )
      })()

      const isDeadlyBreakout = isBreakout && isHammer
      const isTrapBreakdown = isBreakdown && isShootingStar
      const isBullReversal = item.low <= limitDown && item.close >= limitUp && item.volume > avgVolume * 2
      const isBearReversal = item.high >= limitUp && item.close <= limitDown && item.volume > avgVolume * 2

      return {
        ...item,ma20,upperBB,lowerBB,rsi,avgVolume,limitUp,limitDown,isBullReversal,isBearReversal,isBreakout,isBreakdown,isHammer,isShootingStar,isDeadlyBreakout,isTrapBreakdown
      }
    })

  const data = calculateIndicators(rawData)
  if (message) return <p className="text-red-500">{message}</p>
  if (!data.length) return <p className="text-gray-400">⏳ Đang tải dữ liệu...</p>

  const volumeSpikes = getVolumeSpikeDays(rawData)
  const sharkAlerts = getForeignBuySpikes(rawData)

  const last = data[data.length - 1]
  const first = data[0]
  const priceChange = last && first ? (((last.close - first.close) / first.close) * 100).toFixed(2) : "0"
  const trend = parseFloat(priceChange) > 0 ? "📈 Xu hướng tăng" : "📉 Xu hướng giảm"
  const aiSignal = last?.rsi != null
    ? last.rsi < 30 && last.close < last.ma20
      ? "🟢 Gợi ý: MUA (RSI thấp, dưới MA20)"
      : last.rsi > 70 && last.close > last.ma20
        ? "🔴 Gợi ý: BÁN (RSI cao, trên MA20)"
        : "🟡 Gợi ý: GIỮ (Không rõ xu hướng)"
    : "⏳ Đang phân tích..."

  const getSignal = (row: any) => {
    if (row.isDeadlyBreakout) return "🚀 Break mạnh + Hammer"
    if (row.isTrapBreakdown) return "⚠️ Break rơi + Shooting Star"
    if (row.isBreakout) return "🟢 BREAK MẠNH – XÁC NHẬN"
    if (row.isBreakdown) return "🔻 BREAK RƠI – CẢNH BÁO GẤP"
    if (row.isHammer) return "🔨 Hammer – Đảo chiều tăng"
    if (row.isShootingStar) return "🌠 Shooting Star – Đảo chiều giảm"
    if (row.isBullReversal) return "🐂 Rũ bỏ - Đảo chiều"
    if (row.isBearReversal) return "🐻 Bẫy tăng - Đỉnh giả"
    if (row.rsi != null && row.rsi < 30 && row.close < row.ma20) return "🟢 Gom Hàng"
    if (volumeSpikes.has(row.date)) return "📈 Volume Spike"
    if (sharkAlerts.has(row.date)) return "🦈 Cá mập mua"
    return "👀 Quan sát"
  }

  const getAdvice = (row: any) => {
    if (row.isDeadlyBreakout) return "🟢 Mạnh tay mua"
    if (row.isTrapBreakdown) return "🔻 Bẫy giảm – cắt lỗ"
    if (row.isBreakout) return "🟢 Mua theo Break"
    if (row.isBreakdown) return "🔻 Cắt lỗ ngay"
    if (row.isHammer) return "🟢 Quan sát mua đảo chiều"
    if (row.isShootingStar) return "🔴 Cảnh giác đỉnh rơi"    
    if (row.isBullReversal) return "🟢 Mua sớm"
    if (row.isBearReversal) return "🔴 Bán gấp"
    if (row.rsi != null && row.rsi < 30 && row.close < row.ma20) return "🟢 Mua"
    if (row.rsi != null && row.rsi > 70 && row.close > row.ma20) return "🔴 Bán"
    return "🔵 Giữ"
  }
  
  return (
    <div className="pt-4">
        <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">💰 Phân tích lời/lỗ</h3>
        <p>Giá đầu: <strong>{first.close}</strong> – Giá hiện tại: <strong>{last.close}</strong></p>
        <p>Lợi nhuận: <strong className={parseFloat(priceChange) >= 0 ? 'text-green-500' : 'text-red-500'}>
          {priceChange}%</strong> – {trend}</p>
        <p className="mt-4 text-lg font-bold">{aiSignal}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-medium mb-2">📉 Biểu đồ giá + MA + BB</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={formatDate} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="close" stroke="#4f46e5" name="Close" />
              <Line type="monotone" dataKey="ma20" stroke="#22c55e" name="MA20" />
              <Line type="monotone" dataKey="upperBB" stroke="#f97316" name="Upper BB" />
              <Line type="monotone" dataKey="lowerBB" stroke="#f97316" name="Lower BB" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h3 className="font-medium mb-2">💸 Dòng tiền khối ngoại</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={formatDate} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="foreign_buy_value" fill="#16a34a" name="Mua" />
              <Bar dataKey="foreign_sell_value" fill="#dc2626" name="Bán" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
        <div className="mt-10">
            <h3 className="font-medium mb-2">📊 RSI</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data}>
                <XAxis dataKey="date" tickFormatter={formatDate} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="rsi" stroke="#ef4444" name="RSI" />
              </LineChart>
            </ResponsiveContainer>
          </div>
     <div className="mt-10">
  <div className="flex space-x-4 mb-4">
    <button
      onClick={() => setActiveTab('recent')}
      className={`px-4 py-2 rounded ${activeTab === 'recent' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-white'}`}
    >
      📋 Dữ liệu gần đây
    </button>
    <button
      onClick={() => setActiveTab('reversal')}
      className={`px-4 py-2 rounded ${activeTab === 'reversal' ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-white'}`}
    >
      🔥 Tín hiệu đặc biệt
    </button>
  </div>

  {activeTab === 'recent' && (
  <div className="overflow-auto border border-gray-700 rounded">
    <table className="min-w-full text-sm">
      <thead className="bg-gray-800 text-white">
        <tr>
          <th className="px-3 py-2 text-left">📅 Ngày</th>
          <th className="px-3 py-2 text-right">Đóng cửa</th>
          <th className="px-3 py-2 text-right">RSI</th>
          <th className="px-3 py-2 text-right">Volume</th>
          <th className="px-3 py-2 text-right">MA20</th>
          <th className="px-3 py-2 text-right">Mua</th>
          <th className="px-3 py-2 text-right">Bán</th>
          <th className="px-3 py-2 text-center">📌 Tín hiệu</th>
          <th className="px-3 py-2 text-center">💡 Gợi ý</th>
        </tr>
      </thead>
      <tbody>
          {data.slice(-30).reverse().map((row, i) => {
            const rowClass = row.isDeadlyBreakout
              ? 'bg-emerald-300 text-black font-semibold'
              : row.isTrapBreakdown
              ? 'bg-rose-300 text-black font-semibold'
              : row.isBreakout
              ? 'bg-green-100 text-black font-semibold'
              : row.isBreakdown
              ? 'bg-red-100 text-black font-semibold'
              : ''

            const signal = row.isDeadlyBreakout
              ? "🚀 Break mạnh + Hammer"
              : row.isTrapBreakdown
              ? "⚠️ Break rơi + Shooting Star"
              : getSignal(row)

            const advice = getAdvice(row)

            return (
              <tr key={i} className={`border-b border-gray-700 ${rowClass}`}>
                
                {/* Ngày */}
                <td className="px-3 py-2 text-center">
                  {formatDate(row.date)}
                </td>

                {/* Close */}
                <td className="px-3 py-2 text-right">{formatNumber(row.close)}</td>

                {/* RSI */}
                <td className={`px-3 py-2 text-right ${
                  row.rsi != null && row.rsi < 30 ? 'text-green-400 font-bold' :
                  row.rsi > 70 ? 'text-red-500 font-bold' : ''
                }`}>
                  {row.rsi ? row.rsi.toFixed(2) : '—'}
                </td>

                {/* Volume */}
                <td className={`px-3 py-2 text-right ${
                  volumeSpikes.has(row.date) ? 'bg-yellow-200 text-black font-bold' : ''
                }`}>
                  {formatNumber(row.volume)}
                </td>

                {/* MA20 */}
                <td className="px-3 py-2 text-right">
                  {row.ma20 ? row.ma20.toFixed(2) : '—'}
                </td>

                {/* Foreign Buy */}
                <td className={`px-3 py-2 text-right ${
                  sharkAlerts.has(row.date) ? 'bg-green-300 text-black font-bold' : ''
                }`}>
                  {formatNumber(row.foreign_buy_value)} (tỷ)
                </td>

                {/* Foreign Sell */}
                <td className="px-3 py-2 text-right">
                  {formatNumber(row.foreign_sell_value)} (tỷ)
                </td>

                {/* Tín hiệu */}
                <td className="px-3 py-2 text-center font-bold">
                  {signal}
                </td>

                {/* Gợi ý */}
                <td className="px-3 py-2 text-center font-semibold">
                  {advice}
                </td>
              </tr>
            )
          })}
        </tbody>

    </table>
  </div>
)}

  {activeTab === 'reversal' && (
  <>
    {data.some(d => d.isBullReversal || d.isBearReversal) ? (
      <div className="overflow-auto border border-yellow-400 rounded bg-yellow-50 text-black">
        <table className="min-w-full text-sm">
          <thead className="bg-yellow-300 text-black">
            <tr>
              <th className="px-3 py-2 text-left">Ngày</th>
              <th className="px-3 py-2 text-right">Đóng cửa</th>
              <th className="px-3 py-2 text-center">Tín hiệu</th>
              <th className="px-3 py-2 text-center">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {data.filter(row => row.isBullReversal || row.isBearReversal).map((row, i) => (
              <tr key={i} className="border-b border-gray-300">
                <td className="px-3 py-2">{formatDate(row.date)}</td>
                <td className="px-3 py-2 text-right">{formatNumber(row.close)}</td>
                <td className="px-3 py-2 text-center">
                  {row.isBullReversal ? "🐂 Rũ bỏ - Đảo chiều" : "🐻 Bẫy tăng - Đỉnh giả"}
                </td>
                <td className="px-3 py-2 text-center font-semibold">
                  {row.isBullReversal ? "🟢 Mua sớm" : "🔴 Bán gấp"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        ) : (
          <div className="text-center text-yellow-600 font-semibold border border-yellow-400 bg-yellow-50 rounded p-4">
            ⛔ Không có tín hiệu đặc biệt trong 90 phiên gần nhất.
          </div>
        )}
      </>
    )}
  </div>
</div>
  )
}
