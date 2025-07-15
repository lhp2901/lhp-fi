'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface AISignal {
  index_code: string
  date: string
  signal_type: string
  confidence_score: number
  volatility_tag?: string
  volume_behavior?: string
  model_version: string
  notes?: string
}

export default function AISignalPanel({ indexCode }: { indexCode: 'VNINDEX' | 'VN30' }) {
  const [aiSignal, setAiSignal] = useState<AISignal | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSignal = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('ai_market_signals')
        .select('*')
        .eq('index_code', indexCode)
        .order('date', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        console.error('Lỗi khi lấy tín hiệu AI:', error)
        setAiSignal(null)
      } else {
        setAiSignal(data)
      }

      setLoading(false)
    }

    fetchSignal()
  }, [indexCode])

  if (loading) return <p>Đang tải tín hiệu AI...</p>
  if (!aiSignal) return <p>Không có tín hiệu AI cho {indexCode}.</p>

  return (
    <div className="p-4 rounded-xl border border-white/20 bg-white/10 shadow-md space-y-2">
      <h2 className="text-lg font-semibold">
        🧠 Tín hiệu AI cho <span className="text-yellow-400">{indexCode}</span> – {aiSignal.date}
      </h2>
      <div className="space-y-1 text-sm">
        <p>
          <strong>📊 Xu hướng:</strong> {aiSignal.signal_type}
        </p>
        <p>
          <strong>🎯 Độ tin cậy:</strong> {(aiSignal.confidence_score * 100).toFixed(1)}%
        </p>
        {aiSignal.volatility_tag && (
          <p>
            <strong>🌪️ Biến động:</strong> {aiSignal.volatility_tag}
          </p>
        )}
        {aiSignal.volume_behavior && (
          <p>
            <strong>💸 Khối lượng:</strong> {aiSignal.volume_behavior}
          </p>
        )}
        <p>
          <strong>🧬 Mô hình AI:</strong> {aiSignal.model_version}
        </p>
        {aiSignal.notes && (
          <p>
            <strong>📝 Ghi chú:</strong> {aiSignal.notes}
          </p>
        )}
      </div>
    </div>
  )
}
