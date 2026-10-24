'use client'

import { useEffect, useState } from 'react'
import type {
SavingsDeposit,
SavingsDepositInput,
SavingsTermUnit,
SavingsPayoutMethod,
} from '@/lib/savings/types'

interface SavingsDepositFormProps {
onSubmit: (data: SavingsDepositInput) => Promise<void>
onCancel?: () => void
editingDeposit?: SavingsDeposit | null
}

type SavingsDepositFormState = {
bank_name: string
deposit_name: string
account_reference: string
currency: string
principal: string
annual_interest_rate: string
start_date: string
maturity_date: string
term_value: string
term_unit: SavingsTermUnit
interest_payout_method: SavingsPayoutMethod
auto_renewal: boolean
renewal_type: 'PRINCIPAL_ONLY' | 'PRINCIPAL_AND_INTEREST'
notes: string
}

function getToday(): string {
const now = new Date()
const localDate = new Date(
now.getTime() - now.getTimezoneOffset() * 60_000
)

return localDate.toISOString().slice(0, 10)
}

function createInitialForm(): SavingsDepositFormState {
return {
bank_name: '',
deposit_name: '',
account_reference: '',
currency: 'VND',
principal: '',
annual_interest_rate: '',
start_date: getToday(),
maturity_date: '',
term_value: '12',
term_unit: 'MONTHS',
interest_payout_method: 'MATURITY',
auto_renewal: false,
renewal_type: 'PRINCIPAL_ONLY',
notes: '',
}
}

function formatMoneyInput(value: string | number): string {
const digits = String(value ?? '').replace(/\D/g, '')

if (!digits) return ''

return Number(digits).toLocaleString('vi-VN')
}

function normalizeDate(value: string | null | undefined): string {
if (!value) return ''

return value.slice(0, 10)
}

function depositToForm(
deposit: SavingsDeposit
): SavingsDepositFormState {
return {
bank_name: deposit.bank_name ?? '',
deposit_name: deposit.deposit_name ?? '',
account_reference: deposit.account_reference ?? '',
currency: deposit.currency ?? 'VND',
principal: String(deposit.principal ?? ''),
annual_interest_rate: String(
deposit.annual_interest_rate ?? ''
),
start_date: normalizeDate(deposit.start_date),
maturity_date: normalizeDate(deposit.maturity_date),
term_value: String(deposit.term_value ?? 12),
term_unit: deposit.term_unit,
interest_payout_method: deposit.interest_payout_method,
auto_renewal: Boolean(deposit.auto_renewal),
renewal_type:
deposit.renewal_type ?? 'PRINCIPAL_ONLY',
notes: deposit.notes ?? '',
}
}

