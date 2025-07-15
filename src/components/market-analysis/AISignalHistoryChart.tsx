'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer } from 'recharts'
import { supabase } from '@/lib/supabase'

type SignalData = {
  date: string
  index_code: 'VNINDEX' | 'VN30'
  confidence_score: number
}

export default function AISignalHistoryChart() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      const { data, error } = await supabase
        .from('ai_market_signals')
        .select('date, index_code, confidence_score')
        .order('date', { ascending: true })
        .gte('date', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) // last 14 days

      if (error) {
        console.error('Lỗi khi lấy dữ liệu biểu đồ:', error)
        setData([])
      } else {
        // Chuyển thành định dạng { date: '2025-07-10', VNINDEX: 0.8, VN30: 0.7 }
        const grouped: Record<string, any> = {}

        data.forEach((row: SignalData) => {
          if (!grouped[row.date]) grouped[row.date] = { date: row.date }
          grouped[row.date][row.index_code] = row.confidence_score
        })

        setData(Object.values(grouped))
      }

      setLoading(false)
    }

    fetchData()
  }, [])

  if (loading) return <p>Đang tải biểu đồ...</p>
  if (!data.length) return <p>Không có dữ liệu để hiển thị.</p>

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#444" />
        <XAxis dataKey="date" stroke="#ccc" />
        <YAxis domain={[0, 1]} tick={{ fill: '#ccc' }} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="VNINDEX" stroke="#00e5ff" strokeWidth={2} dot />
        <Line type="monotone" dataKey="VN30" stroke="#ff9100" strokeWidth={2} dot />
      </LineChart>
    </ResponsiveContainer>
  )
}
