'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AnalysisPage from './analysis/stocks/page'
import MarketAnalysisPage from './analysis/market-analysis/page'
import TransactionList from '@/components/portfolio/TransactionList'
import AddTransactionForm from '@/components/portfolio/AddTransactionForm'
import EditTransactionForm from '@/components/portfolio/EditTransactionForm'
import DashboardContent from '@/components/market-analysis/DashboardContent'


const quotes = [
  'Đừng bao giờ đặt tất cả trứng vào cùng một giỏ.',
  'Tiền không ngủ yên, đầu tư thông minh giúp bạn giàu có.',
  'Thị trường luôn có cơ hội cho người biết kiên nhẫn.',
  'Lãi suất kép là kỳ quan thứ tám của thế giới.',
  'Đầu tư vào bản thân là khoản đầu tư sinh lời nhất.',
]

type TabKey = 'dashboard' | 'market' | 'analysis' | 'portfolio'

export default function HomePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard')
  const [transactions, setTransactions] = useState<any[]>([])
  const [editingTx, setEditingTx] = useState<any | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  // ⏱️ Cập nhật thời gian thực
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const getTimeColor = (hour: number) => {
  if (hour >= 5 && hour < 12) return 'text-yellow-400'     // Sáng sớm
  if (hour >= 12 && hour < 17) return 'text-sky-400'        // Buổi chiều
  if (hour >= 17 && hour < 21) return 'text-emerald-300'    // Buổi tối
  return 'text-rose-400'                                    // Khuya
}

  // ✅ Kiểm tra đăng nhập
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error || !session) {
        router.push('/login')
        return
      }
      setLoading(false)
    }
    fetchUser()
  }, [router])

  // ✅ Lấy giao dịch khi vào tab portfolio
  useEffect(() => {
    if (activeTab === 'portfolio') {
      fetchTransactions()
    }
  }, [activeTab])

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from('portfolio_transactions')
      .select('*')
      .order('created_at', { ascending: false })
    setTransactions(data || [])
  }

  const handleUpdate = async (form: any) => {
    const { id, ...updateData } = form
    const { error } = await supabase
      .from('portfolio_transactions')
      .update(updateData)
      .eq('id', id)

    if (!error) {
      setEditingTx(null)
      fetchTransactions()
    } else {
      alert('❌ Lỗi cập nhật: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <h2 className="animate-pulse text-xl font-semibold">⏳ Đang tải dữ liệu...</h2>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 🎯 Marquee mới – tách đồng hồ và chữ chạy */}
      <div className="relative w-full h-10 bg-black rounded-md border border-gray-700 flex items-center px-4">
        {/* 💬 Quotes chạy bên trái (phần còn lại) */}
        <div className="absolute left-4 right-[180px] top-0 bottom-0 overflow-hidden flex items-center">
          <div
            className="whitespace-nowrap text-white font-semibold text-lg animate-marquee"
            style={{ animationDuration: '20s' }}
          >
            {quotes.map((quote, idx) => (
              <span key={idx} className="mr-10">
                {quote}
              </span>
            ))}
          </div>
        </div>

        {/* ⏰ Đồng hồ cố định bên phải */}
        <div className={`ml-auto z-10 font-bold text-sm font-mono flex items-center gap-2 ${getTimeColor(currentTime.getHours())}`}>
        <span>📅 {currentTime.toLocaleDateString('vi-VN')}</span>
        <span>⏰ {currentTime.toLocaleTimeString('vi-VN')}</span>
      </div>
      </div>

      {/* 🔥 Tabs */}
      <div className="flex gap-3 flex-wrap mb-4">
        {[
          { key: 'dashboard', label: '📊 Dashboard' },
          { key: 'market', label: '🌏 Thị Trường' },
          { key: 'analysis', label: '📈 Cổ phiếu' },
          { key: 'portfolio', label: '💼 Giao dịch' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabKey)}
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

      {/* 💾 Nội dung từng tab */}
      {activeTab === 'dashboard' && (
        <section className="mt-4">
          <DashboardContent />
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

      {activeTab === 'portfolio' && (
        <section className="space-y-6 mt-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-teal-300">📋 Lịch sử giao dịch</h2>
              <div className="flex gap-4 items-center">
                <button
                  onClick={() => setShowForm(!showForm)}
                  className="text-blue-400 hover:underline"
                >
                  {showForm ? '− Ẩn nhập liệu' : '+ Thêm giao dịch mới'}
                </button>
                <a
                  href="/portfolio/dashboard"
                  className="text-yellow-400 hover:underline text-sm flex items-center gap-1"
                >
                  📊 Xem báo cáo
                </a>
              </div>
            </div>

            {editingTx ? (
              <EditTransactionForm
                initial={editingTx}
                onCancel={() => setEditingTx(null)}
                onSave={handleUpdate}
              />
            ) : (
              <TransactionList
              transactions={transactions} 
              onRefresh={fetchTransactions}
              setEditingTx={setEditingTx}
            />
            )}

            {showForm && (
              <div className="mt-6 border-t border-white/10 pt-6">
                <h2 className="text-base font-medium text-blue-300 mb-4">📝 Nhập liệu giao dịch</h2>
                <AddTransactionForm onSaved={fetchTransactions} />
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
