
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

import {
  calculateFee,
  calculatePnL,
  calculatePnLPercentage,
  formatNumber,
  formatPercent,
  parseNumber,
  splitTags,
  toUpperCaseTrim,
  emotionPresets,
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
    icon: '🏦',
    description: 'Phí giao dịch 0,15%',
  },
  HSC: {
    label: 'HSC',
    rate: 0.0015,
    icon: '📈',
    description: 'Phí giao dịch 0,15%',
  },
  OKX: {
    label: 'OKX',
    rate: 0.002,
    icon: '🪙',
    description: 'Phí giao dịch 0,20%',
  },
  Binance: {
    label: 'Binance',
    rate: 0.001,
    icon: '🟡',
    description: 'Phí giao dịch 0,10%',
  },
} as const

type FeePresetKey = keyof typeof feePresets

type TransactionForm = {
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

type AddTransactionFormProps = {
  onSaved?: () => void | Promise<void>
}

const emptyForm: TransactionForm = {
  assetname: '',
  category: 'Cổ phiếu',
  quantity: '',
  buyprice: '',
  currentprice: '',
  buydate: new Date().toISOString().split('T')[0],
  note: '',
  strategy: '',
  tags: '',
  source: '',
  highconviction: false,
  feePreset: 'TCBS',
}

function safeNumber(value: unknown): number {
  const result = Number(value ?? 0)
  return Number.isFinite(result) ? result : 0
}

function money(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 2,
  }).format(value)
}

function normalizeInputNumber(value: string): string {
  return value.replace(/[^\d.,]/g, '')
}

