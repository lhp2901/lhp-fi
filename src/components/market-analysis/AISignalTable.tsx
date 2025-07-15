'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, subDays, subWeeks, subMonths } from 'date-fns'

interface Signal {
  date: string
  index_code: string
  signal_type: string
  confidence_score: number
  volatility_tag?: string
  volume_behavior?: string
  notes?: string
  market_sentiment?: string
  rsi_score?: number
  volume_spike_ratio?: number
  trend_strength?: string
  momentum?: number
  macd_signal?: string
  bollinger_band?: string
  foreign_flow?: number
}

type TimeRange = 'today' | 'week' | 'month' | 'custom'

export default function AISignalTable() {
  const [data, setData] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState<'ALL' | 'VNINDEX' | 'VN30'>('ALL')
  const [timeRange, setTimeRange] = useState<TimeRange>('week')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [limit, setLimit] = useState(10)

  const fetchData = async () => {
    setLoading(true)

    let query = supabase
      .from('ai_market_signals')
      .select('*')
      .order('date', { ascending: false })

    if (selectedIndex !== 'ALL') {
      query = query.eq('index_code', selectedIndex)
    }

    // Lọc thời gian
    let start: string | undefined
    let end: string = format(new Date(), 'yyyy-MM-dd')

    if (timeRange === 'today') {
      start = format(new Date(), 'yyyy-MM-dd')
    } else if (timeRange === 'week') {
      start = format(subWeeks(new Date(), 1), 'yyyy-MM-dd')
    } else if (timeRange === 'month') {
      start = format(subMonths(new Date(), 1), 'yyyy-MM-dd')
    } else if (timeRange === 'custom' && fromDate && toDate) {
      start = fromDate
      end = toDate
    }

    if (start) query = query.gte('date', start).lte('date', end)

    query = query.limit(limit)

    const { data, error } = await query

    if (error) {
      console.error('❌ Lỗi khi lấy dữ liệu bảng tín hiệu AI:', error)
      setData([])
    } else {
      setData(data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [selectedIndex, timeRange, fromDate, toDate, limit])

  return (
    <div className="space-y-4 text-white">
      {/* Bộ lọc */}
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="text-sm font-medium">Chọn chỉ số:</label>
          <select
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(e.target.value as any)}
            className="ml-2 bg-slate-900 border border-slate-600 text-white px-3 py-1 rounded-md"
          >
            <option value="ALL">Tất cả</option>
            <option value="VNINDEX">VNINDEX</option>
            <option value="VN30">VN30</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">Thời gian:</label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="ml-2 bg-slate-900 border border-slate-600 text-white px-3 py-1 rounded-md"
          >
            <option value="today">Hôm nay</option>
            <option value="week">7 ngày</option>
            <option value="month">30 ngày</option>
            <option value="custom">Tuỳ chọn</option>
          </select>
        </div>

        {timeRange === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-slate-900 border border-slate-600 text-white px-2 py-1 rounded-md"
            />
            <span>→</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-slate-900 border border-slate-600 text-white px-2 py-1 rounded-md"
            />
          </div>
        )}
      </div>

      {/* Bảng dữ liệu */}
      {loading ? (
        <p className="text-slate-400">Đang tải dữ liệu...</p>
      ) : data.length === 0 ? (
        <p className="text-slate-400">Không có tín hiệu nào.</p>
      ) : (
        <>
          <div className="overflow-auto rounded-md border border-white/10 max-h-[600px]">
            <table className="min-w-full text-sm text-left text-white bg-slate-800">
              <thead className="bg-white/10 text-slate-300">
                <tr>
                  <th className="px-4 py-2">📅 Ngày</th>
                  <th className="px-4 py-2">🧭 Chỉ số</th>
                  <th className="px-4 py-2">📊 Tín hiệu</th>
                  <th className="px-4 py-2">🎯 Tin cậy</th>
                  <th className="px-4 py-2">🌪️ Biến động</th>
                  <th className="px-4 py-2">💸 Khối lượng</th>
                  <th className="px-4 py-2">🧠 Tâm lý</th>
                  <th className="px-4 py-2">🌀 RSI</th>
                  <th className="px-4 py-2">💥 Spike</th>
                  <th className="px-4 py-2">📈 Strength</th>
                  <th className="px-4 py-2">🚀 Momentum</th>
                  <th className="px-4 py-2">📉 MACD</th>
                  <th className="px-4 py-2">📊 Bollinger</th>
                  <th className="px-4 py-2">💰 Dòng tiền NN</th>
                  <th className="px-4 py-2">📝 Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.map((row, index) => {
                  let sentimentColor = 'text-slate-300'
                  if (row.market_sentiment === 'tham lam') sentimentColor = 'text-green-400'
                  if (row.market_sentiment === 'sợ hãi') sentimentColor = 'text-red-400'
                  if (row.market_sentiment === 'trung lập') sentimentColor = 'text-yellow-300'

                  return (
                    <tr key={index} className="hover:bg-white/5">
                      <td className="px-4 py-2">{row.date}</td>
                      <td className="px-4 py-2">{row.index_code}</td>
                      <td className="px-4 py-2">{row.signal_type}</td>
                      <td className="px-4 py-2">{(row.confidence_score * 100).toFixed(1)}%</td>
                      <td className="px-4 py-2">{row.volatility_tag || '-'}</td>
                      <td className="px-4 py-2">{row.volume_behavior || '-'}</td>
                      <td className={`px-4 py-2 font-semibold ${sentimentColor}`}>
                        {row.market_sentiment === 'tham lam' && '😎 Tham lam'}
                        {row.market_sentiment === 'sợ hãi' && '😨 Sợ hãi'}
                        {row.market_sentiment === 'trung lập' && '🧠 Trung lập'}
                        {!row.market_sentiment && '-'}
                      </td>
                      <td className="px-4 py-2">{row.rsi_score ?? '-'}</td>
                      <td className="px-4 py-2">{row.volume_spike_ratio ?? '-'}</td>
                      <td className="px-4 py-2">{row.trend_strength || '-'}</td>
                      <td className="px-4 py-2">{row.momentum ?? '-'}</td>
                      <td className="px-4 py-2">{row.macd_signal || '-'}</td>
                      <td className="px-4 py-2">{row.bollinger_band || '-'}</td>
                      <td className="px-4 py-2">{row.foreign_flow ?? '-'} (tỷ)</td>
                      <td className="px-4 py-2">{row.notes || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="text-center pt-4">
            <button
              onClick={() => setLimit(limit + 10)}
              className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-md text-white border border-white/20"
            >
              Tải thêm
            </button>
          </div>
        </>
      )}
    </div>
  )
}
