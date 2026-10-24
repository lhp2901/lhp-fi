
'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'

/* =========================
   TYPES & CONFIG
========================= */

type DataGroup =
  | 'Bảng dữ liệu COIN'
  | 'Bảng dữ liệu CỔ PHIẾU'
  | 'Bảng dữ liệu VNINDEX - VN30'
  | 'Bảng dữ liệu GD ĐẦU TƯ'

type TableConfig = {
  key: string
  label: string
  tooltip: string
  group: DataGroup
}

type DeleteLog = {
  id: string | number
  user_id: string | null
  tables: string[] | null
  note: string | null
  created_at: string | null
}

type Notice = {
  type: 'success' | 'error' | 'info'
  text: string
}

type ApiResult = {
  success?: boolean
  message?: string
  error?: string
}

const TABLES: TableConfig[] = [
  {
    key: 'watched_symbols',
    label: 'Mã coin đang theo dõi',
    tooltip: 'Danh sách tài sản tiền mã hóa được theo dõi.',
    group: 'Bảng dữ liệu COIN',
  },
  {
    key: 'ohlcv_data',
    label: 'Dữ liệu nến OHLCV',
    tooltip: 'Dữ liệu giá mở cửa, cao nhất, thấp nhất, đóng cửa và khối lượng.',
    group: 'Bảng dữ liệu COIN',
  },
  {
    key: 'training_dataset',
    label: 'Dữ liệu huấn luyện AI',
    tooltip: 'Tập dữ liệu dùng trong quá trình huấn luyện mô hình.',
    group: 'Bảng dữ liệu COIN',
  },
  {
    key: 'ai_predictions',
    label: 'Dự đoán từ AI',
    tooltip: 'Kết quả dự đoán do mô hình AI tạo ra.',
    group: 'Bảng dữ liệu COIN',
  },
  {
    key: 'trading_logs',
    label: 'Nhật ký giao dịch coin',
    tooltip: 'Nhật ký giao dịch và hoạt động liên quan.',
    group: 'Bảng dữ liệu COIN',
  },
  {
    key: 'stock_entries',
    label: 'Danh sách cổ phiếu theo dõi',
    tooltip: 'Danh sách mã cổ phiếu được theo dõi.',
    group: 'Bảng dữ liệu CỔ PHIẾU',
  },
  {
    key: 'ai_signals',
    label: 'Tín hiệu AI cổ phiếu',
    tooltip: 'Các tín hiệu mua, bán và quan sát do AI tạo ra.',
    group: 'Bảng dữ liệu CỔ PHIẾU',
  },
  {
    key: 'vn30_data',
    label: 'Dữ liệu VN30',
    tooltip: 'Dữ liệu lịch sử chỉ số VN30.',
    group: 'Bảng dữ liệu VNINDEX - VN30',
  },
  {
    key: 'vnindex_data',
    label: 'Dữ liệu VNINDEX',
    tooltip: 'Dữ liệu lịch sử chỉ số VNINDEX.',
    group: 'Bảng dữ liệu VNINDEX - VN30',
  },
  {
    key: 'ai_accuracy_logs',
    label: 'Nhật ký độ chính xác AI',
    tooltip: 'Lịch sử đánh giá độ chính xác của mô hình.',
    group: 'Bảng dữ liệu VNINDEX - VN30',
  },
  {
    key: 'ai_market_signals',
    label: 'Tín hiệu thị trường từ AI',
    tooltip: 'Các tín hiệu phân tích xu hướng thị trường.',
    group: 'Bảng dữ liệu VNINDEX - VN30',
  },
  {
    key: 'import_logs',
    label: 'Nhật ký nhập dữ liệu',
    tooltip: 'Lịch sử nhập và đồng bộ dữ liệu.',
    group: 'Bảng dữ liệu VNINDEX - VN30',
  },
  {
    key: 'portfolio_transactions',
    label: 'Giao dịch danh mục đầu tư',
    tooltip: 'Thông tin giao dịch và danh mục đầu tư.',
    group: 'Bảng dữ liệu GD ĐẦU TƯ',
  },
]

