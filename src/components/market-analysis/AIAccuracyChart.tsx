'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface AccuracyLog {
  date: string
  index_code: string
  accuracy: number
}

export default function AIAccuracyChart() {
  const [data, setData] = useState<AccuracyLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAccuracyLogs = async () => {
      const { data, error } = await supabase
        .from('ai_accuracy_logs')
        .select('date, index_code, accuracy')
        .order('date', { ascending: true })

      if (error) {
        console.error('Lỗi tải dữ liệu accuracy:', error.message)
        return
      }

      setData(data || [])
      setLoading(false)
    }

    fetchAccuracyLogs()
  }, [])

  // Chuẩn hóa dữ liệu theo ngày để kết hợp VNINDEX & VN30 trên cùng trục
  const mergedData = Object.values(
    data.reduce((acc: any, row) => {
      const key = row.date
      if (!acc[key]) acc[key] = { date: row.date }
      acc[key][row.index_code] = +(row.accuracy * 100).toFixed(1)
      return acc
    }, {})
  )

  return (
    <div className="w-full h-[400px]">
      {loading ? (
        <p className="text-sm text-slate-300 italic">⏳ Đang tải dữ liệu độ chính xác AI...</p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={mergedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="date" stroke="#ccc" />
            <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} stroke="#ccc" />
            <Tooltip formatter={(value) => `${value}%`} />
            <Legend />
            <Line
              type="monotone"
              dataKey="VNINDEX"
              stroke="#4ade80"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="VNINDEX"
            />
            <Line
              type="monotone"
              dataKey="VN30"
              stroke="#60a5fa"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="VN30"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
