'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AnalysisPage from './analysis/stocks/page'
import MarketAnalysisPage from './analysis/market-analysis/page'

const quotes = [
  'Đừng bao giờ đặt tất cả trứng vào cùng một giỏ.',
  'Tiền không ngủ yên, đầu tư thông minh giúp bạn giàu có.',
  'Thị trường luôn có cơ hội cho người biết kiên nhẫn.',
  'Lãi suất kép là kỳ quan thứ tám của thế giới.',
  'Đầu tư vào bản thân là khoản đầu tư sinh lời nhất.',
]

export default function HomePage() {
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analysis' | 'market'>('dashboard')

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
    <div className="space-y-6">
      {/* Marquee câu châm ngôn */}
      <div className="relative w-full h-10 overflow-hidden bg-black rounded-md border border-gray-700">
  <div
    className="absolute whitespace-nowrap text-white font-semibold text-lg animate-marquee"
    style={{ animationDuration: '20s' }}
    aria-label="Câu châm ngôn tài chính"
  >
    {quotes.map((quote, idx) => (
      <span key={idx} className="mr-10">
        {quote}
      </span>
    ))}
  </div>
</div>

      <div className="flex gap-3 flex-wrap mb-4">
        {[
          { key: 'dashboard', label: '📊 Dashboard' },
          { key: 'market', label: '🌏 Thị Trường' },
          { key: 'analysis', label: '📈 Cổ phiếu' },
          
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

      {activeTab === 'market' && (
        <section className="mt-4">
          <MarketAnalysisPage />
        </section>
      )}

      {activeTab === 'analysis' && (
        <section className="mt-4">
          <AnalysisPage />
        </section>
      )}
      
    </div>
  )
}
