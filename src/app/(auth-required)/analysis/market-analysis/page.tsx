'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import MarketPanel from '@/components/market-analysis/MarketPanel'

export default function MarketAnalysisPage() {
  const [vnindexData, setVnindexData] = useState<any[]>([])
  const [vn30Data, setVn30Data] = useState<any[]>([])
  const [selectedMarket, setSelectedMarket] = useState<'VNINDEX' | 'VN30'>('VNINDEX')

  useEffect(() => {
    const fetchData = async () => {
      const [vnindexRes, vn30Res] = await Promise.all([
        supabase.from('vnindex_data').select('*').order('date', { ascending: true }),
        supabase.from('vn30_data').select('*').order('date', { ascending: true }),
      ])
      setVnindexData(vnindexRes.data || [])
      setVn30Data(vn30Res.data || [])
    }

    fetchData()
  }, [])

  const selectedData = selectedMarket === 'VNINDEX' ? vnindexData : vn30Data

  return (
     <div className="min-h-screen w-full px-4 md:px-8 py-6 space-y-6 bg-gradient-to-b from-black to-slate-900 text-white">
      <div className="flex items-center gap-4">
        <label htmlFor="market-select" className="font-medium text-lg">Chọn chỉ số:</label>
        <select
          id="market-select"
          className="bg-white text-black px-4 py-2 rounded-md border"
          value={selectedMarket}
          onChange={(e) => setSelectedMarket(e.target.value as 'VNINDEX' | 'VN30')}
        >
          <option value="VNINDEX">VNINDEX</option>
          <option value="VN30">VN30</option>
        </select>
      </div>

      <MarketPanel
        data={selectedData}
        name={selectedMarket}
      />
    </div>
  )
}
