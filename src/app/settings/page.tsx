'use client'

import ImportVN30 from './ImportVN30'
import ImportVNINDEX from './ImportVNINDEX'
import ImportStocks from './ImportStocks'
import { useState } from 'react'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'vn30' | 'vnindex' | 'stocks'>('vn30')
  const [generating, setGenerating] = useState(false)
  const [aiMessage, setAiMessage] = useState('')

  const handleGenerateSignals = async () => {
  setGenerating(true)
  setAiMessage('🧠 Đang sinh tín hiệu AI...')

  try {
    const res1 = await fetch('/api/generate-signals', { method: 'POST' })
    if (!res1.ok) throw new Error('Lỗi generate-signals')
    await res1.json()

    setAiMessage('📊 Đang huấn luyện mô hình AI...')

    const res2 = await fetch('/api/train-model', { method: 'POST' })
    if (!res2.ok) throw new Error('Lỗi train-model')
    await res2.json()

    setAiMessage('✅ Đã sinh và huấn luyện xong mô hình AI!')
  } catch (err) {
    console.error('❌ Lỗi pipeline AI:', err)
    setAiMessage('❌ Lỗi khi sinh hoặc huấn luyện tín hiệu AI.')
  }

  setGenerating(false)
}

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">⚙️ Cài đặt hệ thống</h1>

      <div className="flex space-x-4 mb-6">
        <button
          className={`px-4 py-2 rounded font-medium transition ${
            activeTab === 'vnindex'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-200 text-gray-800 hover:bg-slate-300'
          }`}
          onClick={() => setActiveTab('vnindex')}
        >
          VNINDEX
        </button>
        <button
          className={`px-4 py-2 rounded font-medium transition ${
            activeTab === 'vn30'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-200 text-gray-800 hover:bg-slate-300'
          }`}
          onClick={() => setActiveTab('vn30')}
        >
          VN30
        </button>
        <button
          className={`px-4 py-2 rounded font-medium transition ${
            activeTab === 'stocks'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-200 text-gray-800 hover:bg-slate-300'
          }`}
          onClick={() => setActiveTab('stocks')}
        >
          CỔ PHIẾU
        </button>
      </div>

      {/* Tabs content */}
      {activeTab === 'vnindex' && <ImportVNINDEX />}
      {activeTab === 'vn30' && <ImportVN30 />}
      {activeTab === 'stocks' && <ImportStocks />}

      <div className="mt-10 border-t pt-6">
        <h2 className="text-lg font-semibold mb-3">🤖 Tín hiệu AI</h2>
        <button
          onClick={handleGenerateSignals}
          disabled={generating}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {generating ? '🧠 Đang xử lý...' : '🧠 Sinh tín hiệu AI'}
        </button>

        {aiMessage && (
          <p className="mt-3 text-sm text-indigo-600">{aiMessage}</p>
        )}
      </div>
    </div>
  )
}
