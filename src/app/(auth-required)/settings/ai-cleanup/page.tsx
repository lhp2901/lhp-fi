'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'

const TABLES = [
  { key: 'ai_signals', label: '📊 ai_signals' },
  { key: 'ai_market_signals', label: '📈 ai_market_signals' },
  { key: 'ai_accuracy_logs', label: '📚 ai_accuracy_logs' },
  { key: 'import_logs', label: '📥 import_logs' },
  { key: 'portfolio_transactions', label: '📥 portfolio_transactions' },
  { key: 'stock_entries', label: '📥 stock_entries' },
  { key: 'vn30_data', label: '📥 vn30_data' },
  { key: 'vnindex_data', label: '📥 vnindex_data' },
]
export default function AiCleanupPage() {
  const [selected, setSelected] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState('')
  const [history, setHistory] = useState<any[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (data?.user?.id) setUserId(data.user.id)
    }

    const fetchLogs = async () => {
      const { data } = await supabase
        .from('delete_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
      setHistory(data || [])
    }

    fetchUser()
    fetchLogs()
  }, [])

  const handleSelect = (key: string) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const handleSelectAll = () => {
    if (selectAll) {
      setSelected([])
      setSelectAll(false)
    } else {
      setSelected(TABLES.map((t) => t.key))
      setSelectAll(true)
    }
  }

  const handleDelete = async () => {
    if (!userId || selected.length === 0) return

    const confirm = window.confirm('⚠️ Xác nhận xoá tất cả dữ liệu đã chọn?')
    if (!confirm) return

    setDeleting(true)
    setMessage('🧹 Đang xoá dữ liệu...')

    try {
      const res = await fetch('/api/auto-ai-refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          tables: selected,
          note: 'Xoá từ giao diện AI cleanup',
        }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Lỗi không rõ')

      setMessage('✅ Đã xoá dữ liệu & ghi log thành công!')
      setSelected([])
      setSelectAll(false)

      const { data } = await supabase
        .from('delete_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
      setHistory(data || [])
    } catch (err) {
      console.error(err)
      setMessage('❌ Lỗi khi xoá dữ liệu hoặc gọi API.')
    }

    setDeleting(false)
  }

   const handleDeleteLogs = async () => {
    const confirm = window.confirm('⚠️ Bạn có chắc muốn XOÁ TOÀN BỘ lịch sử log không? Không thể phục hồi!')
    if (!confirm) return

    setDeleting(true)
    setMessage('🧨 Đang xoá toàn bộ lịch sử log...')

    try {
      const { error } = await supabase
        .from('delete_logs')
        .delete()
        .not('id', 'is', null)

      if (error) throw error

      setMessage('✅ Đã xoá toàn bộ lịch sử log!')
      setHistory([]) // Clear UI
    } catch (err) {
      setMessage('❌ Lỗi khi xoá lịch sử log.')
    }

    setDeleting(false)
  }
  
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-4">🧹 Quản lý xoá dữ liệu AI</h1>

      <div className="space-y-3 mb-6">
        <p className="text-sm font-medium">🗂️ Chọn bảng muốn xoá</p>
        <div className="flex flex-wrap gap-4">
          {TABLES.map((t) => (
            <label key={t.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(t.key)}
                onChange={() => handleSelect(t.key)}
              />
              {t.label}
            </label>
          ))}
        </div>
        <label className="text-sm text-blue-400 cursor-pointer" onClick={handleSelectAll}>
          {selectAll ? '🧺 Bỏ chọn tất cả' : '✅ Chọn tất cả'}
        </label>
      </div>

      <div className="mb-6">
        <button
          onClick={handleDelete}
          disabled={deleting || selected.length === 0}
          className="px-2 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
        >
          🗑️ Xoá dữ liệu đã chọn
        </button>
        {message && <p className="text-sm text-blue-400 mt-2">{message}</p>}
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold mb-3">🕘 Lịch sử xoá gần đây</h2>
        <table className="w-full text-sm text-left border border-white/10">
          <thead>
            <tr className="bg-white/5">
              <th className="px-3 py-2">🧑 User</th>
              <th className="px-3 py-2">📦 Bảng đã xoá</th>
              <th className="px-3 py-2">📝 Ghi chú</th>
              <th className="px-3 py-2">🕒 Thời gian</th>
            </tr>
          </thead>
          <tbody>
            {history.map((log) => (
              <tr key={log.id} className="border-t border-white/10">
                <td className="px-3 py-2">{log.user_id.slice(0, 6)}...</td>
                <td className="px-3 py-2">{log.tables.join(', ')}</td>
                <td className="px-3 py-2">{log.note || '-'}</td>
                <td className="px-3 py-2">{formatDate(log.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4">
  <button
    onClick={handleDeleteLogs}
    disabled={deleting}
    className="px-2 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
  >
    🧨 Xoá toàn bộ lịch sử xoá
  </button>
</div>
      </div>
    </div>
  )
}