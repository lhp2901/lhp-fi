"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
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
} from "recharts"

export default function BasicAnalysisPanel({ symbol }: { symbol: string }) {
  const [rawData, setRawData] = useState<any[]>([])
  const [message, setMessage] = useState("")

  useEffect(() => {
    const fetchData = async () => {
      if (!symbol) return
      const { data, error } = await supabase
        .from("stock_entries")
        .select("*")
        .eq("symbol", symbol)
        .order("date", { ascending: true })
        .limit(90)

      if (data) {
        setRawData(data)
        setMessage("")
      } else {
        setMessage("Không tìm thấy dữ liệu.")
      }
    }
    fetchData()
  }, [symbol])

  const formatDate = (d: string) => {
    const date = new Date(d)
    return date.toLocaleDateString("vi-VN")
  }

  const formatNumber = (num: number) => num.toLocaleString("vi-VN")

  const getVolumeSpikeDays = (data: any[]) => {
    const spikes = new Set()
    for (let i = 5; i < data.length; i++) {
      const avgVol =
        data.slice(i - 5, i).reduce((sum, d) => sum + d.volume, 0) / 5
      if (data[i].volume > avgVol * 2) spikes.add(data[i].date)
    }
    return spikes
  }

  const getForeignBuySpikes = (data: any[]) => {
    const alerts = new Set()
    for (let i = 5; i < data.length; i++) {
      const avgBuy =
        data.slice(i - 5, i).reduce((sum, d) => sum + d.foreign_buy_value, 0) / 5
      if (data[i].foreign_buy_value > avgBuy * 2) alerts.add(data[i].date)
    }
    return alerts
  }

  const calculateIndicators = (data: any[]) => {
    return data.map((item, i) => {
      const slice = data.slice(Math.max(0, i - 19), i + 1)
      const closes = slice.map((d) => d.close)
      const ma20 = closes.reduce((a, b) => a + b, 0) / closes.length
      const stdDev =
        Math.sqrt(
          closes.map((x) => (x - ma20) ** 2).reduce((a, b) => a + b, 0) /
            closes.length
        ) || 0
      const upperBB = ma20 + 2 * stdDev
      const lowerBB = ma20 - 2 * stdDev

      const rsi = i >= 14 ? (() => {
        const gains = data.slice(i - 13, i + 1).map((d, j) => {
          const diff =
            j === 0 ? 0 : d.close - data[i - 13 + j - 1].close
          return diff > 0 ? diff : 0
        })
        const losses = data.slice(i - 13, i + 1).map((d, j) => {
          const diff =
            j === 0 ? 0 : data[i - 13 + j - 1].close - d.close
          return diff > 0 ? diff : 0
        })
        const avgGain = gains.reduce((a, b) => a + b, 0) / 14
        const avgLoss = losses.reduce((a, b) => a + b, 0) / 14
        const rs = avgGain / (avgLoss || 1)
        return 100 - 100 / (1 + rs)
      })() : null

      return { ...item, ma20, upperBB, lowerBB, rsi }
    })
  }

  const data = calculateIndicators(rawData)
  const volumeSpikes = getVolumeSpikeDays(rawData)
  const sharkAlerts = getForeignBuySpikes(rawData)

  const last = data[data.length - 1]
  const first = data[0]
  const priceChange =
    last && first ? (((last.close - first.close) / first.close) * 100).toFixed(2) : "0"
  const trend = parseFloat(priceChange) > 0 ? "📈 Xu hướng tăng" : "📉 Xu hướng giảm"

  const aiSignal =
    last && last.rsi !== null
      ? last.rsi < 30 && last.close < last.ma20
        ? "🟢 Gợi ý: MUA (RSI thấp, dưới MA20)"
        : last.rsi > 70 && last.close > last.ma20
          ? "🔴 Gợi ý: BÁN (RSI cao, trên MA20)"
          : "🟡 Gợi ý: GIỮ (Không rõ xu hướng)"
      : "⏳ Đang phân tích..."

  return (
    <div className="pt-4">
      <h2 className="text-xl font-semibold mb-2">📊 Phân tích cổ phiếu chuyên sâu</h2>

      {message && <p className="text-red-500 mb-4">{message}</p>}

      {data.length > 0 && (
        <>
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
            <h3 className="text-lg font-semibold mb-3">📋 Dữ liệu gần đây</h3>
            <div className="overflow-auto border border-gray-700 rounded">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-800 text-white">
                  <tr>
                    <th className="px-3 py-2 text-left">Ngày</th>
                    <th className="px-3 py-2 text-right">Close</th>
                    <th className="px-3 py-2 text-right">Volume</th>
                    <th className="px-3 py-2 text-right">Mua</th>
                    <th className="px-3 py-2 text-right">Bán</th>
                  </tr>
                </thead>
                <tbody>
                  {data.slice(-30).reverse().map((row, i) => (
                    <tr key={i} className="border-b border-gray-700">
                      <td className="px-3 py-2">{formatDate(row.date)}</td>
                      <td className="px-3 py-2 text-right">{row.close}</td>
                      <td
                        className={`px-3 py-2 text-right ${volumeSpikes.has(row.date)
                          ? "bg-yellow-200 text-black font-bold"
                          : ""
                          }`}
                      >
                        {formatNumber(row.volume)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right ${sharkAlerts.has(row.date)
                          ? "bg-green-300 text-black font-bold"
                          : ""
                          }`}
                      >
                        {formatNumber(row.foreign_buy_value)}
                      </td>
                      <td className="px-3 py-2 text-right">{formatNumber(row.foreign_sell_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
