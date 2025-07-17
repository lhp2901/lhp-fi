'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ImportVN30 from './ImportVN30'
import ImportVNINDEX from './ImportVNINDEX'
import ImportStocks from './ImportStocks'
import Link from 'next/link'
export default function SettingsPage() {
  const router = useRouter()

  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)

  const [activeTab, setActiveTab] = useState<'vn30' | 'vnindex' | 'stocks'>('vn30')
  const [generating, setGenerating] = useState(false)
  const [aiStep, setAiStep] = useState<'idle' | 'signals' | 'train' | 'predict' | 'done' | 'error'>('idle')
  const [aiMessage, setAiMessage] = useState('')

  useEffect(() => {
    const checkPermission = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        router.replace('/login')
        return
      }

      const { data: user, error } = await supabase
        .from('users')
        .select('is_active')
        .eq('id', session.user.id)
        .single()

      if (error || !user?.is_active) {
        router.replace('/403')
        return
      }

      setAllowed(true)
      setChecking(false)
    }

    checkPermission()
  }, [router])

  if (checking) return <div className="p-6">🔍 Đang xác minh quyền truy cập...</div>
  if (!allowed) return null

  // --- Các hàm AI pipeline giữ nguyên ---
  const handleGenerateSignals = async () => {
    setGenerating(true)
    setAiStep('signals')
    setAiMessage('🧠 Đang sinh tín hiệu AI từ dữ liệu...')

    try {
      const res1 = await fetch('/api/generate-signals', { method: 'POST' })
      if (!res1.ok) throw new Error('Lỗi generate-signals')
      await res1.json()

      setAiStep('train')
      setAiMessage('📊 Đang huấn luyện mô hình AI...')
      const res2 = await fetch('/api/train-model', { method: 'POST' })
      if (!res2.ok) throw new Error('Lỗi train-model')
      await res2.json()

      setAiStep('predict')
      setAiMessage('🤖 Đang chạy dự đoán AI cho toàn bộ mã...')
      const res3 = await fetch('/api/predict-all', { method: 'POST' })
      if (!res3.ok) throw new Error('Lỗi predict-all')
      await res3.json()

      setAiStep('done')
      setAiMessage('✅ Đã sinh tín hiệu & gợi ý danh mục AI thành công!')
    } catch (err) {
      console.error('❌ Lỗi pipeline AI:', err)
      setAiStep('error')
      setAiMessage('❌ Đã xảy ra lỗi trong quá trình xử lý AI.')
    }

    setGenerating(false)
  }
  
  // 👇 phần hiển thị giữ nguyên
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">⚙️ Cài đặt hệ thống</h1>

      {/* Tabs nhập dữ liệu */}
      <div className="flex space-x-4 mb-6">
        {['vnindex', 'vn30', 'stocks'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2 rounded font-medium transition ${
              activeTab === tab
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-200 text-gray-800 hover:bg-slate-300'
            }`}
          >
            {tab === 'vn30' ? 'VN30' : tab === 'vnindex' ? 'VNINDEX' : 'CỔ PHIẾU'}
          </button>
        ))}
      </div>

      {activeTab === 'vnindex' && <ImportVNINDEX />}
      {activeTab === 'vn30' && <ImportVN30 />}
      {activeTab === 'stocks' && <ImportStocks />}

      <div className="mt-10 border-t pt-6">
        <h2 className="text-lg font-semibold mb-3">🤖 Quy trình xử lý tín hiệu AI</h2>

       <div className="flex space-x-4 mt-4">
        <button
          onClick={handleGenerateSignals}
          disabled={generating}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {generating ? '🧠 Đang xử lý...' : '🧠 STH AI Cổ Phiếu'}
        </button>

        <button
          onClick={async () => {
            setAiMessage('🚀 Đang gọi AI server chạy toàn bộ quy trình...')
            try {
              const res = await fetch('/api/ai/run', { method: 'POST' })
              const data = await res.json()
              if (res.ok) {
                setAiMessage('✅ AI server đã chạy toàn bộ pipeline thành công!')
              } else {
                throw new Error(data.error || 'Lỗi không rõ')
              }
            } catch (err) {
              console.error('❌ Lỗi khi gọi run_daily:', err)
              setAiMessage('❌ Không thể gọi AI server hoặc gặp lỗi.')
            }
          }}
          disabled={generating}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
        >
          🚀 STH AI VNINDEX - VN30
        </button>
      </div>
          
         <div className="mt-6 space-y-2 text-sm">
          <div className="flex items-center space-x-2">
            <span className={aiStep === 'signals' || aiStep === 'train' || aiStep === 'predict' || aiStep === 'done' ? 'text-green-400' : aiStep === 'error' ? 'text-red-400' : 'text-gray-400'}>
              {aiStep === 'signals' || aiStep === 'train' || aiStep === 'predict' || aiStep === 'done' ? '✅' : aiStep === 'error' ? '❌' : '⬜'}
            </span>
            <span className={aiStep === 'signals' ? 'font-semibold text-green-400' : ''}>Tạo tín hiệu từ dữ liệu quá khứ</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className={aiStep === 'train' || aiStep === 'predict' || aiStep === 'done' ? 'text-green-400' : aiStep === 'error' ? 'text-red-400' : 'text-gray-400'}>
              {aiStep === 'train' || aiStep === 'predict' || aiStep === 'done' ? '✅' : aiStep === 'error' ? '❌' : '⬜'}
            </span>
            <span className={aiStep === 'train' ? 'font-semibold text-green-400' : ''}>Huấn luyện mô hình AI</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className={aiStep === 'predict' || aiStep === 'done' ? 'text-green-400' : aiStep === 'error' ? 'text-red-400' : 'text-gray-400'}>
              {aiStep === 'predict' || aiStep === 'done' ? '✅' : aiStep === 'error' ? '❌' : '⬜'}
            </span>
            <span className={aiStep === 'predict' ? 'font-semibold text-green-400' : ''}>Dự đoán xác suất thắng</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className={aiStep === 'done' ? 'text-green-400' : aiStep === 'error' ? 'text-red-400' : 'text-gray-400'}>
              {aiStep === 'done' ? '🎯' : aiStep === 'error' ? '❌' : '⬜'}
            </span>
            <span className={aiStep === 'done' ? 'font-semibold text-green-400' : ''}>
              Gợi ý danh mục đầu tư AI
            </span>
          </div>
          <div className="bg-red-900/30 border border-red-500 text-red-300 rounded p-3 text-sm mt-4">

          <Link href="/settings/ai-cleanup" className="underline text-blue-300 hover:text-blue-400">
            🔥 Quản lý xoá dữ liệu AI
          </Link> để kiểm tra hoặc xoá sạch dữ liệu lỗi.
        </div>
        </div>
      </div>
    </div>
    
  )
}
