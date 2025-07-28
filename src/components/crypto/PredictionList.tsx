'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { vi as viLocale } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import clsx from 'clsx'

// Type
interface Prediction {
  id: number
  symbol: string
  timestamp: string
  prediction: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  model_name: string
  created_at: string
  entry_price: number
  tp: number
  sl: number
  current_price: number
  high: number
  low: number
}

export default function PredictionList() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [expandedRow, setExpandedRow] = useState<number | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'BUY' | 'SELL' | 'HOLD'>('ALL')

  const fetchPredictions = async () => {
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

  useEffect(() => {
    fetchPredictions()
    const interval = setInterval(fetchPredictions, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleRunAI = async () => {
    setRunning(true)
    setLogs(['🚀 Đang kích hoạt AI RUN NOW...'])
    try {
      setLogs((prev) => [...prev, '📡 Đang lấy dữ liệu từ Bybit...'])
      await axios.post('/api/crypto/fetch-bybit')
      setLogs((prev) => [...prev, '⚡ Đã lấy xong dữ liệu!'])

      setLogs((prev) => [...prev, '🤖 Đang sinh tín hiệu AI...'])
      await axios.post('/api/crypto/run-daily')
      setLogs((prev) => [...prev, '✅ Đã hoàn tất AI!'])

      fetchPredictions()
    } catch (err) {
      setLogs((prev) => [...prev, '❌ Lỗi khi chạy AI'])
    } finally {
      setRunning(false)
    }
  }

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

  const getModelBadgeClass = (model: string) => {
    return clsx(
      'px-2 py-1 text-xs rounded-lg font-mono',
      model.includes('LSTM') && 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
      model.includes('XGB') && 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      model.includes('CNN') && 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
    )
  }

  const filteredPredictions = filter === 'ALL'
    ? predictions
    : predictions.filter((p) => p.prediction === filter)

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-md mt-8 overflow-x-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">🔮 Tín hiệu AI</h2>
        <button
          onClick={handleRunAI}
          disabled={running}
          className={clsx(
            'px-4 py-2 rounded-xl font-semibold text-white shadow-md transition-all duration-300',
            'bg-gradient-to-r from-pink-500 to-yellow-500 hover:from-yellow-500 hover:to-pink-500',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          🚀 {running ? 'Đang chạy...' : 'AI RUN NOW'}
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {['ALL', 'BUY', 'SELL', 'HOLD'].map((key) => (
          <Button
            key={key}
            onClick={() => setFilter(key as any)}
            variant={filter === key ? 'default' : 'outline'}
          >
            {key}
          </Button>
        ))}
      </div>

      {logs.length > 0 && (
        <div className="bg-slate-100 dark:bg-slate-800 text-sm rounded-lg p-3 mb-4 max-h-40 overflow-y-auto font-mono">
          {logs.map((log, i) => (
            <p key={i} className="text-blue-600 dark:text-blue-300">
              {log}
            </p>
          ))}
        </div>
      )}

      {loading && <p className="text-blue-600 animate-pulse">⏳ Đang tải tín hiệu AI...</p>}
      {error && <p className="text-red-600 font-semibold">❌ {error}</p>}

      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
        <thead className="bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200">
            <tr>
              <th className="p-3 text-left">Coin</th>
              <th className="p-3 text-left">Thời gian</th>
              <th className="p-3 text-left">Tín hiệu</th>
              <th className="p-3 text-left">Độ tin cậy</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-100">
            {filteredPredictions.map((p, index) => (
              <>
                <motion.tr
                  key={p.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="border-t border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                  onClick={() => setExpandedRow(expandedRow === p.id ? null : p.id)}
                >
                  <td className="p-3 font-mono font-semibold">{p.symbol}</td>
                  <td className="p-3 font-mono text-sm">
                    {formatDistanceToNow(new Date(p.timestamp), {
                      addSuffix: true,
                      locale: viLocale,
                    })}
                  </td>
                  <td className={clsx(
                    'p-3 font-bold flex items-center gap-2',
                    p.prediction === 'BUY' && 'text-green-600',
                    p.prediction === 'SELL' && 'text-red-500',
                    p.prediction === 'HOLD' && 'text-gray-500')}
                  >
                    <span>{getSignalIcon(p.prediction)}</span>
                    {p.prediction}
                  </td>
                  <td className="p-3 font-mono text-sm">{(p.confidence * 100).toFixed(2)}%</td>
                </motion.tr>

                <AnimatePresence>
                  {expandedRow === p.id && (
                    <motion.tr
                      key={`expand-${p.id}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-slate-100 dark:bg-slate-800"
                    >
                      <td colSpan={4} className="p-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm font-mono">
                          <div>🎯 Entry Price: <strong className="text-blue-600">{p.entry_price}</strong></div>
                          <div>🛑 Stop Loss: <strong className="text-red-600">{p.sl}</strong></div>
                          <div>🎯 Take Profit: <strong className="text-green-600">{p.tp}</strong></div>
                          <div>📈 High (50 nến): <strong>{p.high}</strong></div>
                          <div>📉 Low (50 nến): <strong>{p.low}</strong></div>
                          <div>💰 Giá hiện tại: <strong>{p.current_price}</strong></div>
                        </div>
                      </td>
                    </motion.tr>
                  )}
                </AnimatePresence>
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}