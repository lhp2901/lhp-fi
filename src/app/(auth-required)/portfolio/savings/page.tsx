
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

export default function SavingsPage() {
  const [deposits, setDeposits] = useState<SavingsDeposit[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // =========================================================
  // TẢI DANH SÁCH TIỀN GỬI
  // =========================================================
  const loadDeposits = useCallback(async () => {
    if (!supabase) {
      setError(
        'Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY.'
      )
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) {
        throw authError
      }

      if (!user) {
        setDeposits([])
        setError('Vui lòng đăng nhập để xem dữ liệu tiết kiệm.')
        return
      }

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
          : 'Không thể tải dữ liệu tiết kiệm.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDeposits()
  }, [loadDeposits])

  // =========================================================
  // THÊM KHOẢN TIẾT KIỆM
  // =========================================================
  const handleAddDeposit = async (input: SavingsDepositInput) => {
    if (!supabase) {
      throw new Error('Supabase chưa được cấu hình.')
    }

    setError('')
    setSuccess('')

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) {
        throw authError
      }

      if (!user) {
        throw new Error(
          'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        )
      }

      // Chuyển tiền gốc về kiểu số để tránh lưu chuỗi định dạng.
      const principal = Number(
        String(input.principal ?? '').replace(/\D/g, '')
      )

      if (!Number.isFinite(principal) || principal <= 0) {
        throw new Error('Vui lòng nhập số tiền gốc hợp lệ.')
      }

      const { error: insertError } = await supabase
        .from('savings_deposits')
        .insert({
          ...input,
          principal,
          user_id: user.id,
          status: 'ACTIVE',
        })

      if (insertError) {
        throw insertError
      }

      await loadDeposits()

      setShowForm(false)
      setSuccess('Đã thêm khoản tiết kiệm thành công.')
    } catch (err) {
      console.error('Lỗi thêm khoản tiết kiệm:', err)

      throw new Error(
        err instanceof Error
          ? err.message
          : 'Không thể thêm khoản tiết kiệm.'
      )
    }
  }

  // =========================================================
  // XÓA KHOẢN TIẾT KIỆM
  // =========================================================
  const handleDeleteDeposit = async (deposit: SavingsDeposit) => {
    if (!supabase) {
      throw new Error('Supabase chưa được cấu hình.')
    }

    if (deletingId) {
      throw new Error('Đang xử lý một yêu cầu xóa khác. Vui lòng chờ.')
    }

    setDeletingId(deposit.id)
    setError('')
    setSuccess('')

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) {
        throw authError
      }

      if (!user) {
        throw new Error(
          'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        )
      }

      // Chỉ xóa bản ghi thuộc về người dùng đang đăng nhập.
      const { data, error: deleteError } = await supabase
        .from('savings_deposits')
        .delete()
        .eq('id', deposit.id)
        .eq('user_id', user.id)
        .select('id')

      if (deleteError) {
        throw deleteError
      }

      // Không có bản ghi trả về có thể do không tìm thấy
      // dữ liệu hoặc quyền RLS không cho phép xóa.
      if (!data || data.length === 0) {
        throw new Error(
          'Không xóa được khoản tiết kiệm. Vui lòng kiểm tra dữ liệu và quyền RLS trên Supabase.'
        )
      }

      // Cập nhật giao diện sau khi Supabase xác nhận xóa.
      setDeposits((previous) =>
        previous.filter((item) => item.id !== deposit.id)
      )

      setSuccess(
        `Đã xóa khoản tiết kiệm "${deposit.deposit_name}" thành công.`
      )
    } catch (err) {
      console.error('Lỗi xóa khoản tiết kiệm:', err)

      const message =
        err instanceof Error
          ? err.message
          : 'Không thể xóa khoản tiết kiệm.'

      setError(message)

      // Ném lỗi để SavingsDepositTable có thể xử lý tiếp.
      throw new Error(message)
    } finally {
      setDeletingId(null)
    }
  }

  // =========================================================
  // GIAO DIỆN
  // =========================================================
  return (
    <main className="min-h-screen space-y-6 bg-zinc-950 p-4 text-white md:p-6">
      {/* Tiêu đề và nút thao tác */}
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
            disabled={loading || Boolean(deletingId)}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ↻ Làm mới
          </button>

          <button
            type="button"
            onClick={() => {
              setShowForm((previous) => !previous)
              setError('')
              setSuccess('')
            }}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold transition hover:bg-emerald-500"
          >
            {showForm ? 'Đóng biểu mẫu' : '+ Thêm khoản tiết kiệm'}
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

      {/* Biểu mẫu thêm khoản tiết kiệm */}
      {showForm && (
        <section>
          <SavingsDepositForm
            onSubmit={handleAddDeposit}
            onCancel={() => setShowForm(false)}
          />
        </section>
      )}

      {/* Tổng quan */}
      <SavingsOverview deposits={deposits} />

      {/* Danh sách khoản tiết kiệm */}
      <SavingsDepositTable
        deposits={deposits}
        loading={loading}
        onDelete={handleDeleteDeposit}
      />

      {/* Biểu đồ */}
      {!loading && deposits.length > 0 && (
        <SavingsCharts deposits={deposits} />
      )}
    </main>
  )
}

