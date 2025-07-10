'use client'

import { createClient } from '@supabase/supabase-js'
import {
  formatNumber,
  formatPercent,
  calculatePnL,
  calculatePnLPercentage,
} from '@/lib/utils'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function TransactionList({
  transactions,
  onRefresh,
  setEditingTx,
}: {
  transactions: any[]
  onRefresh: () => void
  setEditingTx: (tx: any) => void
}) {
  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xoá giao dịch này?')) return
    const { error } = await supabase.from('portfolio_transactions').delete().eq('id', id)
    if (!error) onRefresh()
    else alert('❌ Lỗi xoá: ' + error.message)
  }

  return (
    <div className="space-y-4">
      {transactions.map((tx) => {
        const pnl = calculatePnL(tx.buyprice, tx.currentprice, tx.quantity)
        const pnlPercent = calculatePnLPercentage(tx.buyprice, tx.currentprice)
        const isProfit = pnl >= 0
        const totalInvested = tx.quantity * tx.buyprice

        return (
          <div key={tx.id} className="bg-zinc-900 rounded-xl p-4 shadow-md text-white">
            <div className="flex justify-between items-center mb-1">
              <h2 className="text-lg font-semibold">
                {tx.assetname} <span className="text-sm text-gray-400">({tx.category})</span>
              </h2>
              <div className="flex gap-3">
                <button
                  onClick={() => setEditingTx(tx)}
                  className="text-blue-400 text-sm hover:underline"
                >
                  ✏️ Sửa
                </button>
                <button
                  onClick={() => handleDelete(tx.id)}
                  className="text-red-400 text-sm hover:underline"
                >
                  🗑️ Xoá
                </button>
              </div>
            </div>

            <div className="text-sm text-gray-300 space-y-1">
              <div className="text-yellow-300 font-semibold">
                💰 Tổng đầu tư: {formatNumber(totalInvested)} đ
              </div>
              <div>💸 Giá mua: {formatNumber(tx.buyprice)} đ</div>
              <div>📈 Giá hiện tại: <span className={isProfit ? 'text-green-400' : 'text-red-400'}>{formatNumber(tx.currentprice)} đ</span></div>
              <div>🔢 Khối lượng: {formatNumber(tx.quantity)}</div>
              <div>💸 Phí: {formatNumber(tx.transactionfee)} đ</div>
              <div>📊 Lãi/lỗ: <span className={isProfit ? 'text-green-400' : 'text-red-400'}>{formatNumber(pnl)} đ ({formatPercent(pnlPercent)})</span></div>
              <div>📌 Trạng thái: {tx.issold ? '✅ Đã bán' : '🕒 Đang nắm giữ'}</div>
              <div>🧠 Chiến lược: {tx.strategy || '—'}</div>
              <div>📝 Ghi chú: {tx.note || '—'}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
