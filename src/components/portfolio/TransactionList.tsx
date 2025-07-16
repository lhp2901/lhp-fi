'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createBrowserClient } from '@supabase/ssr'
import {
  formatNumber,
  formatPercent,
  calculatePnL,
  calculatePnLPercentage,
} from '@/lib/utils'

// 👉 Kết nối Supabase
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function TransactionList({
  transactions,
  setEditingTx,
  onRefresh,
}: {
  transactions: any[]
  setEditingTx: (tx: any) => void
  onRefresh?: () => void
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    try {
      if (!id || typeof id !== 'string') {
        alert('❌ ID không hợp lệ!')
        return
      }

      const confirmDelete = confirm('Bạn chắc chắn muốn xoá giao dịch này?')
      if (!confirmDelete) return

      setDeletingId(id)

      const { error } = await supabase
        .from('portfolio_transactions')
        .delete()
        .eq('id', id)

      setDeletingId(null)

      if (error) {
        console.error('[DELETE ERROR]', error)
        alert('❌ Không thể xoá: ' + error.message)
      } else {
        alert('✅ Đã xoá giao dịch!')
        onRefresh?.() // 💥 Gọi lại để cha fetch lại danh sách mới
      }
    } catch (err: any) {
      console.error('[UNEXPECTED ERROR]', err)
      alert('🚨 Đã xảy ra lỗi không mong muốn!')
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {transactions.map((tx) => {
          const {
            id,
            assetname,
            category,
            issold,
            sellprice,
            currentprice,
            buyprice,
            quantity,
            transactionfee,
            sellfee,
            strategy,
            note,
          } = tx

          const isSold = issold
          const current = isSold && sellprice ? sellprice : currentprice
          const pnl = calculatePnL(buyprice, current, quantity)
          const pnlPercent = calculatePnLPercentage(buyprice, current)
          const isProfit = pnl >= 0
          const totalInvested = quantity * buyprice
          const totalFee = transactionfee + (sellfee || 0)

          return (
            <motion.div
              key={id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="bg-zinc-900 rounded-xl p-4 shadow-md text-white space-y-2 relative"
            >
              {/* Skeleton loading xoá */}
              {deletingId === id && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10 rounded-xl">
                  <div className="animate-spin w-6 h-6 border-2 border-white border-b-transparent rounded-full" />
                </div>
              )}

              <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-semibold">
                  {assetname}{' '}
                  <span className="text-sm text-gray-400">({category})</span>
                </h2>
                <div className="flex gap-3">
                  <button
                    onClick={() => setEditingTx(tx)}
                    className="text-blue-400 text-sm hover:underline"
                    disabled={deletingId === id}
                  >
                    ✏️ Sửa
                  </button>
                  <button
                    onClick={() => handleDelete(id)}
                    className="text-red-400 text-sm hover:underline"
                    disabled={deletingId === id}
                  >
                    🗑️ Xoá
                  </button>
                </div>
              </div>

              <div className="text-sm text-gray-300 space-y-1">
                <div className="text-yellow-300 font-semibold">
                  💰 Tổng đầu tư: {formatNumber(totalInvested)} đ
                </div>
                <div>💸 Giá mua: {formatNumber(buyprice)} đ</div>
                <div>
                  📈 Giá {isSold ? 'bán' : 'hiện tại'}:{' '}
                  <span className={isProfit ? 'text-green-400' : 'text-red-400'}>
                    {formatNumber(current)} đ
                  </span>
                </div>
                <div>🔢 Khối lượng: {formatNumber(quantity)}</div>
                <div className="text-blue-400">
                  💸 Phí tổng: {formatNumber(totalFee)} đ
                </div>
                <div>
                  📊 Lãi/Lỗ:{' '}
                  <span className={isProfit ? 'text-green-400' : 'text-red-400'}>
                    {formatNumber(pnl)} đ ({formatPercent(pnlPercent)})
                  </span>
                </div>
                <div>
                  📌 Trạng thái: {isSold ? '✅ Đã bán' : '🕒 Đang nắm giữ'}
                </div>
                <div>🧠 Chiến lược: {strategy || '—'}</div>
                <div className="text-orange-500">
                  📝 Ghi chú: {note || '—'}
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
