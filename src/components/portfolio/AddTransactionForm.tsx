'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  formatNumber,
  parseNumber,
  calculateFee,
  calculatePnL,
  calculatePnLPercentage,
  formatPercent,
  emotionPresets,
  splitTags,
  toUpperCaseTrim,
} from '@/lib/utils'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const emptyForm = {
  assetname: '',
  category: '',
  quantity: '',
  buyprice: '',
  currentprice: '',
  buydate: new Date().toISOString().split('T')[0],
  note: '',
  strategy: '',
  tags: '',
  source: '',
  highconviction: false,
  issold: false,
  sellprice: '',
  sellfee: '',
}

export default function AddTransactionForm({ onSaved }: { onSaved?: () => void }) {
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const quantity = parseNumber(form.quantity)
  const buyprice = parseNumber(form.buyprice)
  const currentprice = parseNumber(form.currentprice)
  const sellprice = parseNumber(form.sellprice)
  const sellfee = parseNumber(form.sellfee)

  const feeRate = form.category === 'Crypto' ? 0.002 : form.category === 'VN30F1M' ? 0.0004 : 0.0015
  const transactionfee = calculateFee(quantity, buyprice, feeRate)
  const pnl = calculatePnL(buyprice, currentprice, quantity)
  const pnlPercent = calculatePnLPercentage(buyprice, currentprice)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      alert('❌ Bạn chưa đăng nhập hoặc token hết hạn.')
      setSaving(false)
      return
    }

    const { error } = await supabase.from('portfolio_transactions').insert({
      assetname: toUpperCaseTrim(form.assetname),
      category: form.category,
      quantity,
      buyprice,
      currentprice,
      buydate: form.buydate,
      note: form.note || null,
      strategy: form.strategy || null,
      tags: splitTags(form.tags),
      source: form.source || null,
      highconviction: form.highconviction,
      transactionfee,
      issold: form.issold,
      sellprice: form.issold ? sellprice : null,
      sellfee: form.issold ? sellfee : null,
      user_id: user.id, // BẮT BUỘC
    })

    setSaving(false)

    if (error) {
      alert('❌ Lỗi lưu dữ liệu: ' + error.message)
    } else {
      onSaved?.()
      setForm(emptyForm)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm text-gray-400">📌 Mã tài sản</label>
        <input
          name="assetname"
          value={form.assetname}
          onChange={handleChange}
          placeholder="VD: BTC, VNM"
          className="w-full rounded-md p-2 bg-zinc-800 text-white"
        />
      </div>

      <div>
        <label className="text-sm text-gray-400">📂 Danh mục</label>
        <select
          name="category"
          value={form.category}
          onChange={handleChange}
          className="w-full rounded-md p-2 bg-zinc-800 text-white"
        >
          <option value="">-- Chọn loại --</option>
          <option value="Cổ phiếu">📈 Cổ phiếu</option>
          <option value="Crypto">🪙 Crypto</option>
          <option value="VN30F1M">📊 VN30F1M</option>
        </select>
      </div>

      <div>
        <label className="text-sm text-gray-400">🔢 Khối lượng</label>
        <input
          name="quantity"
          value={form.quantity}
          onChange={handleChange}
          placeholder="VD: 100"
          className="w-full rounded-md p-2 bg-zinc-800 text-white"
        />
      </div>

      <div>
        <label className="text-sm text-gray-400">💸 Giá mua</label>
        <input
          name="buyprice"
          value={form.buyprice}
          onChange={handleChange}
          placeholder="VD: 27.000"
          className="w-full rounded-md p-2 bg-zinc-800 text-white"
        />
      </div>

      <div>
        <label className="text-sm text-gray-400">💰 Giá hiện tại</label>
        <input
          name="currentprice"
          value={form.currentprice}
          onChange={handleChange}
          placeholder="VD: 28.000"
          className="w-full rounded-md p-2 bg-zinc-800 text-white"
        />
      </div>

      <div className="text-sm text-gray-400">
        💸 Phí mua: {formatNumber(transactionfee)} đ ({formatPercent(feeRate)})
      </div>

      <div className="text-sm text-gray-400">
        📈 Lãi/lỗ: {formatNumber(pnl)} đ ({formatPercent(pnlPercent)})
      </div>

      <div>
        <label className="text-sm text-gray-400">🧠 Chiến lược</label>
        <input
          name="strategy"
          value={form.strategy}
          onChange={handleChange}
          placeholder="VD: Dài hạn"
          className="w-full rounded-md p-2 bg-zinc-800 text-white"
        />
      </div>

      <div>
        <label className="text-sm text-gray-400">🏷️ Tags</label>
        <input
          name="tags"
          value={form.tags}
          onChange={handleChange}
          placeholder="VD: dài hạn, tăng trưởng"
          className="w-full rounded-md p-2 bg-zinc-800 text-white"
        />
      </div>

      <div>
        <label className="text-sm text-gray-400">📚 Nguồn</label>
        <input
          name="source"
          value={form.source}
          onChange={handleChange}
          placeholder="VD: AI gợi ý"
          className="w-full rounded-md p-2 bg-zinc-800 text-white"
        />
      </div>

      <div>
        <label className="text-sm text-gray-400">📝 Ghi chú</label>
        <textarea
          name="note"
          value={form.note}
          onChange={handleChange}
          className="w-full rounded-md p-2 bg-zinc-800 text-white"
        />
        <div className="flex flex-wrap gap-2 mt-2">
          {emotionPresets.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, note: e }))}
              className={`text-xs px-2 py-1 rounded-full border ${
                form.note === e ? 'bg-yellow-300 text-black' : 'text-gray-400 border-gray-600'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm text-gray-400">📅 Ngày mua</label>
        <input
          type="date"
          name="buydate"
          value={form.buydate}
          onChange={handleChange}
          className="w-full rounded-md p-2 bg-zinc-800 text-white"
        />
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" name="highconviction" checked={form.highconviction} onChange={handleChange} />
        <label className="text-sm text-gray-300">🔥 Tự tin cao</label>
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" name="issold" checked={form.issold} onChange={handleChange} />
        <label className="text-sm text-gray-300">✅ Đã bán</label>
      </div>

      {form.issold && (
        <>
          <div>
            <label className="text-sm text-gray-400">💵 Giá bán</label>
            <input
              name="sellprice"
              value={form.sellprice}
              onChange={handleChange}
              placeholder="VD: 30.000"
              className="w-full rounded-md p-2 bg-zinc-800 text-white"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400">💰 Phí bán</label>
            <input
              name="sellfee"
              value={form.sellfee}
              onChange={handleChange}
              placeholder="VD: 10.000"
              className="w-full rounded-md p-2 bg-zinc-800 text-white"
            />
          </div>
        </>
      )}

      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        💾 {saving ? 'Đang lưu...' : 'Lưu giao dịch'}
      </button>
    </form>
  )
}