export default function AddTransactionForm({
  onSaved,
}: AddTransactionFormProps) {
  const [form, setForm] = useState<TransactionForm>(emptyForm)
  const [userId, setUserId] = useState<string | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadUser() {
      if (!supabase) {
        setError(
          'Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY.'
        )
        setLoadingUser(false)
        return
      }

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError) throw authError

        if (!cancelled) {
          setUserId(user?.id ?? null)

          if (!user) {
            setError('Vui lòng đăng nhập trước khi thêm giao dịch.')
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Không thể xác minh phiên đăng nhập.'
          )
        }
      } finally {
        if (!cancelled) setLoadingUser(false)
      }
    }

    void loadUser()

    return () => {
      cancelled = true
    }
  }, [])

  const quantity = useMemo(
    () => safeNumber(parseNumber(form.quantity)),
    [form.quantity]
  )

  const buyPrice = useMemo(
    () => safeNumber(parseNumber(form.buyprice)),
    [form.buyprice]
  )

  const currentPrice = useMemo(
    () => safeNumber(parseNumber(form.currentprice)),
    [form.currentprice]
  )

  const feeRate = feePresets[form.feePreset].rate

  const transactionFee = useMemo(
    () => safeNumber(calculateFee(quantity, buyPrice, feeRate)),
    [quantity, buyPrice, feeRate]
  )

  const estimatedPnL = useMemo(
    () =>
      safeNumber(calculatePnL(buyPrice, currentPrice, quantity)) -
      transactionFee,
    [buyPrice, currentPrice, quantity, transactionFee]
  )

  const estimatedPnLPercentage = useMemo(
    () => safeNumber(calculatePnLPercentage(buyPrice, currentPrice)),
    [buyPrice, currentPrice]
  )

  const totalPurchaseValue = quantity * buyPrice + transactionFee
  const currentMarketValue = quantity * currentPrice

  const handleChange = useCallback(
    (
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
    },
    []
  )

  const handleNumberChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = event.target

      setForm((previous) => ({
        ...previous,
        [name]: normalizeInputNumber(value),
      }))

      setError('')
      setSuccess('')
    },
    []
  )

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    setError('')
    setSuccess('')

    if (!supabase) {
      setError(
        'Supabase chưa được cấu hình. Vui lòng kiểm tra biến môi trường.'
      )
      return
    }

    if (submitting) return

    const assetname = toUpperCaseTrim(form.assetname)

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

    setSubmitting(true)

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) throw authError

      if (!user || (userId && user.id !== userId)) {
        throw new Error(
          'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.'
        )
      }

      const { error: insertError } = await supabase
        .from('portfolio_transactions')
        .insert({
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
          issold: false,
          sellprice: null,
          sellfee: null,
          user_id: user.id,
        })

      if (insertError) throw insertError

      setSuccess(`Đã thêm giao dịch ${assetname} thành công.`)

      setForm({
        ...emptyForm,
        buydate: new Date().toISOString().split('T')[0],
      })

      if (onSaved) {
        await onSaved()
      }
    } catch (err) {
      console.error('Lỗi thêm giao dịch:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Không thể lưu giao dịch. Vui lòng thử lại.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'

  const labelClass = 'text-sm font-medium text-zinc-300'

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 text-white md:p-6"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-xl font-bold">
            ➕ Thêm giao dịch đầu tư
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Nhập thông tin mua tài sản để theo dõi hiệu quả đầu tư.
          </p>
        </div>

        <span className="w-fit rounded-full border border-emerald-800 bg-emerald-950/50 px-3 py-1 text-xs text-emerald-400">
          {loadingUser
            ? 'Đang xác minh tài khoản...'
            : userId
              ? 'Đã xác minh tài khoản'
              : 'Chưa đăng nhập'}
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
              autoComplete="off"
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
              placeholder="Ví dụ: TCBS, DNSE, Binance..."
              className={inputClass}
            />
          </label>
        </div>
      </section>

      {/* PHÍ GIAO DỊCH */}
      <section className="space-y-3">
        <h3 className="border-b border-zinc-800 pb-2 text-sm font-semibold text-emerald-400">
          2. Đơn vị và phí giao dịch
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
                <div className="text-lg">{preset.icon}</div>
                <div className="mt-1 font-semibold">{preset.label}</div>
                <div className="mt-1 text-xs text-zinc-400">
                  {preset.description}
                </div>
              </button>
            )
          })}
        </div>

        <p className="text-xs text-zinc-500">
          Phí đang dùng để tính toán và lưu vào transactionfee. Mức phí thực tế
          có thể khác tùy biểu phí của công ty chứng khoán hoặc sàn giao dịch.
        </p>
      </section>

      {/* GIÁ VÀ KHỐI LƯỢNG */}
      <section className="space-y-4">
        <h3 className="border-b border-zinc-800 pb-2 text-sm font-semibold text-emerald-400">
          3. Khối lượng và giá
        </h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className={labelClass}>
            Khối lượng *
            <input
              type="text"
              inputMode="decimal"
              name="quantity"
              value={form.quantity}
              onChange={handleNumberChange}
              placeholder="Ví dụ: 1000"
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
              onChange={handleNumberChange}
              placeholder="Ví dụ: 25.5"
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
              onChange={handleNumberChange}
              placeholder="Ví dụ: 26.2"
              required
              className={inputClass}
            />
          </label>
        </div>

        <p className="text-xs text-zinc-500">
          Nhập giá theo cùng đơn vị với dữ liệu đang dùng trong danh mục. Với
          cổ phiếu Việt Nam, cần thống nhất cách nhập giá (đồng/cổ phiếu hoặc
          nghìn đồng/cổ phiếu) trên toàn bộ hệ thống.
        </p>
      </section>

      {/* ƯỚC TÍNH */}
      <section className="space-y-3">
        <h3 className="border-b border-zinc-800 pb-2 text-sm font-semibold text-emerald-400">
          4. Ước tính giao dịch
        </h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <PreviewCard
            title="Giá trị mua"
            value={`${money(quantity * buyPrice)} đ`}
          />

          <PreviewCard
            title="Phí mua ước tính"
            value={`${money(transactionFee)} đ`}
          />

          <PreviewCard
            title="Giá trị hiện tại"
            value={`${money(currentMarketValue)} đ`}
          />

          <PreviewCard
            title="Lãi/lỗ ước tính"
            value={`${estimatedPnL > 0 ? '+' : ''}${money(estimatedPnL)} đ`}
            valueClass={
              estimatedPnL >= 0
                ? 'text-emerald-400'
                : 'text-red-400'
            }
          />
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-zinc-400">
              Lãi/lỗ theo biến động giá
            </span>

            <span
              className={`text-lg font-bold ${
                estimatedPnLPercentage >= 0
                  ? 'text-emerald-400'
                  : 'text-red-400'
              }`}
            >
              {formatPercent(estimatedPnLPercentage)}
            </span>
          </div>

          <p className="mt-2 text-xs leading-5 text-zinc-500">
            Đây là ước tính dựa trên giá mua, giá hiện tại, khối lượng và phí
            mua. Chưa bao gồm thuế, phí bán hoặc các chi phí khác chưa được
            nhập.
          </p>
        </div>
      </section>

      {/* CHIẾN LƯỢC */}
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
              placeholder="Ví dụ: Tích lũy, breakout, theo dòng tiền..."
              className={inputClass}
            />
          </label>

          <label className={labelClass}>
            Tags
            <input
              name="tags"
              value={form.tags}
              onChange={handleChange}
              placeholder="Ví dụ: dài hạn, dòng tiền, theo dõi"
              className={inputClass}
            />
          </label>
        </div>

        {Array.isArray(emotionPresets) &&
          emotionPresets.length > 0 && (
            <div>
              <p className="mb-2 text-xs text-zinc-400">
                Gợi ý ghi chú nhanh
              </p>

              <div className="flex flex-wrap gap-2">
                {emotionPresets.map((preset, index) => {
                  const label =
                    typeof preset === 'string'
                      ? preset
                      : String(
                          (preset as { label?: string; name?: string })
                            .label ??
                            (preset as { name?: string }).name ??
                            ''
                        )

                  if (!label) return null

                  return (
                    <button
                      key={`${label}-${index}`}
                      type="button"
                      onClick={() =>
                        setForm((previous) => ({
                          ...previous,
                          note: previous.note
                            ? `${previous.note}\n${label}`
                            : label,
                        }))
                      }
                      className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-emerald-500 hover:text-emerald-400"
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

        <label className={labelClass}>
          Ghi chú
          <textarea
            name="note"
            value={form.note}
            onChange={handleChange}
            rows={3}
            placeholder="Lý do mua, kế hoạch chốt lời, mức cắt lỗ..."
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
              Đánh dấu để dễ nhận diện các giao dịch có luận điểm đầu tư rõ ràng.
            </span>
          </span>
        </label>
      </section>

      {/* ACTIONS */}
      <div className="flex flex-col-reverse justify-end gap-3 border-t border-zinc-800 pt-5 sm:flex-row">
        <button
          type="button"
          onClick={() => {
            setForm({
              ...emptyForm,
              buydate: new Date().toISOString().split('T')[0],
            })
            setError('')
            setSuccess('')
          }}
          disabled={submitting}
          className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Nhập lại
        </button>

        <button
          type="submit"
          disabled={submitting || loadingUser || !userId}
          className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Đang lưu giao dịch...' : '✓ Lưu giao dịch'}
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

