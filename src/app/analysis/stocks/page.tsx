'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import BasicAnalysisPanel from '@/components/stocks/BasicAnalysisPanel'
import AIAnalysisPanel from '@/components/stocks/AIAnalysisPanel'

export default function AnalysisPage() {
  const [symbol, setSymbol] = useState('')
  const [symbols, setSymbols] = useState<string[]>([])
  const [tab, setTab] = useState<'basic' | 'ai'>('basic')

  useEffect(() => {
    const fetchSymbols = async () => {
      const { data } = await supabase.from('stock_entries').select('symbol').neq('symbol', null)
      if (data) {
        const unique = Array.from(new Set(data.map((item) => item.symbol)))
        setSymbols(unique)
        setSymbol(unique[0])
      }
    }
    fetchSymbols()
  }, [])

  return (
    <div className="min-h-screen w-full px-4 md:px-8 py-6 space-y-6 bg-gradient-to-b from-black to-slate-900 text-white">
      <h1 className="text-2xl font-bold mb-4">📈 Phân tích cổ phiếu AI</h1>

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

      <div className="flex space-x-4 mb-6">
        <Button variant={tab === 'basic' ? 'default' : 'outline'} onClick={() => setTab('basic')}>
          Phân tích cơ bản
        </Button>
        <Button variant={tab === 'ai' ? 'default' : 'outline'} onClick={() => setTab('ai')}>
          Phân tích AI
        </Button>
      </div>

      {tab === 'basic' ? (
        <BasicAnalysisPanel symbol={symbol} />
      ) : (
        <AIAnalysisPanel symbol={symbol} />
      )}
    </div>
  )
}
