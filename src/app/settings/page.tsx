'use client'

import { useState } from 'react'
import ImportVN30 from './ImportVN30'
import ImportVNINDEX from './ImportVNINDEX'
import ImportStocks from './ImportStocks'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'vn30' | 'vnindex' | 'stocks'>('vn30')
  const [generating, setGenerating] = useState(false)
  const [aiStep, setAiStep] = useState<'idle' | 'signals' | 'train' | 'predict' | 'done' | 'error'>('idle')
  const [aiMessage, setAiMessage] = useState('')

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

  const handleResetAI = async () => {
    setAiStep('idle')
    setAiMessage('🔄 Đang làm mới dữ liệu AI hôm nay...')
    try {
      const res = await fetch('/api/auto-ai-refresh', { method: 'POST' })
      if (!res.ok) throw new Error('Lỗi khi làm mới AI hôm nay')
      setAiMessage('✅ Đã xoá & làm mới dữ liệu AI hôm nay!')
    } catch (err) {
      console.error('❌ Lỗi refresh:', err)
      setAiMessage('❌ Lỗi khi cập nhật AI hôm nay.')
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">⚙️ Cài đặt hệ thống</h1>

      <div className="flex space-x-4 mb-6">
        {[
          { id: 'vnindex', label: 'VNINDEX' },
          { id: 'vn30', label: 'VN30' },
          { id: 'stocks', label: 'CỔ PHIẾU' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded font-medium transition ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-200 text-gray-800 hover:bg-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'vnindex' && <ImportVNINDEX />}
      {activeTab === 'vn30' && <ImportVN30 />}
      {activeTab === 'stocks' && <ImportStocks />}

      <div className="mt-10 border-t pt-6">
        <h2 className="text-lg font-semibold mb-3">🤖 Quy trình xử lý tín hiệu AI</h2>

        <button
          onClick={handleGenerateSignals}
          disabled={generating}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {generating ? '🧠 Đang xử lý...' : '🧠 Sinh tín hiệu AI'}
        </button>
        <div className="mt-4 space-y-3">
          <button
            onClick={handleResetAI}
            disabled={generating}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            🔄 Làm mới dữ liệu AI
          </button>

          {aiMessage && (
            <p className="text-sm text-blue-400">{aiMessage}</p>
          )}
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
        </div>
      </div>
    </div>
  )
}
