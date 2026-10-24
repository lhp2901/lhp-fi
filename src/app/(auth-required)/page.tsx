
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import MarketMoodCard from '@/components/market-analysis/MarketMoodCard'

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

export default function HomePage() {
  const router = useRouter()

  const [showMood, setShowMood] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState<Date | null>(null)

  // Đồng hồ thời gian thực
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date())
    }

    updateTime()

    const timer = setInterval(updateTime, 1000)

    return () => clearInterval(timer)
  }, [])

  // Kiểm tra đăng nhập
  useEffect(() => {
    let mounted = true

    const fetchUser = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (!mounted) return

        if (error || !session) {
          router.replace('/login')
          return
        }

        setLoading(false)
      } catch (error) {
        console.error('Lỗi kiểm tra đăng nhập:', error)

        if (mounted) {
          router.replace('/login')
        }
      }
    }

    void fetchUser()

    return () => {
      mounted = false
    }
  }, [router])

  // Đang kiểm tra đăng nhập
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <h2 className="animate-pulse text-xl font-semibold">
          ⏳ Đang kiểm tra đăng nhập...
        </h2>
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-5">

      {/* ĐỒNG HỒ VÀ CÂU NÓI TRUYỀN CẢM HỨNG */}
      <div className="relative z-20 flex min-h-11 w-full items-center rounded-xl border border-slate-800 bg-black px-3">

        {/* Câu nói chạy ngang */}
        <div className="pointer-events-none absolute inset-y-0 left-3 right-[280px] flex items-center overflow-hidden">
          <div
            className={`animate-marquee whitespace-nowrap text-sm font-semibold sm:text-base ${
              currentTime
                ? getQuoteColor(currentTime.getHours())
                : 'text-indigo-300'
            }`}
            style={{ animationDuration: '25s' }}
          >
            {quotes.map((quote, index) => (
              <span key={index} className="mr-12">
                ✨ {quote}
              </span>
            ))}
          </div>
        </div>

        {/* Đồng hồ và tâm lý thị trường */}
        <div className="relative z-10 ml-auto">
          <button
            type="button"
            onClick={() => setShowMood((previous) => !previous)}
            aria-expanded={showMood}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg bg-black/90 px-2 py-2 text-right font-mono text-xs font-bold sm:text-sm ${
              currentTime
                ? getTimeColor(currentTime.getHours())
                : 'text-sky-400'
            }`}
          >
            <span>
              📅 {currentTime ? getDayText(currentTime.getDay()) : 'LHP-FI'}
            </span>

            <span className="text-slate-500">|</span>

            <span>
              ⏰{' '}
              {currentTime
                ? currentTime.toLocaleTimeString('vi-VN')
                : '--:--:--'}
            </span>

            <span className="text-slate-500">
              {showMood ? '▲' : '▼'}
            </span>
          </button>

          {showMood && (
            <div className="absolute right-0 top-full z-50 mt-2 w-[min(300px,calc(100vw-2rem))] rounded-xl border border-slate-700 bg-slate-950 p-4 shadow-2xl">
              <button
                type="button"
                onClick={() => setShowMood(false)}
                aria-label="Đóng bảng tâm lý thị trường"
                className="absolute right-2 top-2 z-10 rounded px-2 py-1 text-sm text-red-400 hover:bg-slate-800"
              >
                ✕
              </button>

              <MarketMoodCard />
            </div>
          )}
        </div>
      </div>

      {/* KHU VỰC NỘI DUNG TRANG CHỦ */}
      <section className="min-w-0">
        {/*<div className="mb-5">
          <h1 className="text-xl font-bold tracking-wide text-white sm:text-2xl">
            📊 LHP-FI Dashboard
          </h1>

          <p className="mt-1 text-sm text-slate-400">
            Trung tâm theo dõi thị trường và quản lý tài chính của bạn.
          </p>
        </div>*/}

        {/* Nội dung Dashboard */}
        <DashboardHome />
      </section>
    </div>
  )
}

// Tách component để giữ phần import Dashboard rõ ràng
import DashboardContent from '@/components/market-analysis/DashboardContent'

function DashboardHome() {
  return <DashboardContent />
}

