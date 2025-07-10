'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import TransactionList from '@/components/portfolio/TransactionList'
import AddTransactionForm from '@/components/portfolio/AddTransactionForm'
import EditTransactionForm from '@/components/portfolio/EditTransactionForm'

export default function PortfolioPage() {
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingTx, setEditingTx] = useState<any | null>(null)

  const router = useRouter()

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error || !session) {
        router.push('/login')
        return
      }
      const user = session.user
      const name = user.user_metadata?.full_name || user.email
      setUserName(name)
      setLoading(false)
    }
    fetchUser()
  }, [router])

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
            <h2 className="text-lg font-semibold text-blue-400 mb-4">➕ Thêm giao dịch mới</h2>
            <AddTransactionForm onSaved={fetchTransactions} />
          </div>
        )}
      </div>
    </div>
  )
}
