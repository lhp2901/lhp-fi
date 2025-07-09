'use client'

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function TransactionTable({
  transactions,
  onRefresh,
}: {
  transactions: any[]
  onRefresh: () => void
}) {
  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xoá giao dịch này?')) return
    const { error } = await supabase.from('portfolio_transactions').delete().eq('id', id)
    if (!error) onRefresh()
    else alert('❌ Lỗi xoá: ' + error.message)
  }

  if (transactions.length === 0) return <p className="text-gray-400">Chưa có giao dịch nào.</p>

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-left text-white">
        <thead className="bg-zinc-800 text-gray-300">
          <tr>
            <th className="p-2">Mã</th>
            <th className="p-2">Loại</th>
            <th className="p-2">SL</th>
            <th className="p-2">Giá</th>
            <th className="p-2">Phí</th>
            <th className="p-2">Chiến lược</th>
            <th className="p-2">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id} className="border-b border-zinc-700">
              <td className="p-2 font-medium text-teal-300">{tx.symbol}</td>
              <td className="p-2">{tx.type}</td>
              <td className="p-2">{tx.quantity}</td>
              <td className="p-2">{tx.price}</td>
              <td className="p-2">{tx.fee?.toFixed(2) || '0'}</td>
              <td className="p-2">{tx.strategy}</td>
              <td className="p-2">
                <button
                  onClick={() => handleDelete(tx.id)}
                  className="text-red-400 hover:text-red-600"
                >
                  Xoá
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
