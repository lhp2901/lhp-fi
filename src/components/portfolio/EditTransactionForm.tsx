
'use client'

import { useEffect, useMemo, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

import {
  calculateFee,
  calculatePnL,
  calculatePnLPercentage,
  formatPercent,
  parseNumber,
  splitTags,
  toUpperCaseTrim,
} from '@/lib/utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createBrowserClient(supabaseUrl, supabaseAnonKey)
    : null

const feePresets = {
  TCBS: {
    label: 'TCBS',
    rate: 0.0015,
    description: 'Phí 0,15%',
  },
  HSC: {
    label: 'HSC',
    rate: 0.0015,
    description: 'Phí 0,15%',
  },
  OKX: {
    label: 'OKX',
    rate: 0.002,
    description: 'Phí 0,20%',
  },
  Binance: {
    label: 'Binance',
    rate: 0.001,
    description: 'Phí 0,10%',
  },
} as const

type FeePresetKey = keyof typeof feePresets

export type EditableTransaction = {
  id: string
  user_id?: string
  assetname: string
  category: string
  quantity: number | string
  buyprice: number | string
  currentprice: number | string
  buydate: string
  note?: string | null
  strategy?: string | null
  tags?: string[] | string | null
  source?: string | null
  highconviction?: boolean | null
  transactionfee?: number | string | null
  issold?: boolean | null
  sellprice?: number | string | null
  sellfee?: number | string | null
}

type EditTransactionFormProps = {
  transaction: EditableTransaction
  onSaved?: () => void | Promise<void>
  onCancel?: () => void
}

type FormState = {
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
  feePreset: FeePresetKey
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (value === null || value === undefined || value === '') {
    return 0
  }

  const parsed = Number(parseNumber(String(value)))
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 2,
  }).format(value)
}

function formatInputNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function normalizeNumericInput(value: string): string {
  return value.replace(/[^\d.,]/g, '')
}

function tagsToString(tags: EditableTransaction['tags']): string {
  if (Array.isArray(tags)) {
    return tags.join(', ')
  }

  if (typeof tags === 'string') {
    return tags
  }

  return ''
}

function getInitialForm(
  transaction: EditableTransaction
): FormState {
  return {
    assetname: transaction.assetname ?? '',
    category: transaction.category ?? 'Cổ phiếu',
    quantity: formatInputNumber(transaction.quantity),
    buyprice: formatInputNumber(transaction.buyprice),
    currentprice: formatInputNumber(transaction.currentprice),
    buydate: transaction.buydate
      ? transaction.buydate.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    note: transaction.note ?? '',
    strategy: transaction.strategy ?? '',
    tags: tagsToString(transaction.tags),
    source: transaction.source ?? '',
    highconviction: Boolean(transaction.highconviction),
    feePreset: 'TCBS',
  }
}

