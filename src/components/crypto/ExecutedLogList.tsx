'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { vi as viLocale } from 'date-fns/locale'

type TradingLog = {
  id: string
  symbol: string
  action: 'BUY' | 'SELL'
  price: number
  qty: number
  tp?: number
  sl?: number
  high?: number
  low?: number
  current_price?: number
  executed_at: string
  predicted_by: string
  prediction_id: string
  notes: string
  created_at: string
}

export default function ExecutedLogList() {
  const [logs, setLogs] = useState<TradingLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true)
      setError(null)
      try {
        const { data, error } = await supabase
          .from('trading_logs')
          .select('*')
          .order('executed_at', { ascending: false })
          .limit(20)

        if (error) throw error
        setLogs(data as TradingLog[])
      } catch (err: any) {
        setError(err.message || 'Lỗi không xác định')
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
    const interval = setInterval(fetchLogs, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return <p>📡 Đang tải lịch sử giao dịch...</p>
  if (error) return <p className="text-red-500">❌ {error}</p>

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-md mt-8 overflow-x-auto">
      <table className="min-w-full border border-gray-300 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
      <thead className="bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200">
          <tr>
            <th className="p-3 text-left">Coin</th>
            <th className="p-3 text-left">Thời gian</th>
            <th className="p-3 text-left">Lệnh</th>
            <th className="p-3 text-left">Giá vào</th>
            <th className="p-3 text-left">TP</th>
            <th className="p-3 text-left">SL</th>
            <th className="p-3 text-left">Hiện tại</th>
            <th className="p-3 text-left">Đỉnh</th>
            <th className="p-3 text-left">Đáy</th>
            <th className="p-3 text-left">Số lượng</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-100">
          {logs.map((log) => (
            <tr
              key={log.id}
              className="border-t border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
            >
              <td className="p-3 font-mono">{log.symbol}</td>
              <td className="p-3 font-mono text-xs text-gray-500">
                {formatDistanceToNow(new Date(log.executed_at), {
                  addSuffix: true,
                  locale: viLocale,
                })}
              </td>
              <td
                className={`p-3 font-bold ${
                  log.action === 'BUY' ? 'text-green-600' : 'text-red-500'
                }`}
              >
                {log.action}
              </td>
              <td className="p-3 font-mono">{log.price?.toFixed(3)}</td>
              <td className="p-3 font-mono text-green-600">
                {log.tp?.toFixed(3) ?? '-'}
              </td>
              <td className="p-3 font-mono text-red-500">
                {log.sl?.toFixed(3) ?? '-'}
              </td>
              <td className="p-3 font-mono">{log.current_price?.toFixed(3) ?? '-'}</td>
              <td className="p-3 font-mono">{log.high?.toFixed(3) ?? '-'}</td>
              <td className="p-3 font-mono">{log.low?.toFixed(3) ?? '-'}</td>
              <td className="p-3 font-mono">{log.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
