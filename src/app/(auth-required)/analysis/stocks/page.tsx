'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import BasicAnalysisPanel from '@/components/stocks/BasicAnalysisPanel'
import AIAnalysisPanel from '@/components/stocks/AIAnalysisPanel'
import PortfolioTable from '@/components/stocks/PortfolioTable'
import StockAIChart from '@/components/stocks/StockAIChart'
import type { PortfolioItem } from '@/components/stocks/PortfolioTable'

export default function AnalysisPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [symbol, setSymbol] = useState('')
  const [symbols, setSymbols] = useState<string[]>([])
  const [tab, setTab] = useState<'basic' | 'ai' | 'chart'>('basic')
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
  const [portfolioDate, setPortfolioDate] = useState('')
  const [loadingPortfolio, setLoadingPortfolio] = useState(true)
  const [aiOutdated, setAiOutdated] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        console.error('❌ Không xác định được user:', error?.message)
        return
      }

      setUserId(user.id)

      const { data, error: symbolErr } = await supabase
        .from('stock_entries')
        .select('symbol')
       // .eq('user_id', user.id)
        .neq('symbol', null)

      if (symbolErr) {
        console.error('❌ Lỗi lấy danh sách mã:', symbolErr.message)
      } else if (data) {
        const unique = Array.from(new Set(data.map((item) => item.symbol)))
        setSymbols(unique)
        if (!symbol && unique.length > 0) setSymbol(unique[0])
      }

      try {
        const res = await fetch(`/api/portfolio?userId=${user.id}`)
        const json = await res.json()
        if (res.ok) {
          setPortfolio(json.portfolio)
          setPortfolioDate(json.date)

          // 🔍 Kiểm tra ngày dữ liệu AI
          const today = new Date()
          const aiDate = new Date(json.date)
          const diffDays = Math.floor((+today - +aiDate) / 86400000)
          if (diffDays > 3) setAiOutdated(true)
        } else {
          console.warn('⚠️ Lỗi response từ API portfolio:', json)
        }
      } catch (err) {
        console.error('❌ Lỗi kết nối đến API portfolio:', err)
      } finally {
        setLoadingPortfolio(false)
      }
    }

    init()
  }, [])

  return (
    <div className="min-h-screen w-full px-4 md:px-8 py-6 space-y-6 bg-gradient-to-b from-black to-slate-900 text-white">
      <div className="text-right items-center mb-6">        
        {portfolioDate && (
          <span className="text-sm text-gray-300">Dữ liệu ngày: {new Date(portfolioDate).toLocaleDateString('vi-VN')}</span>
        )}
      </div>

      {aiOutdated && (
        <div className="bg-red-500 text-white text-center px-4 py-2 rounded shadow animate-pulse font-bold">
          📣 Cảnh báo: Dữ liệu AI đã quá 3 ngày. Có thể cần cập nhật lại!
        </div>
      )}

      <div className="flex items-center space-x-4 mb-4">
        <label className="text-sm font-medium">Chọn cổ phiếu:</label>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="px-4 py-2 bg-white text-black rounded border border-gray-400 shadow"
        >
          {symbols.map((sym) => (
            <option key={sym} value={sym}>{sym}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2 sm:gap-4 mb-6">
        <Button variant={tab === 'basic' ? 'default' : 'outline'} onClick={() => setTab('basic')}>
          Phân tích cơ bản
        </Button>
        <Button variant={tab === 'ai' ? 'default' : 'outline'} onClick={() => setTab('ai')}>
          Phân tích AI
        </Button>
        <Button variant={tab === 'chart' ? 'default' : 'outline'} onClick={() => setTab('chart')}>
          Biểu đồ AI
        </Button>
      </div>

      {tab === 'basic' ? (
        symbol && userId ? (
          <BasicAnalysisPanel symbol={symbol} userId={userId} />
        ) : (
          <p className="text-yellow-300">⏳ Đang tải dữ liệu phân tích cơ bản...</p>
        )
      ) : tab === 'ai' ? (
        <>
          {symbol ? (
            <AIAnalysisPanel symbol={symbol} />
          ) : (
            <p className="text-yellow-300">⏳ Đang tải dữ liệu AI...</p>
          )}
          <PortfolioTable
            portfolio={portfolio}
            date={portfolioDate}
            loading={loadingPortfolio}
          />
        </>
      ) : (
        symbol ? (
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl">
            <StockAIChart symbol={symbol.toUpperCase()} />
          </div>
        ) : (
          <p className="text-yellow-300">⏳ Đang tải biểu đồ AI...</p>
        )
      )}
    </div>
  )
}