export default function SavingsDepositForm({
onSubmit,
onCancel,
editingDeposit = null,
}: SavingsDepositFormProps) {
const [form, setForm] = useState<SavingsDepositFormState>(
() => createInitialForm()
)

const [saving, setSaving] = useState(false)
const [error, setError] = useState('')

const isEditing = Boolean(editingDeposit)

useEffect(() => {
setError('')


if (editingDeposit) {
  setForm(depositToForm(editingDeposit))
} else {
  setForm(createInitialForm())
}


}, [editingDeposit])

function update<K extends keyof SavingsDepositFormState>(
key: K,
value: SavingsDepositFormState[K]
) {
setForm((previous) => ({
...previous,
[key]: value,
}))
}

async function handleSubmit(
event: React.FormEvent<HTMLFormElement>
) {
event.preventDefault()
setError('')


const principal = Number(form.principal)
const rate = Number(form.annual_interest_rate)
const term = Number(form.term_value)

if (!form.bank_name.trim() || !form.deposit_name.trim()) {
  setError(
    'Vui lòng nhập tên ngân hàng và tên khoản tiết kiệm.'
  )
  return
}

if (!Number.isFinite(principal) || principal <= 0) {
  setError('Số tiền gửi phải lớn hơn 0.')
  return
}

if (
  form.annual_interest_rate.trim() === '' ||
  !Number.isFinite(rate) ||
  rate < 0
) {
  setError('Lãi suất không hợp lệ.')
  return
}

if (
  !Number.isInteger(term) ||
  term <= 0
) {
  setError('Kỳ hạn phải là số nguyên dương.')
  return
}

if (
  !form.start_date ||
  !form.maturity_date ||
  form.maturity_date < form.start_date
) {
  setError(
    'Ngày đáo hạn phải bằng hoặc sau ngày gửi.'
  )
  return
}

setSaving(true)

try {
  await onSubmit({
    bank_name: form.bank_name.trim(),
    deposit_name: form.deposit_name.trim(),
    account_reference:
      form.account_reference.trim() || null,
    currency: form.currency,
    principal,
    annual_interest_rate: rate,
    start_date: form.start_date,
    maturity_date: form.maturity_date,
    term_value: term,
    term_unit: form.term_unit,
    interest_payout_method:
      form.interest_payout_method,
    auto_renewal: form.auto_renewal,
    renewal_type: form.renewal_type,
    notes: form.notes.trim() || null,
  })

  // Xóa dữ liệu khi thêm mới thành công.
  // Khi sửa, component cha sẽ bỏ editingDeposit sau khi cập nhật.
  if (!isEditing) {
    setForm(createInitialForm())
  }
} catch (err) {
  setError(
    err instanceof Error
      ? err.message
      : 'Không thể lưu khoản tiết kiệm.'
  )
} finally {
  setSaving(false)
}


}

function handleCancel() {
setError('')
setForm(createInitialForm())
onCancel?.()
}

const inputClass =
'mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'

return ( <form
   onSubmit={handleSubmit}
   className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-900 p-5"
 > <div className="flex flex-wrap items-center justify-between gap-3"> <h2 className="text-xl font-bold text-white">
{isEditing
? '✏️ Chỉnh sửa khoản tiết kiệm'
: '➕ Thêm khoản tiết kiệm'} </h2>


    {isEditing && (
      <span className="rounded-full bg-blue-950 px-3 py-1 text-xs font-medium text-blue-300">
        Đang chỉnh sửa
      </span>
    )}
  </div>

  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    <label className="text-sm text-zinc-300">
      Ngân hàng *
      <input
        required
        value={form.bank_name}
        onChange={(e) =>
          update('bank_name', e.target.value)
        }
        className={inputClass}
        placeholder="VD: Vietcombank"
      />
    </label>

    <label className="text-sm text-zinc-300">
      Tên khoản tiết kiệm *
      <input
        required
        value={form.deposit_name}
        onChange={(e) =>
          update('deposit_name', e.target.value)
        }
        className={inputClass}
        placeholder="VD: Tiết kiệm 12 tháng"
      />
    </label>

    <label className="block text-sm text-zinc-300">
      Số tiền gốc (VND) *
      <input
        required
        type="text"
        inputMode="numeric"
        value={formatMoneyInput(form.principal)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '')
          update('principal', digits)
        }}
        placeholder="Ví dụ: 1.000.000.000"
        className={inputClass}
      />
    </label>

    <label className="text-sm text-zinc-300">
      Lãi suất (%/năm) *
      <input
        required
        type="number"
        min="0"
        step="0.0001"
        value={form.annual_interest_rate}
        onChange={(e) =>
          update('annual_interest_rate', e.target.value)
        }
        className={inputClass}
        placeholder="VD: 5.5"
      />
    </label>

    <label className="text-sm text-zinc-300">
      Ngày gửi *
      <input
        required
        type="date"
        value={form.start_date}
        onChange={(e) =>
          update('start_date', e.target.value)
        }
        className={inputClass}
      />
    </label>

    <label className="text-sm text-zinc-300">
      Ngày đáo hạn *
      <input
        required
        type="date"
        value={form.maturity_date}
        onChange={(e) =>
          update('maturity_date', e.target.value)
        }
        className={inputClass}
      />
    </label>

    <label className="text-sm text-zinc-300">
      Kỳ hạn *
      <input
        required
        type="number"
        min="1"
        step="1"
        value={form.term_value}
        onChange={(e) =>
          update('term_value', e.target.value)
        }
        className={inputClass}
      />
    </label>

    <label className="text-sm text-zinc-300">
      Đơn vị kỳ hạn
      <select
        value={form.term_unit}
        onChange={(e) =>
          update(
            'term_unit',
            e.target.value as SavingsTermUnit
          )
        }
        className={inputClass}
      >
        <option value="DAYS">Ngày</option>
        <option value="MONTHS">Tháng</option>
        <option value="YEARS">Năm</option>
      </select>
    </label>

    <label className="text-sm text-zinc-300">
      Hình thức nhận lãi
      <select
        value={form.interest_payout_method}
        onChange={(e) =>
          update(
            'interest_payout_method',
            e.target.value as SavingsPayoutMethod
          )
        }
        className={inputClass}
      >
        <option value="MONTHLY">Hằng tháng</option>
        <option value="QUARTERLY">Hằng quý</option>
        <option value="MATURITY">Cuối kỳ</option>
      </select>
    </label>

    <label className="text-sm text-zinc-300">
      Mã tham chiếu sổ tiết kiệm
      <input
        value={form.account_reference}
        onChange={(e) =>
          update('account_reference', e.target.value)
        }
        className={inputClass}
        placeholder="Không bắt buộc"
      />
    </label>
  </div>

  <label className="flex items-center gap-2 text-sm text-zinc-300">
    <input
      type="checkbox"
      checked={form.auto_renewal}
      onChange={(e) =>
        update('auto_renewal', e.target.checked)
      }
      className="h-4 w-4 accent-emerald-500"
    />
    Có đăng ký tự động tái tục
  </label>

  {form.auto_renewal && (
    <label className="block text-sm text-zinc-300">
      Hình thức tái tục
      <select
        value={form.renewal_type}
        onChange={(e) =>
          update(
            'renewal_type',
            e.target.value as SavingsDepositFormState['renewal_type']
          )
        }
        className={inputClass}
      >
        <option value="PRINCIPAL_ONLY">
          Chỉ tái tục tiền gốc
        </option>
        <option value="PRINCIPAL_AND_INTEREST">
          Tái tục cả gốc và lãi
        </option>
      </select>
    </label>
  )}

  <label className="block text-sm text-zinc-300">
    Ghi chú
    <textarea
      value={form.notes}
      onChange={(e) =>
        update('notes', e.target.value)
      }
      className={inputClass}
      rows={3}
      placeholder="Ghi chú thêm nếu có..."
    />
  </label>

  {error && (
    <p
      role="alert"
      className="rounded-lg border border-red-800 bg-red-950 p-3 text-sm text-red-300"
    >
      {error}
    </p>
  )}

  <div className="flex flex-wrap gap-3">
    <button
      type="submit"
      disabled={saving}
      className="rounded-lg bg-emerald-600 px-5 py-2 font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {saving
        ? 'Đang lưu...'
        : isEditing
          ? 'Cập nhật khoản tiết kiệm'
          : 'Lưu khoản tiết kiệm'}
    </button>

    {onCancel && (
      <button
        type="button"
        disabled={saving}
        onClick={handleCancel}
        className="rounded-lg border border-zinc-700 px-5 py-2 text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
      >
        {isEditing ? 'Hủy chỉnh sửa' : 'Hủy'}
      </button>
    )}
  </div>
</form>


)
}
