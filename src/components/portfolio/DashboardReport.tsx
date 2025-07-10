'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  calculatePnL,
  calculatePnLPercentage,
  formatNumber,
  formatPercent,
} from '@/lib/utils'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import EditTransactionForm from './EditTransactionForm'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const COLORS = ['#00C49F', '#FF8042', '#FFBB28']

export default function DashboardReport() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [editingTx, setEditingTx] = useState<any | null>(null)

  const fetchData = async () => {
    const { data, error } = await supabase.from('portfolio_transactions').select('*')
    if (!error && data) setTransactions(data)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const totalInvested = transactions.reduce((sum, tx) => sum + tx.quantity * tx.buyprice, 0)
  const totalFee = transactions.reduce(
    (sum, tx) => sum + (tx.transactionfee || 0) + (tx.sellfee || 0),
    0
  )
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
      {/* I. Tổng Quan Danh Mục */}
      <div className="bg-zinc-900 p-4 rounded-xl">
        <h2 className="text-xl font-bold mb-2">🧠 Tổng Quan Danh Mục</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>💼 Tổng đầu tư: {formatNumber(totalInvested)} đ</div>
          <div>📈 Giao dịch lãi: {gainers.length}</div>
          <div>📉 Giao dịch lỗ: {losers}</div>
          <div>💰 Lãi sau phí: {formatNumber(netProfit)} đ</div>
        </div>
      </div>

      {/* II. Biểu đồ */}
      <div className="bg-zinc-900 p-4 rounded-xl">
        <h2 className="text-xl font-bold mb-4">📈 Biểu đồ Phân Bổ Danh Mục</h2>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={categoryDist} dataKey="value" nameKey="name" outerRadius={100}>
              {categoryDist.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* III. Chi tiết theo nhóm */}
      <div className="bg-zinc-900 p-4 rounded-xl">
        <h2 className="text-xl font-bold mb-2">🔍 Chi Tiết Theo Nhóm</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={sortedByPnL.slice(0, 5)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="assetname" />
            <YAxis />
            <Tooltip />
            <Bar
              dataKey={(tx) => calculatePnL(tx.buyprice, tx.issold ? tx.sellprice : tx.currentprice, tx.quantity)}
              fill="#8884d8"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* IV. Danh sách giao dịch */}
      <div className="bg-zinc-900 p-4 rounded-xl overflow-x-auto">
        <h2 className="text-xl font-bold mb-2">🗂️ Danh Sách Giao Dịch</h2>
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
                  <td className={`p-2 ${isProfit ? 'text-green-400' : 'text-red-400'}`}>{formatNumber(pnl)} đ</td>
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

      {/* V. Insight đề xuất */}
      <div className="bg-zinc-900 p-4 rounded-xl">
        <h2 className="text-xl font-bold mb-2">💡 AI Suggestion Zone</h2>
        <ul className="list-disc list-inside text-sm text-gray-300">
          {typeof losers === 'number' && typeof gainers.length === 'number' && losers > gainers.length && (
            <li>Bạn đang có nhiều giao dịch lỗ hơn lãi. Xem xét lại chiến lược?</li>
          )}
          {categoryDist.find(
            (c) =>
              c.name === 'Crypto' &&
              typeof c.value === 'number' &&
              c.value / (totalInvested || 1) > 1
          ) && (
            <li>Tỷ trọng Crypto đang chiếm quá cao trong danh mục. Rủi ro?</li>
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

      {/* VI. Form chỉnh sửa nếu có */}
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
