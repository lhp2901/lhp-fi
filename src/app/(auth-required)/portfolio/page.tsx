'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase' // ✅ Dùng chung supabase instance
import TransactionTable from '@/components/portfolio/TransactionTable'
import AddTransactionForm from '@/components/portfolio/AddTransactionForm'

export default function PortfolioDashboard() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from('portfolio_transactions')
      .select('*')
      .order('created_at', { ascending: false })
    setTransactions(data || [])
  }

  useEffect(() => {
    fetchTransactions()
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-teal-400">📋 Lịch sử giao dịch</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-blue-400 hover:underline"
          >
            {showForm ? '− Ẩn nhập liệu' : '+ Thêm giao dịch mới'}
          </button>
        </div>

        <TransactionTable transactions={transactions} onRefresh={fetchTransactions} />

        {showForm && (
          <div className="mt-6 border-t border-white/10 pt-6">
            <h2 className="text-lg font-semibold text-blue-400 mb-4">➕ Thêm giao dịch mới</h2>
            <AddTransactionForm onSaved={fetchTransactions} />
          </div>
        )}
      </div>
    </div>
  )
}
