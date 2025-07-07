'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar
} from 'recharts'

type AIPrediction = {
  symbol: string
  date: string
  probability: number
  recommendation: 'BUY' | 'SELL' | 'HOLD'
}

interface Props {
  symbol: string
}

export default function AIAnalysisPanel({ symbol }: Props) {
  const [data, setData] = useState<any[]>([])
  const [message, setMessage] = useState('')
  const [prediction, setPrediction] = useState<AIPrediction | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 📊 Lấy dữ liệu AI từ Supabase
  useEffect(() => {
    const fetchData = async () => {
      if (!symbol) return
      const { data, error } = await supabase
        .from('ai_signals')
        .select('*')
        .eq('symbol', symbol)
        .order('date', { ascending: true })
        .limit(90)

      if (data) {
        setData(data)
        setMessage('')
      } else {
        setMessage('Không tìm thấy dữ liệu AI.')
      }
    }
    fetchData()
  }, [symbol])

  // 🤖 Gọi dự đoán từ API
  useEffect(() => {
    const fetchPrediction = async () => {
      if (!symbol) return
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/predict?symbol=${symbol}`)
        const json = await res.json()
        if (res.ok) {
          setPrediction(json)
        } else {
          setError(json.error || 'Lỗi khi gọi AI.')
        }
      } catch {
        setError('❌ Không thể kết nối AI server.')
      }
      setLoading(false)
    }

    fetchPrediction()
  }, [symbol])

  const formatDate = (d: string) => {
    const date = new Date(d)
    return `${date.getDate()}/${date.getMonth() + 1}`
  }

  const last = data[data.length - 1]
  const first = data[0]
  const priceChange = last && first ? ((last.close - first.close) / first.close * 100).toFixed(2) : '0'
  const trend = parseFloat(priceChange) > 0 ? '📈 Xu hướng tăng' : '📉 Xu hướng giảm'

  const aiSignal = last && last.rsi !== null
    ? last.rsi < 30 && last.close < last.ma20
      ? '🟢 Gợi ý: MUA (RSI thấp, dưới MA20)'
      : last.rsi > 70 && last.close > last.ma20
        ? '🔴 Gợi ý: BÁN (RSI cao, trên MA20)'
        : '🟡 Gợi ý: GIỮ (Không rõ xu hướng)'
    : '⏳ Đang phân tích...'

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">🧠 AI Phân tích cổ phiếu</h2>

      {loading && <p className="text-sm text-gray-400">Đang phân tích...</p>}
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {message && <p className="text-red-500 text-sm">{message}</p>}

      {prediction && (
        <div className="border p-4 rounded bg-white/5 text-white">
          <p>📅 Ngày: <strong>{new Date(prediction.date).toLocaleDateString('vi-VN')}</strong></p>
          <p>📊 Xác suất thắng: <strong>{(prediction.probability * 100).toFixed(2)}%</strong></p>
          <p>
            🤖 AI Gợi ý:{" "}
            <strong className={
              prediction.recommendation === 'BUY'
                ? 'text-green-400'
                : prediction.recommendation === 'SELL'
                ? 'text-red-400'
                : 'text-yellow-400'
            }>
              {prediction.recommendation}
            </strong>
          </p>
        </div>
      )}

      {data.length > 0 && (
        <>
          <div>
            <h2 className="text-lg font-semibold mb-2">💰 Phân tích lời/lỗ</h2>
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
                  <Line type="monotone" dataKey="bb_upper" stroke="#f97316" name="Upper BB" />
                  <Line type="monotone" dataKey="bb_lower" stroke="#f97316" name="Lower BB" />
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
        </>
      )}
    </div>
  )
}
