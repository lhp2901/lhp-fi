'use client'

import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'

type ChartData = {
  date: string
  [key: string]: string | number | undefined // 👈 thêm dòng này
  VNINDEX?: number
  VNINDEX_label?: number
  VN30?: number
  VN30_label?: number
}

// ✅ Dot cho VNINDEX
const CustomVNINDEXDot = (props: any) => {
  const { cx, cy, payload } = props
  if (!payload || cx === undefined || cy === undefined) return null
  const isWin = payload.VNINDEX_label === 1
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={isWin ? '#22c55e' : '#94a3b8'}
      stroke="#0f172a"
      strokeWidth={1}
    />
  )
}

// ✅ Dot cho VN30
const CustomVN30Dot = (props: any) => {
  const { cx, cy, payload } = props
  if (!payload || cx === undefined || cy === undefined) return null
  const isWin = payload.VN30_label === 1
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={isWin ? '#22c55e' : '#94a3b8'}
      stroke="#0f172a"
      strokeWidth={1}
    />
  )
}

export default function AISignalHistoryChart() {
  const [data, setData] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      const { data, error } = await supabase
        .from('ai_market_signals')
        .select('date, index_code, confidence_score, label_win')
        .order('date', { ascending: true })
        .gte('date', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) // 14 ngày

      if (error || !data) {
        console.error('Lỗi khi lấy dữ liệu biểu đồ:', error)
        setData([])
        setLoading(false)
        return
      }

      const grouped: Record<string, ChartData> = {}

      data.forEach((row) => {
        if (!grouped[row.date]) grouped[row.date] = { date: row.date }

        grouped[row.date][row.index_code] = row.confidence_score
        grouped[row.date][`${row.index_code}_label`] = row.label_win
      })

      setData(Object.values(grouped))
      setLoading(false)
    }

    fetchData()
  }, [])

  if (loading) return <p className="text-slate-400">Đang tải biểu đồ...</p>
  if (!data.length) return <p className="text-slate-400">Không có dữ liệu.</p>

  return (
    <div className="w-full bg-slate-900 p-4 rounded-md border border-slate-700">
      <h2 className="text-white font-semibold mb-2">📈 Lịch sử Độ Tin Cậy AI</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="date" stroke="#cbd5e1" />
          <YAxis domain={[0, 1]} tick={{ fill: '#cbd5e1' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              color: '#f8fafc',
              fontSize: 13,
            }}
            labelStyle={{ color: '#f8fafc' }}
          />
          <Legend wrapperStyle={{ color: '#f1f5f9' }} />
          <Line
            type="monotone"
            dataKey="VNINDEX"
            stroke="#0ea5e9"
            strokeWidth={2}
            dot={<CustomVNINDEXDot />}
            name="VNINDEX"
          />
          <Line
            type="monotone"
            dataKey="VN30"
            stroke="#f97316"
            strokeWidth={2}
            dot={<CustomVN30Dot />}
            name="VN30"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