const GROUPS: {
  name: DataGroup
  icon: string
  description: string
}[] = [
  {
    name: 'Bảng dữ liệu COIN',
    icon: '₿',
    description: 'Dữ liệu tiền mã hóa, nến giá và mô hình AI.',
  },
  {
    name: 'Bảng dữ liệu CỔ PHIẾU',
    icon: '▥',
    description: 'Danh sách cổ phiếu và tín hiệu giao dịch.',
  },
  {
    name: 'Bảng dữ liệu VNINDEX - VN30',
    icon: '📈',
    description: 'Dữ liệu chỉ số, tín hiệu thị trường và nhật ký.',
  },
  {
    name: 'Bảng dữ liệu GD ĐẦU TƯ',
    icon: '💼',
    description: 'Các giao dịch thuộc danh mục đầu tư.',
  },
]

const PANEL = 'rounded-2xl border border-slate-700/70 bg-slate-900/80'
const BUTTON =
  'rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40'

/* =========================
   HELPERS
========================= */

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message
  }

  return 'Đã xảy ra lỗi không xác định.'
}

function getTableLabel(key: string): string {
  return TABLES.find((table) => table.key === key)?.label ?? key
}

function formatLogDate(value: string | null): string {
  if (!value) return 'Không xác định'

  try {
    return formatDate(value)
  } catch {
    const date = new Date(value)

    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat('vi-VN', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(date)
  }
}

/* =========================
   REUSABLE COMPONENTS
========================= */

function Panel({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`${PANEL} ${className}`}>
      {children}
    </section>
  )
}

