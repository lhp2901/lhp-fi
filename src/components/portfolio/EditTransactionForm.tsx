'use client'

import { useEffect, useState } from 'react'
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

type FormData = {
  id?: string
  assetname: string
  category: string
  quantity: string
  buyprice: string
  currentprice: string
  buydate: string
  note: string
  strategy: string
  tags: string
  source: string
  highconviction: boolean
  issold: boolean
  sellprice: string
  sellfee: string
}

const emptyForm: FormData = {
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

export default function EditTransactionForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: any
  onCancel: () => void
  onSave: (form: any) => void
}) {
  const safeInitial: FormData = {
    ...emptyForm,
    ...initial,
    quantity: initial?.quantity?.toLocaleString() || '',
    buyprice: initial?.buyprice?.toLocaleString() || '',
    currentprice: initial?.currentprice?.toLocaleString() || '',
    sellprice: initial?.sellprice?.toLocaleString() || '',
    sellfee: initial?.sellfee?.toLocaleString() || '',
    tags: Array.isArray(initial?.tags) ? initial.tags.join(', ') : initial?.tags || '',
    highconviction: !!initial?.highconviction,
    issold: !!initial?.issold,
  }

  const [form, setForm] = useState<FormData>(safeInitial)
  const [saving, setSaving] = useState(false)

  const quantity = parseNumber(form.quantity)
  const buyprice = parseNumber(form.buyprice)
  const currentprice = parseNumber(form.currentprice)
  const sellprice = parseNumber(form.sellprice)
  const feeRate =
    form.category === 'Crypto' ? 0.002 : form.category === 'VN30F1M' ? 0.0004 : 0.0015
  const transactionfee = calculateFee(quantity, buyprice, feeRate)

  const pnl = calculatePnL(buyprice, currentprice, quantity)
  const pnlPercent = calculatePnLPercentage(buyprice, currentprice)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target
    const newValue =
      type === 'checkbox' && 'checked' in e.target
        ? (e.target as HTMLInputElement).checked
        : ['buyprice', 'quantity', 'currentprice', 'sellprice', 'sellfee'].includes(name)
        ? formatNumber(parseNumber(value))
        : value

    setForm(prev => ({
      ...prev,
      [name]: newValue,
    }))
  }

  useEffect(() => {
    if (form.issold && !form.sellfee && form.sellprice) {
      const qty = parseNumber(form.quantity)
      const sellP = parseNumber(form.sellprice)
      const sellFee = calculateFee(qty, sellP, feeRate)
      setForm(prev => ({
        ...prev,
        sellfee: formatNumber(sellFee),
      }))
    }
  }, [form.sellprice, form.issold])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const updated = {
      ...form,
      assetname: toUpperCaseTrim(form.assetname),
      quantity: parseNumber(form.quantity),
      buyprice: parseNumber(form.buyprice),
      currentprice: parseNumber(form.currentprice),
      sellprice: form.issold ? parseNumber(form.sellprice) : null,
      sellfee: form.issold ? parseNumber(form.sellfee) : null,
      tags: splitTags(form.tags),
      transactionfee,
    }

    await onSave(updated)
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-zinc-800 p-4 rounded-xl">
      <h2 className="text-lg text-white font-bold">✏️ Chỉnh sửa giao dịch</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-gray-400">Mã tài sản</label>
          <input
            name="assetname"
            value={form.assetname}
            onChange={handleChange}
            className="w-full p-2 rounded bg-zinc-700 text-white"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400">Danh mục</label>
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            className="w-full p-2 rounded bg-zinc-700 text-white"
          >
            <option value="">-- Chọn loại --</option>
            <option value="Cổ phiếu">✨ Cổ phiếu</option>
            <option value="Crypto">🪙 Crypto</option>
            <option value="VN30F1M">📊 VN30F1M</option>
          </select>
        </div>

        <div>
          <label className="text-sm text-gray-400">Khối lượng</label>
          <input
            name="quantity"
            value={form.quantity}
            onChange={handleChange}
            className="w-full p-2 rounded bg-zinc-700 text-white text-right"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400">Giá mua</label>
          <input
            name="buyprice"
            value={form.buyprice}
            onChange={handleChange}
            className="w-full p-2 rounded bg-zinc-700 text-white text-right"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400">Giá hiện tại</label>
          <input
            name="currentprice"
            value={form.currentprice}
            onChange={handleChange}
            className="w-full p-2 rounded bg-zinc-700 text-white text-right"
          />
        </div>

        <div className="text-sm text-green-400">
          Lãi/lỗ tạm tính: {formatNumber(pnl)} đ ({formatPercent(pnlPercent)})
        </div>

        <div className="text-sm text-yellow-300">
          Phí giao dịch: {formatNumber(transactionfee)} đ
        </div>

        <div>
          <label className="text-sm text-gray-400">Chiến lược</label>
          <input
            name="strategy"
            value={form.strategy}
            onChange={handleChange}
            className="w-full p-2 rounded bg-zinc-700 text-white"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400">Tags</label>
          <input
            name="tags"
            value={form.tags}
            onChange={handleChange}
            className="w-full p-2 rounded bg-zinc-700 text-white"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400">Nguồn</label>
          <input
            name="source"
            value={form.source}
            onChange={handleChange}
            className="w-full p-2 rounded bg-zinc-700 text-white"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400">Ngày mua</label>
          <input
            type="date"
            name="buydate"
            value={form.buydate}
            onChange={handleChange}
            className="w-full p-2 rounded bg-zinc-700 text-white"
          />
        </div>
      </div>

      <div className="text-sm text-gray-400">Ghi chú</div>
      <textarea
        name="note"
        value={form.note}
        onChange={handleChange}
        className="w-full p-2 rounded bg-zinc-700 text-white"
      />

      <div className="flex flex-wrap gap-2 mt-2">
        {emotionPresets.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, note: e }))}
            className={`text-xs px-2 py-1 rounded-full border ${
              form.note === e
                ? 'bg-yellow-300 text-black'
                : 'text-gray-400 border-gray-600'
            }`}
          >
            {e}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 mt-4">
        <label className="flex items-center gap-2 text-white">
          <input
            type="checkbox"
            name="highconviction"
            checked={form.highconviction}
            onChange={handleChange}
          />
          Tự tin cao
        </label>
        <label className="flex items-center gap-2 text-white">
          <input
            type="checkbox"
            name="issold"
            checked={form.issold}
            onChange={handleChange}
          />
          Đã bán
        </label>
      </div>

      {form.issold && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-400">Giá bán</label>
            <input
              name="sellprice"
              value={form.sellprice}
              onChange={handleChange}
              className="w-full p-2 rounded bg-zinc-700 text-white text-right"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400">Phí bán</label>
            <input
              name="sellfee"
              value={form.sellfee}
              onChange={handleChange}
              className="w-full p-2 rounded bg-zinc-700 text-white text-right"
            />
          </div>
        </div>
      )}

      <div className="flex gap-3 mt-4">
        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          💾 {saving ? 'Đang lưu...' : 'Cập nhật'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
        >
          ❌ Huỷ
        </button>
      </div>
    </form>
  )
}
