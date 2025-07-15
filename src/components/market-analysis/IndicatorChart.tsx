'use client'

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts'
import { supabase } from '@/lib/supabase'

type MergedIndicator = {
  date: string
  rsi_score?: number
  spike?: number
  momentum?: number
  macd_signal?: number
  bollinger_band?: number
}

export default function IndicatorChartsPage() {
  const [data, setData] = useState<MergedIndicator[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from('ai_market_signals')
        .select('date,rsi_score,volume_spike_ratio,momentum,macd_signal,bollinger_band')
        .gte('date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
        .order('date', { ascending: true })

      if (error || !data) {
        console.error('❌ Lỗi khi lấy dữ liệu chỉ báo:', error)
        setData([])
        return
      }

      const grouped: Record<string, MergedIndicator> = {}

      for (const row of data) {
        if (!grouped[row.date]) {
          grouped[row.date] = { date: row.date }
        }

        grouped[row.date].rsi_score = row.rsi_score ?? null
        grouped[row.date].spike = row.volume_spike_ratio ?? null
        grouped[row.date].momentum = row.momentum ?? null

        grouped[row.date].macd_signal =
          row.macd_signal === 'tăng' ? 1 :
          row.macd_signal === 'giảm' ? -1 :
          0

        grouped[row.date].bollinger_band =
          row.bollinger_band === 'mở rộng' ? 1 :
          row.bollinger_band === 'thu hẹp' ? -1 :
          0
      }

      setData(Object.values(grouped))
      setLoading(false)
    }

    fetchData()
  }, [])

  if (loading) return <p className="text-slate-400">Đang tải biểu đồ chỉ báo kỹ thuật...</p>

  return (
  <div className="bg-white/10 p-4 rounded-xl border border-white/20 shadow space-y-4">
    
    <div className="bg-[#0f172a] p-2 rounded-md">
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="date" stroke="#cbd5e1" />
          <YAxis stroke="#cbd5e1" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#fff' }}
          />
          <Legend wrapperStyle={{ color: '#cbd5e1' }} />

          <Line type="monotone" dataKey="rsi_score" stroke="#38bdf8" name="🌀 RSI" dot={{ r: 2 }} />
          <Line type="monotone" dataKey="spike" stroke="#f97316" name="💥 Spike" dot={{ r: 2 }} />
          <Line type="monotone" dataKey="momentum" stroke="#22c55e" name="⚡ Momentum" dot={{ r: 2 }} />
          <Line type="monotone" dataKey="macd_signal" stroke="#a78bfa" name="📈 MACD (số hóa)" dot={{ r: 2 }} />
          <Line type="monotone" dataKey="bollinger_band" stroke="#f472b6" name="📊 Bollinger (số hóa)" dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
)
}
