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

const CATEGORY_CONFIG = [
  { field: 'volatility_tag', label: 'Biến động', icon: '🌪️', color: '#60a5fa' },
  { field: 'volume_behavior', label: 'Khối lượng', icon: '💸', color: '#facc15' },
  { field: 'market_sentiment', label: 'Tâm lý', icon: '🧠', color: '#c084fc' },
  { field: 'trend_strength', label: 'Strength', icon: '📈', color: '#4ade80' },
  { field: 'signal_type', label: 'Tín hiệu', icon: '📊', color: '#fb923c' },
]

const COLOR_DETAIL_MAP: Record<string, string> = {
  // Biến động
  'tăng': '#60a5fa',
  'giảm': '#2563eb',
  'đi ngang': '#1e3a8a',

  // Khối lượng
  'cao (kl)': '#facc15',
  'thấp (kl)': '#fde047',
  'trung bình (kl)': '#ca8a04',

  // Tâm lý
  'tích cực': '#c084fc',
  'tiêu cực': '#9333ea',
  'trung lập': '#6b21a8',

  // Strength
  'mạnh': '#4ade80',
  'yếu': '#22c55e',
  'trung bình (s)': '#15803d',

  // Tín hiệu
  'mua': '#fb923c',
  'bán': '#f97316',
  'giữ': '#c2410c',
  'khác': '#64748b',
}

export default function SignalCategoryStats() {
  const [rawData, setRawData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [indexFilter, setIndexFilter] = useState<'ALL' | 'VNINDEX' | 'VN30'>('ALL')
  const [days, setDays] = useState(30)
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar')
  const [activeGroup, setActiveGroup] = useState<string | null>(null)

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
        setRawData(data)
      }
      setLoading(false)
    }

    fetchData()
  }, [indexFilter, days])

  if (loading) return <p className="text-slate-400">Đang tải dữ liệu...</p>

  const filtered = rawData.filter((d) =>
    indexFilter === 'ALL' ? true : d.index_code === indexFilter
  )

  const grouped: Record<string, { name: string; category: string; label: string; value: number }> = {}

  for (const row of filtered) {
    for (const { field, label } of CATEGORY_CONFIG) {
      const raw = row[field]?.toLowerCase().trim() || 'khác'
      if (activeGroup && label !== activeGroup) continue
      const key = `${label}: ${raw}`
      if (!grouped[key]) {
        grouped[key] = {
          name: raw,
          category: label,
          label: `${label}: ${raw}`,
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

      <div className="flex gap-4 flex-wrap">
        {CATEGORY_CONFIG.map((cat) => (
          <button
            key={cat.label}
            onClick={() => setActiveGroup(activeGroup === cat.label ? null : cat.label)}
            className={`text-sm px-2 py-1 rounded text-white ${activeGroup === cat.label ? 'ring-2 ring-white bg-opacity-80' : ''}`}
            style={{ backgroundColor: cat.color }}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      <div className="h-[400px] bg-white/10 border border-white/20 rounded-xl p-4">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={finalData} layout="vertical">
              <XAxis type="number" stroke="#cbd5e1" />
              <YAxis type="category" dataKey="label" stroke="#cbd5e1" width={200} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#fff' }}
              />
              <Legend wrapperStyle={{ color: '#cbd5e1' }} />
              <Bar dataKey="value">
                {finalData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLOR_DETAIL_MAP[entry.name] || '#8884d8'}
                  />
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
                nameKey="label"
                label
              >
                {finalData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLOR_DETAIL_MAP[entry.name] || '#8884d8'}
                  />
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
