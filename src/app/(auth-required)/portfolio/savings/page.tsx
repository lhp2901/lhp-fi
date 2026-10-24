
'use client'

import { useCallback, useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

import SavingsOverview from '@/components/portfolio/savings/SavingsOverview'
import SavingsDepositForm from '@/components/portfolio/savings/SavingsDepositForm'
import SavingsDepositTable from '@/components/portfolio/savings/SavingsDepositTable'
import SavingsCharts from '@/components/portfolio/savings/SavingsCharts'

import type {
  SavingsDeposit,
  SavingsDepositInput,
} from '@/lib/savings/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createBrowserClient(supabaseUrl, supabaseAnonKey)
    : null

type SavingsPayload = SavingsDepositInput & {
  principal: number
  user_id: string
}

const CLOSED_STATUSES = ['SETTLED', 'CLOSED', 'CANCELLED']

export default function SavingsPage() {
  const [deposits, setDeposits] = useState<SavingsDeposit[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingDeposit, setEditingDeposit] =
    useState<SavingsDeposit | null>(null)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [settlingId, setSettlingId] = useState<string | null>(null)

  // =========================================================
  // KIỂM TRA SUPABASE VÀ NGƯỜI DÙNG
  // =========================================================
  const requireUser = useCallback(async () => {
    if (!supabase) {
      throw new Error(
        'Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY.',
      )
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      throw authError
    }

    if (!user) {
      throw new Error(
        'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      )
    }

    return user
  }, [])

  // =========================================================
  // TẢI DANH SÁCH TIỀN GỬI
  // =========================================================
  const loadDeposits = useCallback(async () => {
    if (!supabase) {
      setError(
        'Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY.',
      )
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const user = await requireUser()

      const { data, error: queryError } = await supabase
        .from('savings_deposits')
        .select('*')
        .eq('user_id', user.id)
        .order('maturity_date', { ascending: true })

      if (queryError) {
        throw queryError
      }

      setDeposits((data ?? []) as SavingsDeposit[])
    } catch (err) {
      console.error('Lỗi tải dữ liệu tiết kiệm:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Không thể tải dữ liệu tiết kiệm.',
      )
    } finally {
      setLoading(false)
    }
  }, [requireUser])

  useEffect(() => {
    void loadDeposits()
  }, [loadDeposits])

  // =========================================================
  // MỞ BIỂU MẪU THÊM MỚI
  // =========================================================
  const handleOpenAddForm = () => {
    setEditingDeposit(null)
    setShowForm(true)
    setError('')
    setSuccess('')
  }

  // =========================================================
  // MỞ BIỂU MẪU CHỈNH SỬA
  // =========================================================
  const handleEditDeposit = (deposit: SavingsDeposit) => {
    const status = String(deposit.status ?? '').toUpperCase()

    if (CLOSED_STATUSES.includes(status)) {
      setError('Sổ tiết kiệm đã đóng hoặc tất toán nên không thể chỉnh sửa.')
      return
    }

    setEditingDeposit(deposit)
    setShowForm(true)
    setError('')
    setSuccess('')
  }

  // =========================================================
  // ĐÓNG BIỂU MẪU
  // =========================================================
  const handleCancelForm = () => {
    setShowForm(false)
    setEditingDeposit(null)
    setError('')
  }

  // =========================================================
  // CHUẨN HÓA DỮ LIỆU FORM
  // =========================================================
  const preparePayload = (
    input: SavingsDepositInput,
    userId: string,
  ): SavingsPayload => {
    const principal = Number(
      String(input.principal ?? '').replace(/[^\d.-]/g, ''),
    )

    const annualInterestRate = Number(input.annual_interest_rate)
    const termValue = Number(input.term_value)

    if (!Number.isFinite(principal) || principal <= 0) {
      throw new Error('Vui lòng nhập số tiền gốc lớn hơn 0.')
    }

    if (
      !Number.isFinite(annualInterestRate) ||
      annualInterestRate < 0
    ) {
      throw new Error('Lãi suất năm không hợp lệ.')
    }

    if (
      !Number.isInteger(termValue) ||
      termValue <= 0
    ) {
      throw new Error('Kỳ hạn phải là số nguyên lớn hơn 0.')
    }

    if (!input.bank_name?.trim()) {
      throw new Error('Vui lòng nhập tên ngân hàng.')
    }

    if (!input.deposit_name?.trim()) {
      throw new Error('Vui lòng nhập tên sổ tiết kiệm.')
    }

    if (!input.start_date || !input.maturity_date) {
      throw new Error('Vui lòng nhập ngày gửi và ngày đáo hạn.')
    }

    if (input.maturity_date < input.start_date) {
      throw new Error('Ngày đáo hạn không được trước ngày gửi.')
    }

    return {
      ...input,
      bank_name: input.bank_name.trim(),
      deposit_name: input.deposit_name.trim(),
      account_reference: input.account_reference?.trim() || '',
      principal,
      annual_interest_rate: annualInterestRate,
      term_value: termValue,
      user_id: userId,
    } as SavingsPayload
  }

  // =========================================================
  // THÊM MỚI HOẶC CẬP NHẬT SỔ TIẾT KIỆM
  // =========================================================
  const handleSaveDeposit = async (input: SavingsDepositInput) => {
    if (!supabase) {
      throw new Error('Supabase chưa được cấu hình.')
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const user = await requireUser()
      const payload = preparePayload(input, user.id)

      if (editingDeposit) {
        // Không cho chỉnh sửa sổ đã tất toán hoặc đã đóng.
        const currentStatus = String(
          editingDeposit.status ?? '',
        ).toUpperCase()

        if (CLOSED_STATUSES.includes(currentStatus)) {
          throw new Error(
            'Sổ tiết kiệm đã đóng hoặc tất toán nên không thể chỉnh sửa.',
          )
        }

        // Chỉ cập nhật bản ghi của người dùng đang đăng nhập.
        const { data, error: updateError } = await supabase
          .from('savings_deposits')
          .update({
            bank_name: payload.bank_name,
            deposit_name: payload.deposit_name,
            account_reference: payload.account_reference,
            currency: payload.currency,
            principal: payload.principal,
            annual_interest_rate: payload.annual_interest_rate,
            start_date: payload.start_date,
            maturity_date: payload.maturity_date,
            term_value: payload.term_value,
            term_unit: payload.term_unit,
            interest_payout_method: payload.interest_payout_method,
            auto_renewal: payload.auto_renewal,
            renewal_type: payload.renewal_type,
            notes: payload.notes,
          })
          .eq('id', editingDeposit.id)
          .eq('user_id', user.id)
          .not('status', 'in', '("SETTLED","CLOSED","CANCELLED")')
          .select('id')

        if (updateError) {
          throw updateError
        }

        if (!data || data.length === 0) {
          throw new Error(
            'Không cập nhật được sổ tiết kiệm. Sổ có thể không còn tồn tại, đã tất toán hoặc bạn không có quyền cập nhật.',
          )
        }

        setSuccess(
          `Đã cập nhật sổ "${payload.deposit_name}" thành công.`,
        )
      } else {
        // Thêm mới: luôn gắn với người dùng hiện tại.
        const { error: insertError } = await supabase
          .from('savings_deposits')
          .insert({
            ...payload,
            status: 'ACTIVE',
          })

        if (insertError) {
          throw insertError
        }

        setSuccess(
          `Đã thêm sổ tiết kiệm "${payload.deposit_name}" thành công.`,
        )
      }

      setShowForm(false)
      setEditingDeposit(null)

      await loadDeposits()
    } catch (err) {
      console.error('Lỗi lưu sổ tiết kiệm:', err)

      const message =
        err instanceof Error
          ? err.message
          : 'Không thể lưu sổ tiết kiệm.'

      setError(message)

      // Giữ form đang mở để người dùng không mất nội dung đang nhập.
      throw new Error(message)
    } finally {
      setSaving(false)
    }
  }

  // =========================================================
  // XÓA SỔ TIẾT KIỆM
  // =========================================================
  const handleDeleteDeposit = async (deposit: SavingsDeposit) => {
    if (!supabase) {
      throw new Error('Supabase chưa được cấu hình.')
    }

    if (deletingId || settlingId || saving) {
      throw new Error('Đang xử lý yêu cầu khác. Vui lòng chờ.')
    }

    setDeletingId(deposit.id)
    setError('')
    setSuccess('')

    try {
      const user = await requireUser()

      const { data, error: deleteError } = await supabase
        .from('savings_deposits')
        .delete()
        .eq('id', deposit.id)
        .eq('user_id', user.id)
        .select('id')

      if (deleteError) {
        throw deleteError
      }

      if (!data || data.length === 0) {
        throw new Error(
          'Không xóa được sổ tiết kiệm. Hãy kiểm tra bản ghi và quyền RLS trên Supabase.',
        )
      }

      setDeposits((previous) =>
        previous.filter((item) => item.id !== deposit.id),
      )

      if (editingDeposit?.id === deposit.id) {
        setEditingDeposit(null)
        setShowForm(false)
      }

      setSuccess(
        `Đã xóa sổ tiết kiệm "${deposit.deposit_name}" thành công.`,
      )
    } catch (err) {
      console.error('Lỗi xóa sổ tiết kiệm:', err)

      const message =
        err instanceof Error
          ? err.message
          : 'Không thể xóa sổ tiết kiệm.'

      setError(message)
      throw new Error(message)
    } finally {
      setDeletingId(null)
    }
  }

  // =========================================================
  // TẤT TOÁN SỔ TIẾT KIỆM
  // =========================================================
  const handleSettleDeposit = async (deposit: SavingsDeposit) => {
    if (!supabase) {
      throw new Error('Supabase chưa được cấu hình.')
    }

    if (deletingId || settlingId || saving) {
      throw new Error('Đang xử lý yêu cầu khác. Vui lòng chờ.')
    }

    const currentStatus = String(
      deposit.status ?? '',
    ).toUpperCase()

    if (CLOSED_STATUSES.includes(currentStatus)) {
      throw new Error('Sổ tiết kiệm này đã được đóng hoặc tất toán.')
    }

    setSettlingId(deposit.id)
    setError('')
    setSuccess('')

    try {
      const user = await requireUser()

      const { data, error: updateError } = await supabase
        .from('savings_deposits')
        .update({
          status: 'SETTLED',
        })
        .eq('id', deposit.id)
        .eq('user_id', user.id)
        .not('status', 'in', '("SETTLED","CLOSED","CANCELLED")')
        .select('id')

      if (updateError) {
        throw updateError
      }

      if (!data || data.length === 0) {
        throw new Error(
          'Không tất toán được sổ. Vui lòng tải lại danh sách và kiểm tra trạng thái sổ.',
        )
      }

      setDeposits((previous) =>
        previous.map((item) =>
          item.id === deposit.id
            ? { ...item, status: 'SETTLED' }
            : item,
        ),
      )

      if (editingDeposit?.id === deposit.id) {
        setEditingDeposit(null)
        setShowForm(false)
      }

      setSuccess(
        `Đã đánh dấu sổ "${deposit.deposit_name}" là tất toán.`,
      )
    } catch (err) {
      console.error('Lỗi tất toán sổ tiết kiệm:', err)

      const message =
        err instanceof Error
          ? err.message
          : 'Không thể tất toán sổ tiết kiệm.'

      setError(message)
      throw new Error(message)
    } finally {
      setSettlingId(null)
    }
  }

  // =========================================================
  // GIAO DIỆN
  // =========================================================
  return (
    <main className="min-h-screen space-y-6 bg-zinc-950 p-4 text-white md:p-6">
      {/* Tiêu đề */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">
            💰 Tiền gửi tiết kiệm
          </h1>

          <p className="mt-2 text-sm text-zinc-400">
            Quản lý tiền gốc, lãi suất, kỳ hạn và ngày đáo hạn.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void loadDeposits()}
            disabled={loading || Boolean(deletingId) || Boolean(settlingId) || saving}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Đang tải...' : '↻ Làm mới'}
          </button>

          <button
            type="button"
            onClick={() => {
              if (showForm) {
                handleCancelForm()
              } else {
                handleOpenAddForm()
              }
            }}
            disabled={saving}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {showForm
              ? 'Đóng biểu mẫu'
              : '+ Thêm khoản tiết kiệm'}
          </button>
        </div>
      </div>

      {/* Thông báo lỗi */}
      {error && (
        <div
          role="alert"
          className="break-words rounded-lg border border-red-800 bg-red-950/50 p-4 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      {/* Thông báo thành công */}
      {success && (
        <div
          role="status"
          className="break-words rounded-lg border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-300"
        >
          {success}
        </div>
      )}

      {/* Form thêm mới / chỉnh sửa */}
      {showForm && (
        <section>
          <SavingsDepositForm
            key={editingDeposit?.id ?? 'new-savings-deposit'}
            editingDeposit={editingDeposit}
            onSubmit={handleSaveDeposit}
            onCancel={handleCancelForm}
          />

          {saving && (
            <p className="mt-3 text-sm text-zinc-400">
              Đang lưu dữ liệu lên Supabase...
            </p>
          )}
        </section>
      )}

      {/* Tổng quan */}
      <SavingsOverview deposits={deposits} />

      {/* Danh sách sổ tiết kiệm */}
      <SavingsDepositTable
        deposits={deposits}
        loading={loading}
        onEdit={handleEditDeposit}
        onSettle={handleSettleDeposit}
        onDelete={handleDeleteDeposit}
      />

      {/* Biểu đồ */}
      {!loading && deposits.length > 0 && (
        <SavingsCharts deposits={deposits} />
      )}
    </main>
  )
}
