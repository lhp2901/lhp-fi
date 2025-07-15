'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  DotProps,
} from 'recharts'

interface RawSignal {
  date: string
  index_code: 'VNINDEX' | 'VN30'
  signal_type: string
  confidence_score: number
  volatility_tag?: string
  volume_behavior?: string
  market_sentiment?: string
  rsi_score?: number
  volume_spike_ratio?: number
  trend_strength?: string
  notes?: string
}

type MergedSignal = {
  date: string
  [key: string]: any
}

// ✅ Custom DotProps mở rộng để fix lỗi payload
interface CustomDotProps extends DotProps {
  payload: any
}

export default function AISignalTrendChart() {
  const [data, setData] = useState<MergedSignal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      const { data, error } = await supabase
        .from('ai_market_signals')
        .select('*')
        .gte('date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
        .order('date', { ascending: true })

      if (error) {
        console.error('Lỗi khi lấy dữ liệu tín hiệu AI:', error)
        setData([])
      } else {
        const grouped: Record<string, MergedSignal> = {}

        data?.forEach((row: RawSignal) => {
          const key = row.date
          if (!grouped[key]) grouped[key] = { date: key }

          const prefix = row.index_code
          grouped[key][`${prefix}_confidence`] = row.confidence_score
          grouped[key][`${prefix}_sentiment`] = row.market_sentiment
          grouped[key][`${prefix}_signal`] = row.signal_type
          grouped[key][`${prefix}_rsi`] = row.rsi_score
          grouped[key][`${prefix}_spike`] = row.volume_spike_ratio
          grouped[key][`${prefix}_vol`] = row.volume_behavior
          grouped[key][`${prefix}_strength`] = row.trend_strength
        })

        setData(Object.values(grouped))
      }

      setLoading(false)
    }

    fetchData()
  }, [])

  const getColor = (sentiment: string | undefined) => {
    if (sentiment === 'tham lam') return '#4ade80'
    if (sentiment === 'sợ hãi') return '#f87171'
    return '#cbd5e1'
  }

  const renderDot = (indexCode: 'VNINDEX' | 'VN30') => (props: CustomDotProps) => {
    const { cx, cy, payload } = props
    const sentiment = payload[`${indexCode}_sentiment`]
    return (
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill={getColor(sentiment)}
        stroke="#000"
        strokeWidth={1}
      />
    )
  }

  const renderTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload
      return (
        <div className="bg-slate-800 text-sm text-white p-3 rounded-md border border-slate-600 space-y-1">
          <div>📅 {p.date}</div>

          {['VNINDEX', 'VN30'].map((idx) => (
            p[`${idx}_confidence`] !== undefined && (
              <div key={idx} className="pt-1 border-t border-slate-600">
                <div className="font-bold">🧭 {idx}</div>
                <div>📊 {p[`${idx}_signal`] ?? '-'}</div>
                <div>🎯 {(p[`${idx}_confidence`] * 100).toFixed(1)}%</div>
                <div>🌪️ {p[`${idx}_vol`] ?? '-'}</div>
                <div>📈 {p[`${idx}_strength`] ?? '-'}</div>
                <div>🧠 {p[`${idx}_sentiment`] ?? '-'}</div>
                <div>🌀 RSI: {p[`${idx}_rsi`] ?? '-'}</div>
                <div>💥 Spike: {p[`${idx}_spike`] ?? '-'}</div>
              </div>
            )
          ))}
        </div>
      )
    }
    return null
  }

  if (loading) return <p className="text-slate-400">Đang tải biểu đồ...</p>

  return (
    <div className="p-4 bg-slate-900 text-white rounded-xl shadow-lg">
   
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
          <XAxis dataKey="date" stroke="#cbd5e1" />
          <YAxis domain={[0.5, 1]} tick={{ fill: '#cbd5e1' }} />
          <Tooltip content={renderTooltip} />
          <Legend wrapperStyle={{ color: '#f1f5f9' }} />

          <Line
            type="monotone"
            dataKey="VNINDEX_confidence"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={renderDot('VNINDEX')}
            name="VNINDEX"
          />
          <Line
            type="monotone"
            dataKey="VN30_confidence"
            stroke="#f97316"
            strokeWidth={2}
            dot={renderDot('VN30')}
            name="VN30"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