export default function EditTransactionForm({
  transaction,
  onSaved,
  onCancel,
}: EditTransactionFormProps) {
  const [form, setForm] = useState<FormState>(() =>
    getInitialForm(transaction)
  )

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Cập nhật biểu mẫu khi người dùng chọn giao dịch khác để sửa.
  useEffect(() => {
    setForm(getInitialForm(transaction))
    setError('')
    setSuccess('')
  }, [transaction])

  const quantity = toNumber(form.quantity)
  const buyPrice = toNumber(form.buyprice)
  const currentPrice = toNumber(form.currentprice)

  const feeRate = feePresets[form.feePreset].rate

  const transactionFee = useMemo(
    () => calculateFee(quantity, buyPrice, feeRate),
    [quantity, buyPrice, feeRate]
  )

  const estimatedPnL = useMemo(
    () =>
      calculatePnL(buyPrice, currentPrice, quantity) -
      transactionFee,
    [buyPrice, currentPrice, quantity, transactionFee]
  )

  const estimatedPnLPercentage = useMemo(
    () => calculatePnLPercentage(buyPrice, currentPrice),
    [buyPrice, currentPrice]
  )

  const handleChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const target = event.target
    const { name, value } = target

    setForm((previous) => ({
      ...previous,
      [name]:
        target instanceof HTMLInputElement &&
        target.type === 'checkbox'
          ? target.checked
          : value,
    }))

    setError('')
    setSuccess('')
  }

  const handleNumericChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = event.target

    setForm((previous) => ({
      ...previous,
      [name]: normalizeNumericInput(value),
    }))

    setError('')
    setSuccess('')
  }

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    setError('')
    setSuccess('')

    if (loading) return

    if (!supabase) {
      setError(
        'Supabase chưa được cấu hình. Hãy kiểm tra biến môi trường.'
      )
      return
    }

    const assetname = toUpperCaseTrim(form.assetname)

    if (!transaction.id) {
      setError('Không xác định được giao dịch cần cập nhật.')
      return
    }

    if (!assetname) {
      setError('Vui lòng nhập mã tài sản.')
      return
    }

    if (!form.category) {
      setError('Vui lòng chọn danh mục tài sản.')
      return
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('Khối lượng phải lớn hơn 0.')
      return
    }

    if (!Number.isFinite(buyPrice) || buyPrice <= 0) {
      setError('Giá mua phải lớn hơn 0.')
      return
    }

    if (!Number.isFinite(currentPrice) || currentPrice < 0) {
      setError('Giá hiện tại không hợp lệ.')
      return
    }

    if (!form.buydate) {
      setError('Vui lòng chọn ngày mua.')
      return
    }

    setLoading(true)

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) throw authError

      if (!user) {
        throw new Error(
          'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        )
      }

      const updatePayload = {
        assetname,
        category: form.category,
        quantity,
        buyprice: buyPrice,
        currentprice: currentPrice,
        buydate: form.buydate,
        note: form.note.trim() || null,
        strategy: form.strategy.trim() || null,
        tags: splitTags(form.tags),
        source: form.source.trim() || null,
        highconviction: form.highconviction,
        transactionfee: transactionFee,
      }

      const { data, error: updateError } = await supabase
        .from('portfolio_transactions')
        .update(updatePayload)
        .eq('id', transaction.id)
        .eq('user_id', user.id)
        .select('id')

      if (updateError) throw updateError

      if (!data || data.length === 0) {
        throw new Error(
          'Không cập nhật được giao dịch. Hãy kiểm tra quyền truy cập RLS trên Supabase.'
        )
      }

      setSuccess(`Đã cập nhật giao dịch ${assetname} thành công.`)

      if (onSaved) {
        await onSaved()
      }
    } catch (err) {
      console.error('Lỗi cập nhật giao dịch:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Không thể cập nhật giao dịch. Vui lòng thử lại.'
      )
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'

  const labelClass = 'block text-sm font-medium text-zinc-300'

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 text-white md:p-6"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-xl font-bold">
            ✏️ Chỉnh sửa giao dịch
          </h2>

          <p className="mt-1 text-sm text-zinc-400">
            Cập nhật thông tin giao dịch {transaction.assetname}.
          </p>
        </div>

        <span className="w-fit rounded-full border border-amber-800 bg-amber-950/40 px-3 py-1 text-xs text-amber-300">
          ID: {transaction.id.slice(0, 8)}
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="break-words rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="break-words rounded-xl border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-300"
        >
          {success}
        </div>
      )}

      {/* THÔNG TIN TÀI SẢN */}
      <section className="space-y-4">
        <h3 className="border-b border-zinc-800 pb-2 text-sm font-semibold text-emerald-400">
          1. Thông tin tài sản
        </h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className={labelClass}>
            Mã tài sản *
            <input
              name="assetname"
              value={form.assetname}
              onChange={handleChange}
              placeholder="Ví dụ: FPT, HPG, BTC..."
              maxLength={30}
              required
              className={inputClass}
            />
          </label>

          <label className={labelClass}>
            Danh mục *
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              required
              className={inputClass}
            >
              <option value="Cổ phiếu">Cổ phiếu</option>
              <option value="Crypto">Crypto</option>
              <option value="VN30F1M">VN30F1M</option>
            </select>
          </label>

          <label className={labelClass}>
            Ngày mua *
            <input
              type="date"
              name="buydate"
              value={form.buydate}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </label>

          <label className={labelClass}>
            Nguồn giao dịch
            <input
              name="source"
              value={form.source}
              onChange={handleChange}
              placeholder="TCBS, DNSE, Binance..."
              className={inputClass}
            />
          </label>
        </div>
      </section>

      {/* KHỐI LƯỢNG VÀ GIÁ */}
      <section className="space-y-4">
        <h3 className="border-b border-zinc-800 pb-2 text-sm font-semibold text-emerald-400">
          2. Khối lượng và giá
        </h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className={labelClass}>
            Khối lượng *
            <input
              type="text"
              inputMode="decimal"
              name="quantity"
              value={form.quantity}
              onChange={handleNumericChange}
              required
              className={inputClass}
            />
          </label>

          <label className={labelClass}>
            Giá mua *
            <input
              type="text"
              inputMode="decimal"
              name="buyprice"
              value={form.buyprice}
              onChange={handleNumericChange}
              required
              className={inputClass}
            />
          </label>

          <label className={labelClass}>
            Giá hiện tại *
            <input
              type="text"
              inputMode="decimal"
              name="currentprice"
              value={form.currentprice}
              onChange={handleNumericChange}
              required
              className={inputClass}
            />
          </label>
        </div>
      </section>

      {/* PHÍ GIAO DỊCH */}
      <section className="space-y-3">
        <h3 className="border-b border-zinc-800 pb-2 text-sm font-semibold text-emerald-400">
          3. Phí giao dịch
        </h3>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(Object.keys(feePresets) as FeePresetKey[]).map((key) => {
            const preset = feePresets[key]
            const active = form.feePreset === key

            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  setForm((previous) => ({
                    ...previous,
                    feePreset: key,
                  }))
                }
                className={`rounded-xl border p-3 text-left transition ${
                  active
                    ? 'border-emerald-500 bg-emerald-950/40 ring-1 ring-emerald-500'
                    : 'border-zinc-700 bg-zinc-950 hover:border-zinc-500'
                }`}
              >
                <div className="font-semibold">{preset.label}</div>
                <div className="mt-1 text-xs text-zinc-400">
                  {preset.description}
                </div>
              </button>
            )
          })}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-zinc-400">
              Phí mua ước tính
            </span>

            <span className="font-bold text-amber-300">
              {formatMoney(transactionFee)} đ
            </span>
          </div>

          <p className="mt-2 text-xs text-zinc-500">
            Lưu ý: mức phí được tính lại theo lựa chọn hiện tại. Nếu giao dịch
            trước đó dùng biểu phí khác, hãy chọn đúng biểu phí trước khi lưu.
          </p>
        </div>
      </section>

      {/* ƯỚC TÍNH LÃI LỖ */}
      <section className="space-y-3">
        <h3 className="border-b border-zinc-800 pb-2 text-sm font-semibold text-emerald-400">
          4. Ước tính hiệu quả
        </h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <PreviewCard
            title="Giá trị mua"
            value={`${formatMoney(quantity * buyPrice)} đ`}
          />

          <PreviewCard
            title="Giá trị hiện tại"
            value={`${formatMoney(quantity * currentPrice)} đ`}
          />

          <PreviewCard
            title="Lãi/lỗ ước tính"
            value={`${estimatedPnL > 0 ? '+' : ''}${formatMoney(estimatedPnL)} đ`}
            valueClass={
              estimatedPnL >= 0
                ? 'text-emerald-400'
                : 'text-red-400'
            }
          />
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
          <span className="text-sm text-zinc-400">
            Tỷ suất biến động giá
          </span>

          <p
            className={`mt-2 text-xl font-bold ${
              estimatedPnLPercentage >= 0
                ? 'text-emerald-400'
                : 'text-red-400'
            }`}
          >
            {formatPercent(estimatedPnLPercentage)}
          </p>
        </div>
      </section>

      {/* CHIẾN LƯỢC VÀ GHI CHÚ */}
      <section className="space-y-4">
        <h3 className="border-b border-zinc-800 pb-2 text-sm font-semibold text-emerald-400">
          5. Chiến lược và ghi chú
        </h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className={labelClass}>
            Chiến lược đầu tư
            <input
              name="strategy"
              value={form.strategy}
              onChange={handleChange}
              placeholder="Tích lũy, breakout, theo dòng tiền..."
              className={inputClass}
            />
          </label>

          <label className={labelClass}>
            Tags
            <input
              name="tags"
              value={form.tags}
              onChange={handleChange}
              placeholder="Dài hạn, dòng tiền, theo dõi..."
              className={inputClass}
            />
          </label>
        </div>

        <label className={labelClass}>
          Ghi chú
          <textarea
            name="note"
            value={form.note}
            onChange={handleChange}
            rows={4}
            placeholder="Luận điểm đầu tư, kế hoạch chốt lời, mức cắt lỗ..."
            className={inputClass}
          />
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
          <input
            type="checkbox"
            name="highconviction"
            checked={form.highconviction}
            onChange={handleChange}
            className="mt-1 h-4 w-4 accent-emerald-500"
          />

          <span>
            <span className="block text-sm font-semibold">
              ⭐ Giao dịch có độ tin cậy cao
            </span>

            <span className="mt-1 block text-xs text-zinc-500">
              Đánh dấu giao dịch có luận điểm đầu tư rõ ràng.
            </span>
          </span>
        </label>
      </section>

      {/* NÚT THAO TÁC */}
      <div className="flex flex-col-reverse justify-end gap-3 border-t border-zinc-800 pt-5 sm:flex-row">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold transition hover:bg-zinc-800 disabled:opacity-50"
          >
            Hủy
          </button>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Đang cập nhật...' : '✓ Lưu thay đổi'}
        </button>
      </div>
    </form>
  )
}

function PreviewCard({
  title,
  value,
  valueClass = 'text-white',
}: {
  title: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
      <p className="text-xs text-zinc-400">{title}</p>

      <p className={`mt-2 break-words text-lg font-bold ${valueClass}`}>
        {value}
      </p>
    </div>
  )
}

