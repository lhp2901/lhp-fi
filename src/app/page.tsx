'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AnalysisPage from './analysis/stocks/page' // ✅ trang phân tích AI
import MarketAnalysisPage from './analysis/market-analysis/page' // ✅ thêm trang thị trường

export default function HomePage() {
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analysis' | 'market'>('dashboard') // ✅ thêm 'market'

  const router = useRouter()

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error || !session) {
        router.push('/login')
        return
      }
      const user = session.user
      const name = user.user_metadata?.full_name || user.email
      setUserName(name)
      setLoading(false)
      router.refresh()
    }
    fetchUser()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <h2 className="animate-pulse text-xl font-semibold">⏳ Đang tải dữ liệu...</h2>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold mb-6 text-purple-300">Xin chào, {userName}</h1>

      <div className="flex gap-3 flex-wrap mb-4">
        {[
          { key: 'dashboard', label: '📊 Dashboard' },
          { key: 'analysis', label: '📈 Cổ phiếu' },
          { key: 'market', label: '🌏 Thị Trường' }, // ✅ thêm nút mới
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-md text-sm font-medium border ${
              activeTab === tab.key
                ? 'bg-indigo-600 text-white'
                : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'dashboard' && (
        <section className="text-slate-400 border border-white/10 p-4 rounded-xl bg-white/5">
          <h2 className="text-lg font-semibold text-teal-300 mb-2">📊 Tổng quan tài chính</h2>
          <p className="italic">Tính năng đang phát triển... Sẽ hiển thị số dư, lãi/lỗ, và biểu đồ hiệu suất AI.</p>
        </section>
      )}

      {activeTab === 'analysis' && (
        <section className="mt-4">
          <AnalysisPage />
        </section>
      )}

      {activeTab === 'market' && (
        <section className="mt-4">
          <MarketAnalysisPage /> {/* ✅ hiển thị trang phân tích thị trường */}
        </section>
      )}
    </div>
  )
}
