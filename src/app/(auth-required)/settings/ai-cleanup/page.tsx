'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'

const TABLES = [
  // 📡 'Bảng dữ liệu COIN'
  {
    key: 'watched_symbols',
    label: '👀 Mã đồng coin đang theo dõi',
    tooltip: 'Danh sách mã đồng coin người dùng đang quan tâm',
    group: 'Bảng dữ liệu COIN'
  },
  {
    key: 'ohlcv_data',
    label: '🕒 Dữ liệu nến OHLCV',
    tooltip: 'Open, High, Low, Close, Volume – dữ liệu nến để phân tích kỹ thuật',
    group: 'Bảng dữ liệu COIN'
  },
  {
    key: 'training_dataset',
    label: '🎯 Dữ liệu huấn luyện AI',
    tooltip: 'Tập dữ liệu được sử dụng để huấn luyện mô hình AI',
    group: 'Bảng dữ liệu COIN'
  },
  {
    key: 'ai_predictions',
    label: '🔮 Dự đoán từ AI',
    tooltip: 'Kết quả dự đoán giá hoặc tín hiệu từ mô hình AI',
    group: 'Bảng dữ liệu COIN'
  },  
  {
    key: 'trading_logs',
    label: '🧾 Nhật ký giao dịch (COIN)',
    tooltip: 'Ghi lại lịch sử các giao dịch AI đã thực hiện',
    group: 'Bảng dữ liệu COIN'
  },
  // 📊 Bảng dữ liệu CỔ PHIẾU
  {
    key: 'stock_entries',
    label: '📄 Danh sách mã cổ phiếu theo dõi',
    tooltip: 'Các mã cổ phiếu được người dùng thêm vào để theo dõi',
    group: 'Bảng dữ liệu CỔ PHIẾU'
  },
  {
    key: 'ai_signals',
    label: '📊 Tín hiệu AI',
    tooltip: 'Tín hiệu mua/bán do mô hình AI đưa ra',
    group: 'Bảng dữ liệu CỔ PHIẾU'
  }, 
  
  // 🧾 Bảng dữ liệu VNINDEX - VN30
  {
    key: 'vn30_data',
    label: '🏦 Dữ liệu VN30',
    tooltip: 'Chứa dữ liệu chỉ số VN30 theo thời gian',
    group: 'Bảng dữ liệu VNINDEX - VN30'
  },
  {
    key: 'vnindex_data',
    label: '📈 Dữ liệu VNINDEX',
    tooltip: 'Dữ liệu chỉ số VNINDEX từ thị trường',
    group: 'Bảng dữ liệu VNINDEX - VN30'
  },
  {
    key: 'ai_accuracy_logs',
    label: '📚 Nhật ký độ chính xác AI',
    tooltip: 'Lưu lại độ chính xác của AI theo từng phiên đánh giá',
    group: 'Bảng dữ liệu VNINDEX - VN30'
  },    
  {
    key: 'ai_market_signals',
    label: '📈 Tín hiệu thị trường từ AI',
    tooltip: 'Tín hiệu AI dựa trên phân tích xu hướng thị trường',
    group: 'Bảng dữ liệu VNINDEX - VN30'
  },
  {
    key: 'import_logs',
    label: '📥 Nhật ký nhập dữ liệu',
    tooltip: 'Theo dõi quá trình nhập liệu từ các nguồn',
    group: 'Bảng dữ liệu VNINDEX - VN30'
  },
 // 🧾 Bảng dữ liệu GD ĐẦU TƯ
  {
    key: 'portfolio_transactions',
    label: '💼 Giao dịch đầu tư',
    tooltip: 'Lưu thông tin các giao dịch danh mục đầu tư của người dùng',
    group: 'Bảng dữ liệu GD ĐẦU TƯ'
  }  
];

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
        <div className="space-y-3 mb-6">
          <p className="text-xl font-bold mb-4">🗂️ Quản lý xoá dữ liệu</p>

          {/* ✅ Phân nhóm bảng dữ liệu */}
          {Object.entries(
            TABLES.reduce((acc, t) => {
              if (!acc[t.group]) acc[t.group] = [];
              acc[t.group].push(t);
              return acc;
            }, {} as Record<string, typeof TABLES>)
          ).map(([groupName, tables]) => (
            <div key={groupName} className="mb-4">
              <h2 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-2">{groupName}</h2>
              <div className="flex flex-col gap-2 pl-4">
                {tables.map((t) => (
                  <label key={t.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.includes(t.key)}
                      onChange={() => handleSelect(t.key)}
                    />
                    <span>
                      {t.label}{' '}
                      <span className="text-blue-500/80 italic">({t.key})</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {/* Chọn tất cả */}
          <label
            className="text-sm text-blue-600 cursor-pointer hover:underline"
            onClick={handleSelectAll}
          >
            {selectAll ? '🧺 Bỏ chọn tất cả' : '✅ Chọn tất cả'}
          </label>
        </div>

      <div className="mb-6">
        <button
          onClick={handleDelete}
          disabled={deleting || selected.length === 0}
          className="px-1 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
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
    className="px-1 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
  >
    🧨 Xoá toàn bộ lịch sử xoá
  </button>
</div>
      </div>
    </div>
  )
}