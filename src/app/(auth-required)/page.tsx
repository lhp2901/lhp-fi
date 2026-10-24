
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

import AnalysisPage from './analysis/stocks/page'
import MarketAnalysisPage from './analysis/market-analysis/page'
import DashboardContent from '@/components/market-analysis/DashboardContent'
import MarketMoodCard from '@/components/market-analysis/MarketMoodCard'
import CryptoDashboardPage from '@/components/crypto/CryptoDashboardPage'
import FootprintPage from './footprint/page'
import PortfolioPage from '@/app/(auth-required)/portfolio/page'
import SavingsPage from '@/app/(auth-required)/portfolio/savings/page'

const quotes = [
  'Đừng bao giờ đặt tất cả trứng vào cùng một giỏ.',
  'Tiền không ngủ yên, đầu tư thông minh giúp bạn giàu có.',
  'Thị trường luôn có cơ hội cho người biết kiên nhẫn.',
  'Lãi suất kép là kỳ quan thứ tám của thế giới.',
  'Đầu tư vào bản thân là khoản đầu tư sinh lời nhất.',
]

const getQuoteColor = (hour: number): string => {
  if (hour >= 5 && hour < 12) return 'text-pink-400'
  if (hour >= 12 && hour < 17) return 'text-orange-400'
  if (hour >= 17 && hour < 21) return 'text-indigo-300'
  return 'text-lime-300'
}


type TabKey =
  | 'dashboard'
  | 'market'
  | 'analysis'
  | 'footprint'
  | 'crypto'
  | 'portfolio'
  | 'savings'



export default function HomePage() {
  const router = useRouter()

  const [showMood, setShowMood] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard')
  const [currentTime, setCurrentTime] = useState(new Date())

  // Đồng hồ thời gian thực
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const getTimeColor = (hour: number): string => {
    if (hour >= 5 && hour < 12) return 'text-yellow-400'
    if (hour >= 12 && hour < 17) return 'text-sky-400'
    if (hour >= 17 && hour < 21) return 'text-emerald-300'
    return 'text-rose-400'
  }

  const getDayText = (day: number): string => {
    switch (day) {
      case 0:
        return 'Sun ☀️ "Nạp năng lượng"'
      case 1:
        return 'Mon 💼 "Khởi động chinh chiến"'
      case 2:
        return 'Tue ⚔️ "Vào trận không run tay"'
      case 3:
        return 'Wed 🧠 "Phân tích chuẩn chỉnh"'
      case 4:
        return 'Thu 🔎 "Săn điểm vàng"'
      case 5:
        return 'Fri 🚀 "Kết phiên rực rỡ"'
      case 6:
        return 'Sat 🧘‍♂️ "Đúc kết – Lên chiến lược"'
      default:
        return ''
    }
  }

  // Kiểm tra đăng nhập
  useEffect(() => {
    let mounted = true

    const fetchUser = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (!mounted) return

      if (error || !session) {
        router.push('/login')
        return
      }

      setLoading(false)
    }

    fetchUser()

    return () => {
      mounted = false
    }
  }, [router])

  // Đang kiểm tra đăng nhập
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <h2 className="animate-pulse text-xl font-semibold">
          ⏳ Đang tải dữ liệu...
        </h2>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Đồng hồ và câu nói truyền cảm hứng */}
      <div className="relative w-full h-10 bg-black rounded-md border border-gray-700 flex items-center px-2">
        {/* Câu nói chạy */}
        <div className="absolute left-4 right-[300px] top-0 bottom-0 overflow-hidden flex items-center">
          <div
            className={`whitespace-nowrap font-semibold text-lg animate-marquee ${getQuoteColor(
              currentTime.getHours()
            )}`}
            style={{ animationDuration: '20s' }}
          >
            {quotes.map((quote, idx) => (
              <span key={idx} className="mr-10">
                {quote}
              </span>
            ))}
          </div>
        </div>

        {/* Đồng hồ và MarketMoodCard */}
        <div className="ml-auto z-10 relative">
          <button
            type="button"
            onClick={() => setShowMood(!showMood)}
            className={`font-bold text-sm font-mono flex items-center gap-2 pr-2 text-right whitespace-nowrap ${getTimeColor(
              currentTime.getHours()
            )}`}
          >
            <span>
              📅 {getDayText(currentTime.getDay())} –
            </span>

            <span>
              ⏰ {currentTime.toLocaleTimeString('vi-VN')}
            </span>
          </button>

          {showMood && (
            <div className="absolute right-0 mt-2 bg-slate-900 border border-white/10 rounded-lg shadow-lg p-4 z-50 w-[260px]">
              <MarketMoodCard />

              <button
                type="button"
                onClick={() => setShowMood(false)}
                className="absolute top-1 right-1 text-xs text-red-400 hover:underline"
              >
                ✖
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Các tab chính */}
      <div className="mb-4 flex flex-wrap gap-3">
        {[
          { key: 'dashboard', label: '📊 Dashboard' },
          { key: 'market', label: '🌏 Thị Trường' },
          { key: 'analysis', label: '📈 Cổ phiếu' },
          { key: 'footprint', label: '🔥 Footprint Cổ phiếu' },
          {
            key: 'derivatives',
            label: '⚡ BOOKMAP VN30F1M',
            href: 'https://vn30f1m.trunghsgs.edu.vn/',
          },
          { key: 'crypto', label: '💎 Crypto' },
          { key: 'portfolio', label: '💼 Giao dịch' },
          { key: 'savings', label: '💰 Tiết kiệm' },
        ].map((tab) =>
          tab.href ? (
            <a
              key={tab.key}
              href={tab.href}
              target={tab.key === 'derivatives' ? '_blank' : undefined}
              rel={
                tab.key === 'derivatives'
                  ? 'noopener noreferrer'
                  : undefined
              }
              className="rounded-md border px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10"
            >
              {tab.label}
            </a>
          ) : (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={`rounded-md border px-4 py-2 text-sm font-medium ${
                activeTab === tab.key
                  ? 'border-indigo-500 bg-indigo-600 text-white'
                  : 'text-slate-200 hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          )
        )}
      </div>

      {/* Nội dung Dashboard */}
      {activeTab === 'dashboard' && (
        <section className="mt-4">
          <DashboardContent />
        </section>
      )}

      {/* Nội dung Thị trường */}
      {activeTab === 'market' && (
        <section className="mt-4">
          <MarketAnalysisPage />
        </section>
      )}

      {/* Nội dung Phân tích cổ phiếu */}
      {activeTab === 'analysis' && (
        <section className="mt-4">
          <AnalysisPage />
        </section>
      )}

      {/* Nội dung Footprint */}
      {activeTab === 'footprint' && (
        <section className="mt-4">
          <FootprintPage />
        </section>
      )}

      {/* Nội dung Crypto */}
      {activeTab === 'crypto' && (
        <section className="mt-4">
          <CryptoDashboardPage />
        </section>
      )}

      {/* Nội dung Giao dịch */}
      {activeTab === 'portfolio' && (
        <section className="mt-4">
          <PortfolioPage />
        </section>
      )}

      {/* Nội dung Tiết kiệm */}
      {activeTab === 'savings' && (
        <section className="mt-4">
          <SavingsPage />
        </section>
      )}
      
    </div>
  )
}