function NoticeBanner({
  notice,
  onDismiss,
}: {
  notice: Notice
  onDismiss: () => void
}) {
  const styles = {
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    error: 'border-red-500/30 bg-red-500/10 text-red-300',
    info: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  }

  const icons = { success: '✓', error: '!', info: 'i' }

  return (
    <div
      role={notice.type === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${styles[notice.type]}`}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current font-bold">
        {icons[notice.type]}
      </span>

      <p className="min-w-0 flex-1 break-words leading-6">
        {notice.text}
      </p>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Đóng thông báo"
        className="rounded-lg px-2 py-1 opacity-70 hover:bg-white/5 hover:opacity-100"
      >
        ×
      </button>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number
  icon: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      </div>

      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-xl">
        {icon}
      </span>
    </div>
  )
}

function Spinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
      {label}
    </span>
  )
}

/* =========================
   TABLE SELECTION
========================= */

function TableSelection({
  selected,
  busy,
  onToggle,
}: {
  selected: string[]
  busy: boolean
  onToggle: (key: string) => void
}) {
  const [search, setSearch] = useState('')

  const selectedSet = useMemo(() => new Set(selected), [selected])

  const visibleTables = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi-VN')

    if (!keyword) return TABLES

    return TABLES.filter((table) =>
      [
        table.key,
        table.label,
        table.tooltip,
        table.group,
      ].some((value) =>
        value.toLocaleLowerCase('vi-VN').includes(keyword),
      ),
    )
  }, [search])

  const visibleKeys = visibleTables.map((table) => table.key)

  const allVisibleSelected =
    visibleKeys.length > 0 &&
    visibleKeys.every((key) => selectedSet.has(key))

  const toggleVisible = () => {
    visibleKeys.forEach((key) => {
      if (allVisibleSelected && selectedSet.has(key)) {
        onToggle(key)
      } else if (!allVisibleSelected && !selectedSet.has(key)) {
        onToggle(key)
      }
    })
  }

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-700/70 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">
            Danh sách bảng dữ liệu
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Chọn những bảng cần xử lý.
          </p>
        </div>

        <button
          type="button"
          onClick={toggleVisible}
          disabled={busy || visibleTables.length === 0}
          className={BUTTON}
        >
          {allVisibleSelected ? 'Bỏ chọn danh sách hiện tại' : 'Chọn danh sách hiện tại'}
        </button>
      </div>

      <div className="flex flex-col gap-3 border-b border-slate-700/70 bg-slate-950/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm tên bảng, nhóm hoặc mô tả..."
          aria-label="Tìm kiếm bảng dữ liệu"
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-500 sm:max-w-md"
        />

        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || selected.length === TABLES.length}
            onClick={() => {
              TABLES.forEach((table) => {
                if (!selectedSet.has(table.key)) onToggle(table.key)
              })
            }}
            className="rounded-lg px-3 py-2 text-xs text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-40"
          >
            Chọn tất cả
          </button>

          <button
            type="button"
            disabled={busy || selected.length === 0}
            onClick={() => selected.forEach(onToggle)}
            className="rounded-lg px-3 py-2 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-40"
          >
            Bỏ chọn
          </button>
        </div>
      </div>

      <div className="space-y-6 p-4 sm:p-6">
        {GROUPS.map((group) => {
          const tables = visibleTables.filter(
            (table) => table.group === group.name,
          )

          if (tables.length === 0) return null

          const count = tables.filter((table) =>
            selectedSet.has(table.key),
          ).length

          return (
            <section key={group.name}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-lg">
                    {group.icon}
                  </span>

                  <div>
                    <h3 className="font-semibold text-white">
                      {group.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {group.description}
                    </p>
                  </div>
                </div>

                <span className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-400">
                  {count}/{tables.length} đã chọn
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {tables.map((table) => {
                  const checked = selectedSet.has(table.key)

                  return (
                    <label
                      key={table.key}
                      title={table.tooltip}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                        checked
                          ? 'border-indigo-500/50 bg-indigo-500/10'
                          : 'border-slate-800 bg-slate-950/40 hover:border-slate-600'
                      } ${busy ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={busy}
                        onChange={() => onToggle(table.key)}
                        className="mt-1 h-4 w-4 shrink-0 accent-indigo-500"
                      />

                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-100">
                          {table.label}
                        </span>
                        <span className="mt-1 block break-all font-mono text-xs text-indigo-300/80">
                          {table.key}
                        </span>
                        <span className="mt-2 block text-xs leading-5 text-slate-500">
                          {table.tooltip}
                        </span>
                      </span>

                      {checked && (
                        <span className="text-sm font-bold text-indigo-300">
                          ✓
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            </section>
          )
        })}

        {visibleTables.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
            <p className="font-medium text-white">
              Không tìm thấy bảng phù hợp
            </p>
            <button
              type="button"
              onClick={() => setSearch('')}
              className="mt-3 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Xóa bộ lọc
            </button>
          </div>
        )}
      </div>
    </Panel>
  )
}

/* =========================
   DELETE HISTORY
========================= */

function DeleteHistory({
  history,
  loading,
  busy,
  clearing,
  onRefresh,
  onClear,
}: {
  history: DeleteLog[]
  loading: boolean
  busy: boolean
  clearing: boolean
  onRefresh: () => void
  onClear: () => void
}) {
  const renderTables = (tables: string[] | null) =>
    tables?.length ? (
      <div className="flex flex-wrap gap-1.5">
        {tables.map((table) => (
          <span
            key={table}
            className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 text-xs text-indigo-300"
          >
            {table}
          </span>
        ))}
      </div>
    ) : (
      <span className="text-slate-500">—</span>
    )

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-700/70 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
            Audit trail
          </p>
          <h2 className="mt-2 text-lg font-bold text-white">
            Lịch sử xóa dữ liệu
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Tối đa 10 bản ghi mới nhất từ delete_logs.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading || busy}
          className={BUTTON}
        >
          {loading ? 'Đang tải...' : '↻ Làm mới lịch sử'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12 text-sm text-slate-400">
          <Spinner label="Đang tải lịch sử..." />
        </div>
      ) : history.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-2xl">🧾</p>
          <p className="mt-3 font-medium text-white">Chưa có lịch sử xóa</p>
          <p className="mt-2 text-sm text-slate-400">
            Nhật ký sẽ xuất hiện khi hệ thống ghi nhận thao tác.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-medium">Người dùng</th>
                  <th className="px-5 py-4 font-medium">Bảng dữ liệu</th>
                  <th className="px-5 py-4 font-medium">Ghi chú</th>
                  <th className="px-5 py-4 font-medium">Thời gian</th>
                </tr>
              </thead>

              <tbody>
                {history.map((log) => (
                  <tr
                    key={log.id}
                    className="border-t border-slate-800 align-top hover:bg-slate-800/30"
                  >
                    <td className="px-5 py-4 font-mono text-xs text-slate-300">
                      {log.user_id
                        ? `${log.user_id.slice(0, 8)}…`
                        : 'Không xác định'}
                    </td>
                    <td className="min-w-64 px-5 py-4">
                      {renderTables(log.tables)}
                    </td>
                    <td className="max-w-xs break-words px-5 py-4 text-slate-400">
                      {log.note || 'Không có ghi chú'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-400">
                      {formatLogDate(log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 p-4 md:hidden">
            {history.map((log) => (
              <article
                key={log.id}
                className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">Người dùng</p>
                    <p className="mt-1 break-all font-mono text-xs text-slate-300">
                      {log.user_id || 'Không xác định'}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">
                    {formatLogDate(log.created_at)}
                  </span>
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-xs text-slate-500">
                    Bảng dữ liệu
                  </p>
                  {renderTables(log.tables)}
                </div>

                <div className="mt-4 border-t border-slate-800 pt-3">
                  <p className="text-xs text-slate-500">Ghi chú</p>
                  <p className="mt-1 break-words text-sm text-slate-300">
                    {log.note || 'Không có ghi chú'}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <div className="flex flex-col gap-3 border-t border-slate-700/70 bg-slate-950/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-slate-500">
          Xóa lịch sử phụ thuộc vào quyền truy cập và chính sách RLS của Supabase.
        </p>

        <button
          type="button"
          onClick={onClear}
          disabled={busy || loading || history.length === 0}
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-300 hover:bg-amber-500/20 disabled:opacity-40"
        >
          {clearing ? (
            <Spinner label="Đang xóa lịch sử..." />
          ) : (
            '🧨 Xóa toàn bộ lịch sử'
          )}
        </button>
      </div>
    </Panel>
  )
}

/* =========================
   MAIN PAGE
========================= */

export default function AiCleanupPage() {
  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [history, setHistory] = useState<DeleteLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [clearingLogs, setClearingLogs] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  const busy = deleting || clearingLogs

  const loadHistory = useCallback(async () => {
    setLoadingLogs(true)

    try {
      const { data, error } = await supabase
        .from('delete_logs')
        .select('id, user_id, tables, note, created_at')
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error

      setHistory((data ?? []) as DeleteLog[])
    } catch (error) {
      console.error('Không thể tải delete_logs:', error)
      setNotice({
        type: 'error',
        text: `Không thể tải lịch sử xóa: ${getErrorMessage(error)}`,
      })
    } finally {
      setLoadingLogs(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const initialize = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()

        if (error) throw error

        if (!user) {
          router.replace('/login')
          return
        }

        if (mounted) setUserId(user.id)

        await loadHistory()
      } catch (error) {
        console.error('Không thể xác minh người dùng:', error)

        if (mounted) {
          setNotice({
            type: 'error',
            text: `Không thể xác minh phiên đăng nhập: ${getErrorMessage(error)}`,
          })
        }
      }
    }

    void initialize()

    return () => {
      mounted = false
    }
  }, [loadHistory, router])

  const toggleTable = useCallback((key: string) => {
    setSelected((previous) =>
      previous.includes(key)
        ? previous.filter((item) => item !== key)
        : [...previous, key],
    )
  }, [])

  const handleDelete = async () => {
    if (!userId) {
      setNotice({
        type: 'error',
        text: 'Không xác định được người dùng. Vui lòng đăng nhập lại.',
      })
      return
    }

    if (selected.length === 0 || busy) return

    const confirmed = window.confirm(
      [
        `Bạn chuẩn bị yêu cầu xóa dữ liệu ở ${selected.length} bảng:`,
        '',
        ...selected.map((key) => `• ${getTableLabel(key)}`),
        '',
        'Thao tác này có thể ảnh hưởng đến dữ liệu và kết quả phân tích.',
        'Bạn có chắc chắn muốn tiếp tục?',
      ].join('\n'),
    )

    if (!confirmed) return

    setDeleting(true)
    setNotice({ type: 'info', text: 'Đang gửi yêu cầu xóa dữ liệu...' })

    try {
      const response = await fetch('/api/auto-ai-refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          tables: selected,
          note: 'Xóa dữ liệu từ giao diện AI Cleanup',
        }),
      })

      const result = (await response.json().catch(() => ({}))) as ApiResult

      if (!response.ok || result.success === false) {
        throw new Error(
          result.error ||
            result.message ||
            `Yêu cầu thất bại: HTTP ${response.status}`,
        )
      }

      setSelected([])
      setNotice({
        type: 'success',
        text:
          result.message ||
          'Backend đã chấp nhận yêu cầu. Hãy kiểm tra lịch sử để xác nhận kết quả.',
      })

      await loadHistory()
    } catch (error) {
      console.error('Lỗi xóa dữ liệu:', error)
      setNotice({
        type: 'error',
        text: `Không thể hoàn thành yêu cầu xóa: ${getErrorMessage(error)}`,
      })
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteLogs = async () => {
    if (busy || history.length === 0) return

    const confirmed = window.confirm(
      'Bạn có chắc chắn muốn xóa toàn bộ lịch sử trong bảng delete_logs? Thao tác này không thể khôi phục nếu không có bản sao lưu.',
    )

    if (!confirmed) return

    setClearingLogs(true)
    setNotice({ type: 'info', text: 'Đang xóa lịch sử thao tác...' })

    try {
      const { error } = await supabase
        .from('delete_logs')
        .delete()
        .not('id', 'is', null)

      if (error) throw error

      setHistory([])
      setNotice({
        type: 'success',
        text: 'Đã gửi yêu cầu xóa lịch sử theo quyền Supabase hiện tại.',
      })
    } catch (error) {
      console.error('Lỗi xóa lịch sử:', error)
      setNotice({
        type: 'error',
        text: `Không thể xóa lịch sử: ${getErrorMessage(error)}`,
      })
    } finally {
      setClearingLogs(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}
        <header className="overflow-hidden rounded-3xl border border-slate-700/70 bg-gradient-to-br from-slate-900 via-slate-900 to-red-950/30">
          <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between sm:p-8">
            <div>
              <Link
                href="/settings"
                className="text-sm text-slate-400 transition hover:text-white"
              >
                ← Quay lại cài đặt
              </Link>

              <div className="mt-5 flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/10 text-2xl">
                  🗂️
                </span>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-red-300">
                    Data Administration
                  </p>
                  <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                    Quản lý và làm sạch dữ liệu
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                    Quản lý dữ liệu thị trường, AI và danh mục đầu tư.
                    Kiểm tra kỹ trước khi thực hiện thao tác xóa.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                ● {userId ? 'Đã xác thực người dùng' : 'Đang xác minh'}
              </span>
              <Link href="/settings" className={BUTTON}>
                Cài đặt hệ thống
              </Link>
            </div>
          </div>

          <div className="grid divide-y divide-slate-800 border-t border-slate-700/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <StatCard
              label="Tổng số bảng cấu hình"
              value={TABLES.length}
              icon="▤"
            />
            <StatCard
              label="Bảng đang chọn"
              value={selected.length}
              icon="✓"
            />
            <StatCard
              label="Lịch sử hiển thị / 10"
              value={history.length}
              icon="🧾"
            />
          </div>
        </header>

        {/* NOTIFICATION */}
        {notice && (
          <NoticeBanner
            notice={notice}
            onDismiss={() => setNotice(null)}
          />
        )}

        {/* TABLES */}
        <TableSelection
          selected={selected}
          busy={busy}
          onToggle={toggleTable}
        />

        {/* DELETE ACTION */}
        <Panel className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-semibold text-white">
                {selected.length
                  ? `Đã chọn ${selected.length} bảng dữ liệu`
                  : 'Chưa chọn bảng dữ liệu'}
              </p>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
                Thao tác có thể ảnh hưởng đến dữ liệu lịch sử, mô hình AI
                và danh mục đầu tư.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={busy || selected.length === 0 || !userId}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deleting ? <Spinner label="Đang xử lý..." /> : '⌫ Xóa dữ liệu đã chọn'}
            </button>
          </div>
        </Panel>

        {/* HISTORY */}
        <DeleteHistory
          history={history}
          loading={loadingLogs}
          busy={busy}
          clearing={clearingLogs}
          onRefresh={() => void loadHistory()}
          onClear={() => void handleDeleteLogs()}
        />

        {/* SAFETY */}
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-amber-200">
            ⚠️ Lưu ý về an toàn dữ liệu
          </h3>
          <p className="mt-2 text-xs leading-6 text-slate-400">
            Giao diện không thay thế việc kiểm tra quyền tại máy chủ.
            Backend cần xác thực tài khoản, kiểm tra quyền quản trị,
            giới hạn tên bảng được phép xử lý và ghi nhận kết quả thực tế.
            Hãy sao lưu dữ liệu quan trọng trước khi thao tác.
          </p>
        </div>

        <footer className="border-t border-slate-800 pt-5 text-center text-xs text-slate-500">
          LHP-FI · Data Administration & Audit
        </footer>
      </div>
    </main>
  )
}
