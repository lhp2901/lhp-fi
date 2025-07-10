'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  calculatePnL,
  formatNumber,
} from '@/lib/utils'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import EditTransactionForm from './EditTransactionForm'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const COLORS = ['#FFBB28', '#00C49F', '#8884d8']

export default function DashboardReport() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [editingTx, setEditingTx] = useState<any | null>(null)

  const [filterType, setFilterType] = useState('Tùy chọn')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const fetchData = async (from?: string, to?: string) => {
    let query = supabase.from('portfolio_transactions').select('*')
    if (from && to) {
      query = query.gte('created_at', from).lte('created_at', to)
    }
    const { data, error } = await query
    if (!error && data) setTransactions(data)
  }

  useEffect(() => {
    const today = new Date()
    let from = new Date()

    if (filterType === 'Tuần') {
      from.setDate(today.getDate() - 7)
    } else if (filterType === 'Tháng') {
      from.setMonth(today.getMonth() - 1)
    } else if (filterType === 'Ngày') {
      from.setDate(today.getDate() - 1)
    } else {
      // Nếu là Tùy chọn thì đợi người dùng bấm "Lọc"
      return
    }

    const fromDate = from.toISOString().split('T')[0]
    const toDate = today.toISOString().split('T')[0]
    fetchData(fromDate, toDate)
  }, [filterType])

  const totalInvested = transactions.reduce((sum, tx) => sum + tx.quantity * tx.buyprice, 0)
  const totalFee = transactions.reduce((sum, tx) => sum + (tx.transactionfee || 0) + (tx.sellfee || 0), 0)
  const totalPnL = transactions.reduce((sum, tx) => {
    const price = tx.issold ? tx.sellprice : tx.currentprice
    return sum + calculatePnL(tx.buyprice, price, tx.quantity)
  }, 0)
  const netProfit = totalPnL - totalFee

  const gainers = transactions.filter((tx) => {
    const price = tx.issold ? tx.sellprice : tx.currentprice
    return calculatePnL(tx.buyprice, price, tx.quantity) > 0
  })

  const losers = transactions.length - gainers.length

  const categoryDist = Object.entries(
    transactions.reduce((acc, tx) => {
      acc[tx.category] = (acc[tx.category] || 0) + tx.quantity * tx.buyprice
      return acc
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }))

  const sortedByPnL = [...transactions].sort((a, b) => {
    const pnlA = calculatePnL(a.buyprice, a.issold ? a.sellprice : a.currentprice, a.quantity)
    const pnlB = calculatePnL(b.buyprice, b.issold ? b.sellprice : b.currentprice, b.quantity)
    return pnlB - pnlA
  })

  return (
    <div className="p-6 space-y-6 text-white max-w-7xl mx-auto">

      {/* Bộ lọc */}
      <div className="bg-zinc-900 p-4 rounded-xl">
        <div className="flex flex-wrap gap-2 items-center mb-2">
          <label className="text-sm">📅 Lọc theo:</label>
          <select
            className="bg-zinc-800 text-white p-1 rounded"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option>Ngày</option>
            <option>Tuần</option>
            <option>Tháng</option>
            <option>Tùy chọn</option>
          </select>

          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-zinc-800 text-white p-1 rounded" />
          <span className="text-white">-</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-zinc-800 text-white p-1 rounded" />
          <button onClick={() => fetchData(startDate, endDate)} className="bg-blue-500 text-white px-2 py-1 rounded">Lọc</button>
        </div>
      </div>

      {/* Tổng quan danh mục */}
      <div className="bg-zinc-900 p-4 rounded-xl">
        <h2 className="text-xl font-bold mb-4">🧠 Tổng Quan Danh Mục</h2>
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="text-yellow-400 whitespace-nowrap">💼 Tổng đầu tư: {formatNumber(totalInvested)} đ</div>
          <div className="text-green-400 whitespace-nowrap">📈 Giao dịch lãi: {gainers.length}</div>
          <div className="text-red-400 whitespace-nowrap">📉 Giao dịch lỗ: {losers}</div>
          <div className="text-blue-400 whitespace-nowrap">💰 Lãi sau phí: {formatNumber(netProfit)} đ</div>
          <div className="text-gray-300 whitespace-nowrap">🗂 Tổng giao dịch: {transactions.length}</div>
        </div>
      </div>

      {/* Biểu đồ chia đôi */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-zinc-900 p-4 rounded-xl">
          <h2 className="text-xl font-bold mb-4">📊 Phân Bổ Danh Mục</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={categoryDist} dataKey="value" nameKey="name" outerRadius={100}>
                {categoryDist.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => `${formatNumber(value)} đ`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-zinc-900 p-4 rounded-xl">
          <h2 className="text-xl font-bold mb-2">🔍 Top 5 Giao Dịch Theo Lãi</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={sortedByPnL.slice(0, 5)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="assetname" />
              <YAxis />
              <Tooltip formatter={(value: any) => `${formatNumber(value)} đ`} />
              <Bar
                dataKey={(tx) => calculatePnL(tx.buyprice, tx.issold ? tx.sellprice : tx.currentprice, tx.quantity)}
                fill="#8884d8"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Danh sách giao dịch */}
      <div className="bg-zinc-900 p-4 rounded-xl overflow-x-auto">
        <h2 className="text-xl font-bold mb-2">📋 Danh Sách Giao Dịch</h2>
        <table className="min-w-full text-sm text-left text-white">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="p-2">Mã</th>
              <th className="p-2">Danh mục</th>
              <th className="p-2">Lãi/lỗ</th>
              <th className="p-2">Trạng thái</th>
              <th className="p-2">✏️</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => {
              const price = tx.issold ? tx.sellprice : tx.currentprice
              const pnl = calculatePnL(tx.buyprice, price, tx.quantity)
              const isProfit = pnl >= 0
              return (
                <tr key={tx.id} className="border-b border-gray-800">
                  <td className="p-2">{tx.assetname}</td>
                  <td className="p-2">{tx.category}</td>
                  <td className={`p-2 ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                    {formatNumber(pnl)} đ
                  </td>
                  <td className="p-2">{tx.issold ? '✅ Đã bán' : '🕒 Nắm giữ'}</td>
                  <td className="p-2">
                    <button onClick={() => setEditingTx(tx)} className="text-blue-400 hover:underline text-sm">
                      ✏️ Sửa
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* AI Suggestion */}
      <div className="bg-zinc-900 p-4 rounded-xl">
        <h2 className="text-xl font-bold mb-2">💡 Gợi Ý AI</h2>
        <ul className="list-disc list-inside text-sm text-gray-300">
          {losers > gainers.length && (
            <li>Bạn đang có nhiều giao dịch lỗ hơn lãi. Xem xét lại chiến lược?</li>
          )}
          {categoryDist.find((c) => c.name === 'Crypto' && (c.value as number) / (totalInvested || 1) > 1) && (
            <li>Tỷ trọng Crypto đang quá cao trong danh mục. Rủi ro cần cân nhắc!</li>
          )}
          {sortedByPnL[0] && (
            <li>
              Giao dịch lợi nhuận cao nhất: {sortedByPnL[0].assetname} với lãi khoảng{' '}
              {formatNumber(
                calculatePnL(
                  sortedByPnL[0].buyprice,
                  sortedByPnL[0].issold ? sortedByPnL[0].sellprice : sortedByPnL[0].currentprice,
                  sortedByPnL[0].quantity
                )
              )} đ
            </li>
          )}
        </ul>
      </div>

      {/* Sửa giao dịch */}
      {editingTx && (
        <EditTransactionForm
          initial={editingTx}
          onCancel={() => setEditingTx(null)}
          onSave={() => {
            setEditingTx(null)
            fetchData()
          }}
        />
      )}
    </div>
  )
}
