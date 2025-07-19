'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, subDays } from 'date-fns'
import { vi } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import { Tooltip } from 'react-tooltip'

interface MarketSignal {
  date: string
  signal_type: string
  market_sentiment: string
  confidence_score: number
  rsi_score: number
  volume_spike_ratio: number
  trend_strength: string
  momentum: number
  macd_signal: string
  bollinger_band: string
  foreign_flow: number
  index: string
}

const sentimentMap: Record<string, { icon: string; label: string; animation: string }> = {
  bullish: { icon: '📈', label: 'Lạc quan', animation: '🎉' },
  bearish: { icon: '📉', label: 'Bi quan', animation: '💥' },
  neutral: { icon: '😐', label: 'Trung lập', animation: '🤔' },
}

export default function MarketMoodCardUltra() {
  const [signal, setSignal] = useState<MarketSignal | null>(null)
  const [history, setHistory] = useState<MarketSignal[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
const fetchData = async () => {
  try {
    // 1. Lấy ngày mới nhất có trong bảng
    const { data: latestDateRow, error: dateError } = await supabase
      .from('ai_market_signals')
      .select('date')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (dateError || !latestDateRow?.date) {
      setLoading(false)
      return
    }

    const latestDate = latestDateRow.date

    // 2. Lấy tất cả tín hiệu trong ngày đó (VNINDEX & VN30)
    const { data: signalsToday, error: signalError } = await supabase
      .from('ai_market_signals')
      .select('*')
      .eq('date', latestDate)

    if (signalError || !signalsToday || signalsToday.length === 0) {
      setLoading(false)
      return
    }

    // 3. Trọng số ưu tiên VNINDEX: toàn thị trường > VN30: nhóm trụ
    const weights: Record<string, number> = {
      VNINDEX: 0.7,
      VN30: 0.3
    }

    const indexVN = signalsToday.find(s => s.index_code === 'VNINDEX')
    const index30 = signalsToday.find(s => s.index_code === 'VN30')

    // 4. Fallback thông minh nếu thiếu 1 trong 2 chỉ số
    const validVN = indexVN || index30
    const valid30 = index30 || indexVN

    const w1 = weights[validVN.index_code] || 0.5
    const w2 = weights[valid30.index_code] || 0.5

    // 5. Gộp các chỉ báo kỹ thuật theo trọng số
    const mergedSignal: MarketSignal = {
      index: 'merged',
      date: latestDate,
      signal_type:
        validVN.confidence_score > valid30.confidence_score
          ? validVN.signal_type
          : valid30.signal_type,
      market_sentiment:
        validVN.confidence_score > valid30.confidence_score
          ? validVN.market_sentiment
          : valid30.market_sentiment,
      confidence_score:
        parseFloat((validVN.confidence_score * w1 + valid30.confidence_score * w2).toFixed(2)),
      rsi_score:
        parseFloat((validVN.rsi_score * w1 + valid30.rsi_score * w2).toFixed(2)),
      volume_spike_ratio:
        parseFloat((validVN.volume_spike_ratio * w1 + valid30.volume_spike_ratio * w2).toFixed(2)),
      trend_strength:
        validVN.trend_strength.length >= valid30.trend_strength.length
          ? validVN.trend_strength
          : valid30.trend_strength,
      momentum:
        parseFloat((validVN.momentum * w1 + valid30.momentum * w2).toFixed(2)),
      macd_signal:
        validVN.macd_signal.length >= valid30.macd_signal.length
          ? validVN.macd_signal
          : valid30.macd_signal,
      bollinger_band:
        validVN.bollinger_band.length >= valid30.bollinger_band.length
          ? validVN.bollinger_band
          : valid30.bollinger_band,
      foreign_flow:
        parseFloat((validVN.foreign_flow * w1 + valid30.foreign_flow * w2).toFixed(2))
    }

    // 6. Lấy lịch sử 7 ngày gần nhất
    const weekAgo = format(subDays(new Date(latestDate), 7), 'yyyy-MM-dd')
    const { data: historyData } = await supabase
      .from('ai_market_signals')
      .select('*')
      .gte('date', weekAgo)
      .lte('date', latestDate)
      .order('date', { ascending: false })

    setSignal(mergedSignal)
    if (historyData) setHistory(historyData)
  } catch (err) {
    console.error('Lỗi fetchData:', err)
  } finally {
    setLoading(false)
  }
}
    fetchData()
  }, [])

  const getCardStyle = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case 'bullish':
        return 'bg-green-50 border-green-300 text-green-900'
      case 'bearish':
        return 'bg-red-50 border-red-300 text-red-900'
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800'
    }
  }

  if (loading) return <p className="text-sm text-gray-400">Đang phân tích AI...</p>
  if (!signal) return <p className="text-sm text-gray-500">Không có dữ liệu thị trường hôm nay.</p>

  const sentimentData = sentimentMap[signal.market_sentiment.toLowerCase()] || {
    icon: '🧐',
    label: 'Không rõ',
    animation: '',
  }

  const dayLabel = format(new Date(signal.date), 'EEEE', { locale: vi })
  const dateLabel = format(new Date(signal.date), 'd/M/yyyy')

  return (
    <div>
    <AnimatePresence>
        <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className={`p-6 rounded-2xl shadow-2xl max-w-lg mx-auto mt-6 border-2 border-white/10 
            bg-gradient-to-br from-[#1e293b] to-[#334155] text-white ${getCardStyle(signal.market_sentiment)}`}
        >
        <div className="text-center relative">
            {signal.signal_type.toLowerCase() === 'breakout' && (
            <motion.div
                className="absolute top-[-20px] left-1/2 -translate-x-1/2 text-3xl"
                initial={{ scale: 0, rotate: 0 }}
                animate={{ scale: [0, 1.2, 1], rotate: [0, 360] }}
                transition={{ duration: 1 }}
            >
                🎆🎉
            </motion.div>
            )}

            <h2 className="text-2xl font-bold mb-2 text-yellow-300 drop-shadow-md">
            {sentimentData.icon}{' '}
            <span className="uppercase text-green-400">{signal.signal_type}</span>{' '}
            {sentimentData.animation}
            </h2>

            <p className="text-sm mb-1 text-blue-300">
            📅 {dayLabel} – {dateLabel}
            </p>

            <p className="text-sm mb-2">
            Độ tin cậy:{' '}
            <strong
                className={`${
                signal.confidence_score >= 0.75
                    ? 'text-green-400'
                    : signal.confidence_score >= 0.6
                    ? 'text-yellow-400'
                    : 'text-red-400'
                }`}
            >
                {(signal.confidence_score * 100).toFixed(1)}%
            </strong>
            </p>

        <div className="border border-white/30 rounded-xl p-3 bg-white/5 backdrop-blur-sm">
        <p className="text-sm font-medium text-purple-300">
          Cảm xúc thị trường: <span className="font-semibold">{sentimentData.label}</span>
        </p>
      </div>
          </div>

          <div className="mt-4 text-sm space-y-1">
            <p data-tooltip-id="rsi" className="text-amber-500">
                🔬 RSI: {signal.rsi_score?.toFixed(2)}
            </p>
            <p data-tooltip-id="volume" className="text-blue-500">
                💥 Volume Spike: {signal.volume_spike_ratio?.toFixed(2)}
            </p>
            <p data-tooltip-id="trend" className="text-green-600">
                📊 Trend Strength: {signal.trend_strength}
            </p>
            <p data-tooltip-id="momentum" className="text-purple-500">
                ⚡ Momentum: {signal.momentum?.toFixed(2)}
            </p>
            <p data-tooltip-id="macd" className={
                signal.macd_signal.toLowerCase() === 'tăng'
                ? 'text-green-500'
                : signal.macd_signal.toLowerCase() === 'giảm'
                ? 'text-red-500'
                : 'text-gray-600'
            }>
                📉 MACD: {signal.macd_signal}
            </p>
            <p data-tooltip-id="bollinger" className={
                signal.bollinger_band.toLowerCase() === 'mở rộng'
                ? 'text-amber-600'
                : signal.bollinger_band.toLowerCase() === 'thu hẹp'
                ? 'text-blue-400'
                : 'text-gray-600'
            }>
                🎯 Bollinger: {signal.bollinger_band}
            </p>
            <p data-tooltip-id="foreign" className={
                signal.foreign_flow > 0
                ? 'text-green-600'
                : signal.foreign_flow < 0
                ? 'text-red-600'
                : 'text-gray-600'
            }>
                🌍 Dòng tiền NN: {signal.foreign_flow?.toFixed(2)}
            </p>
            </div>

          <div className="mt-4 text-center">
            <button
              className="text-xs underline text-blue-600"
              onClick={() => setShowHistory((prev) => !prev)}
            >
              {showHistory ? 'Ẩn lịch sử tuần' : '🕰 Xem lịch sử tuần'}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      {showHistory && (
        <div className="max-w-lg mx-auto mt-4 bg-[#1e293b] p-4 rounded-xl shadow text-sm border border-white/10">
            <h3 className="font-semibold mb-2 text-white">📚 Lịch sử tuần gần đây</h3>
            <ul className="divide-y divide-white/10">
                {history.map((item) => {
                const score = item.confidence_score * 100;
                const scoreColor =
                    score >= 75 ? 'text-green-400' :
                    score >= 60 ? 'text-yellow-400' :
                    'text-red-400';

                const signalColor =
                    item.signal_type.toLowerCase().includes('tăng') ? 'text-green-500' :
                    item.signal_type.toLowerCase().includes('giảm') ? 'text-red-500' :
                    'text-blue-400';

                return (
                    <li key={item.date} className="py-1 flex justify-between text-white">
                    <span className="text-blue-300">
                        {format(new Date(item.date), 'dd/MM')}
                    </span>
                    <span className={`font-medium ${signalColor}`}>
                        {item.signal_type}
                    </span>
                    <span className={`font-semibold ${scoreColor}`}>
                        {score.toFixed(0)}%
                    </span>
                    </li>
                );
                })}
            </ul>
            </div>

      )}

      {/* Tooltip cho các chỉ báo */}
      <Tooltip id="rsi" content="RSI – Chỉ báo quá mua/quá bán (trên 70 là quá mua, dưới 30 là quá bán)" />
      <Tooltip id="volume" content="Volume Spike – Tăng đột biến khối lượng giao dịch so với trung bình" />
      <Tooltip id="trend" content="Trend Strength – Mức độ mạnh/yếu của xu hướng" />
      <Tooltip id="momentum" content="Momentum – Đà tăng/giảm động lượng giá" />
      <Tooltip id="macd" content="MACD – Chỉ báo giao cắt động lượng" />
      <Tooltip id="bollinger" content="Bollinger Band – Vị trí giá trong dải biến động" />
      <Tooltip id="foreign" content="Dòng tiền nước ngoài – Mức mua/bán ròng của nhà đầu tư ngoại" />
    </div>
  )
}
