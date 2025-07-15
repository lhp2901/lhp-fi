'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { cn } from '@/lib/utils'

type CategoryField =
  | 'volatility_tag'
  | 'volume_behavior'
  | 'market_sentiment'
  | 'trend_strength'
  | 'signal_type'

const CATEGORY_CONFIG: { field: CategoryField; label: string; icon: string }[] = [
  { field: 'volatility_tag', label: 'Biến động', icon: '🌪️' },
  { field: 'volume_behavior', label: 'Khối lượng', icon: '💸' },
  { field: 'market_sentiment', label: 'Tâm lý', icon: '🧠' },
  { field: 'trend_strength', label: 'Strength', icon: '📈' },
  { field: 'signal_type', label: 'Tín hiệu', icon: '📊' },
]

const COLORS = ['#38bdf8', '#f97316', '#facc15', '#4ade80', '#c084fc', '#a78bfa', '#f472b6', '#e879f9']

type RawSignal = {
  index_code: 'VNINDEX' | 'VN30'
} & {
  [key in CategoryField]: string | null
}

export default function SignalCategoryStats() {
  const [rawData, setRawData] = useState<RawSignal[]>([])
  const [loading, setLoading] = useState(true)
  const [indexFilter, setIndexFilter] = useState<'ALL' | 'VNINDEX' | 'VN30'>('ALL')
  const [days, setDays] = useState(30)
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar')

  useEffect(() => {
    const fetchData = async () => {
      const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('ai_market_signals')
        .select('index_code,volatility_tag,volume_behavior,market_sentiment,trend_strength,signal_type,date')
        .gte('date', since)

      if (error || !data) {
        console.error('❌ Lỗi khi lấy dữ liệu:', error)
        setRawData([])
      } else {
        setRawData(data as RawSignal[])
      }
      setLoading(false)
    }

    fetchData()
  }, [indexFilter, days])

  if (loading) return <p className="text-slate-400">Đang tải dữ liệu...</p>

  const filtered = rawData.filter((d) =>
    indexFilter === 'ALL' ? true : d.index_code === indexFilter
  )

  const grouped: Record<string, { name: string; category: string; value: number }> = {}

  for (const row of filtered) {
    for (const { field, label } of CATEGORY_CONFIG) {
      const raw = row[field]?.toLowerCase().trim() || 'khác'
      const key = `${label}: ${raw}`
      if (!grouped[key]) {
        grouped[key] = {
          name: key,
          category: label,
          value: 0,
        }
      }
      grouped[key].value += 1
    }
  }

  const finalData = Object.values(grouped)

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
        <h2 className="text-xl font-bold text-white">📊 Tổng hợp chỉ báo phân loại</h2>
        <div className="flex gap-2 flex-wrap">
          <select
            value={indexFilter}
            onChange={(e) => setIndexFilter(e.target.value as any)}
            className="bg-slate-800 text-white border border-slate-600 rounded px-3 py-1"
          >
            <option value="ALL">Tất cả</option>
            <option value="VNINDEX">VNINDEX</option>
            <option value="VN30">VN30</option>
          </select>

          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-slate-800 text-white border border-slate-600 rounded px-3 py-1"
          >
            <option value={7}>7 ngày</option>
            <option value={30}>30 ngày</option>
            <option value={90}>90 ngày</option>
          </select>

          <button
            onClick={() => setChartType((prev) => (prev === 'bar' ? 'pie' : 'bar'))}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-sm"
          >
            {chartType === 'bar' ? '🔁 PieChart' : '🔁 BarChart'}
          </button>
        </div>
      </div>

      <div className="h-[400px] bg-white/10 border border-white/20 rounded-xl p-4">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={finalData}>
              <XAxis dataKey="name" stroke="#cbd5e1" angle={-30} textAnchor="end" interval={0} />
              <YAxis stroke="#cbd5e1" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#fff' }}
              />
              <Legend wrapperStyle={{ color: '#cbd5e1' }} />
              <Bar dataKey="value">
                {finalData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <PieChart>
              <Pie
                data={finalData}
                cx="50%"
                cy="50%"
                outerRadius={130}
                fill="#8884d8"
                dataKey="value"
                nameKey="name"
                label
              >
                {finalData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#fff' }}
              />
              <Legend wrapperStyle={{ color: '#cbd5e1' }} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
