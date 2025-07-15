'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Signal {
  date: string
  index_code: string
  signal_type: string
  confidence_score: number
  volatility_tag?: string
  volume_behavior?: string
  model_version: string
  notes?: string
}

export default function AISignalTable() {
  const [data, setData] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState<'ALL' | 'VNINDEX' | 'VN30'>('ALL')

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      const query = supabase
        .from('ai_market_signals')
        .select('*')
        .order('date', { ascending: false })
        .limit(50)

      if (selectedIndex !== 'ALL') {
        query.eq('index_code', selectedIndex)
      }

      const { data, error } = await query

      if (error) {
        console.error('Lỗi khi lấy dữ liệu bảng tín hiệu AI:', error)
        setData([])
      } else {
        setData(data || [])
      }

      setLoading(false)
    }

    fetchData()
  }, [selectedIndex])

  return (
    <div className="space-y-4">
      {/* Bộ lọc */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Chọn chỉ số:</label>
        <select
          value={selectedIndex}
          onChange={(e) => setSelectedIndex(e.target.value as any)}
          className="bg-white text-black px-3 py-1 rounded-md"
        >
          <option value="ALL">Tất cả</option>
          <option value="VNINDEX">VNINDEX</option>
          <option value="VN30">VN30</option>
        </select>
      </div>

      {/* Bảng dữ liệu */}
      {loading ? (
        <p>Đang tải dữ liệu...</p>
      ) : data.length === 0 ? (
        <p>Không có tín hiệu nào.</p>
      ) : (
        <div className="overflow-auto rounded-md border border-white/10">
          <table className="min-w-full text-sm text-left text-white">
            <thead className="bg-white/10 text-slate-300">
              <tr>
                <th className="px-4 py-2">📅 Ngày</th>
                <th className="px-4 py-2">🧭 Chỉ số</th>
                <th className="px-4 py-2">📊 Tín hiệu</th>
                <th className="px-4 py-2">🎯 Độ tin cậy</th>
                <th className="px-4 py-2">🌪️ Biến động</th>
                <th className="px-4 py-2">💸 Khối lượng</th>
                <th className="px-4 py-2">🧬 Model</th>
                <th className="px-4 py-2">📝 Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {data.map((row, index) => (
                <tr key={index} className="hover:bg-white/5">
                  <td className="px-4 py-2">{row.date}</td>
                  <td className="px-4 py-2">{row.index_code}</td>
                  <td className="px-4 py-2">{row.signal_type}</td>
                  <td className="px-4 py-2">{(row.confidence_score * 100).toFixed(1)}%</td>
                  <td className="px-4 py-2">{row.volatility_tag || '-'}</td>
                  <td className="px-4 py-2">{row.volume_behavior || '-'}</td>
                  <td className="px-4 py-2">{row.model_version}</td>
                  <td className="px-4 py-2">{row.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
