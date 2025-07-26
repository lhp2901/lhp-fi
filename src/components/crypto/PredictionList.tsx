'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { vi as viLocale } from 'date-fns/locale'

type Prediction = {
  id: number
  symbol: string
  timestamp: string
  prediction: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  model_name: string
  created_at: string
}

export default function PredictionList() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPredictions() {
      setLoading(true)
      setError(null)
      try {
        const { data, error } = await supabase
          .from('ai_predictions')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(20)

        if (error) throw error
        setPredictions(data as Prediction[])
      } catch (err: any) {
        setError(err.message || 'Lỗi không xác định')
      } finally {
        setLoading(false)
      }
    }

    fetchPredictions()
    const interval = setInterval(fetchPredictions, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return <p className="text-blue-600 animate-pulse">⏳ Đang tải tín hiệu AI...</p>
  if (error) return <p className="text-red-600 font-semibold">❌ {error}</p>

  const getSignalIcon = (signal: string) => {
    switch (signal) {
      case 'BUY':
        return '📈'
      case 'SELL':
        return '📉'
      case 'HOLD':
        return '⏸'
      default:
        return ''
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-lg">
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 dark:border-slate-700 rounded-lg overflow-hidden">
          <thead className="bg-gray-100 dark:bg-slate-800">
            <tr>
              <th className="p-3 text-left">Coin</th>
              <th className="p-3 text-left">Thời gian</th>
              <th className="p-3 text-left">Tín hiệu</th>
              <th className="p-3 text-left">Độ tin cậy</th>
              <th className="p-3 text-left">Model</th>
            </tr>
          </thead>
          <tbody>
            {predictions.map((p) => (
              <tr
                key={p.id}
                className="border-t border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all"
              >
                <td className="p-3 font-mono font-semibold">{p.symbol}</td>
                <td className="p-3 font-mono text-sm">
                  {formatDistanceToNow(new Date(p.timestamp), {
              addSuffix: true,
              locale: viLocale,
            })}
                </td>
                <td
                  className={`p-3 font-bold flex items-center gap-2 ${
                    p.prediction === 'BUY'
                      ? 'text-green-600'
                      : p.prediction === 'SELL'
                      ? 'text-red-500'
                      : 'text-gray-500'
                  }`}
                >
                  <span>{getSignalIcon(p.prediction)}</span>
                  {p.prediction}
                </td>
                <td className="p-3 font-mono text-sm" title="Độ tin cậy">
                  {(p.confidence * 100).toFixed(2)}%
                </td>
                <td className="p-3 font-mono text-sm text-blue-500" title="Tên mô hình">
                  {p.model_name}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
