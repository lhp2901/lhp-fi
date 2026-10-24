
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { supabase } from '@/lib/supabase'
import ImportVN30 from './ImportVN30'
import ImportVNINDEX from './ImportVNINDEX'
import ImportStocks from './ImportStocks'

/* =====================================================
   TYPES
===================================================== */

type DataTab = 'vn30' | 'vnindex' | 'stocks' | 'crypto'

type PipelineStatus =
  | 'idle'
  | 'running'
  | 'success'
  | 'error'

type StepStatus = 'pending' | 'running' | 'success' | 'error'

type PipelineStep = {
  id: string
  label: string
  status: StepStatus
  message?: string
}

type Pipeline = {
  status: PipelineStatus
  message: string
  steps: PipelineStep[]
  startedAt: string | null
  finishedAt: string | null
}

type ApiResult = {
  success?: boolean
  message?: string
  error?: string
}

type PipelineKind = 'stocks' | 'market'

/* =====================================================
   CONSTANTS
===================================================== */

const DATA_TABS: {
  id: DataTab
  label: string
  icon: string
  description: string
}[] = [
  {
    id: 'vn30',
    label: 'VN30',
    icon: '📊',
    description: 'Dữ liệu chỉ số VN30',
  },
  {
    id: 'vnindex',
    label: 'VNINDEX',
    icon: '📈',
    description: 'Dữ liệu chỉ số VNINDEX',
  },
  {
    id: 'stocks',
    label: 'Cổ phiếu',
    icon: '🏢',
    description: 'Nhập và quản lý dữ liệu cổ phiếu',
  },
  {
    id: 'crypto',
    label: 'Crypto',
    icon: '₿',
    description: 'Danh sách tài sản tiền mã hóa',
  },
]

const STOCK_STEPS: PipelineStep[] = [
  { id: 'signals', label: 'Tạo tín hiệu từ dữ liệu', status: 'pending' },
  { id: 'train', label: 'Huấn luyện mô hình AI', status: 'pending' },
  { id: 'predict', label: 'Dự đoán cho các mã cổ phiếu', status: 'pending' },
]

const MARKET_STEPS: PipelineStep[] = [
  { id: 'market', label: 'Khởi chạy pipeline AI thị trường', status: 'pending' },
]

const INITIAL_PIPELINE: Pipeline = {
  status: 'idle',
  message: '',
  steps: [],
  startedAt: null,
  finishedAt: null,
}

const PANEL =
  'rounded-2xl border border-slate-700/70 bg-slate-900/80'

const BUTTON =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50'

/* =====================================================
   HELPERS
===================================================== */

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

function getApiMessage(data: ApiResult, fallback: string): string {
  return data.message || data.error || fallback
}

async function postApi(url: string): Promise<ApiResult> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  const data = (await response.json().catch(() => ({}))) as ApiResult

  if (!response.ok || data.success === false) {
    throw new Error(
      data.error ||
        data.message ||
        `Yêu cầu thất bại: HTTP ${response.status}`,
    )
  }

  return data
}

function formatTime(value: string | null): string {
  if (!value) return '--:--:--'

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}

/* =====================================================
   REUSABLE COMPONENTS
===================================================== */

function Spinner() {
  return (
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
  )
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-300">
        {eyebrow}
      </p>

      <h2 className="mt-2 text-lg font-bold text-white sm:text-xl">
        {title}
      </h2>

      <p className="mt-1 text-sm leading-6 text-slate-400">
        {description}
      </p>
    </div>
  )
}

function StatusBadge({ status }: { status: PipelineStatus }) {
  const config = {
    idle: {
      label: 'Chưa chạy',
      style: 'border-slate-600 bg-slate-800 text-slate-300',
    },
    running: {
      label: 'Đang xử lý',
      style: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    },
    success: {
      label: 'Hoàn thành',
      style: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    },
    error: {
      label: 'Thất bại',
      style: 'border-red-500/30 bg-red-500/10 text-red-300',
    },
  }[status]

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${config.style}`}
    >
      {status === 'running' && <Spinner />}
      {status === 'success' && '✓'}
      {status === 'error' && '✕'}
      {config.label}
    </span>
  )
}

function PipelineProgress({ pipeline }: { pipeline: Pipeline }) {
  if (pipeline.status === 'idle') return null

  const completed = pipeline.steps.filter(
    (step) => step.status === 'success',
  ).length

  const progress =
    pipeline.steps.length > 0
      ? Math.round((completed / pipeline.steps.length) * 100)
      : 0

  return (
    <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">
          Tiến trình xử lý
        </p>

        <StatusBadge status={pipeline.status} />
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            pipeline.status === 'error'
              ? 'bg-red-500'
              : pipeline.status === 'success'
                ? 'bg-emerald-500'
                : 'bg-indigo-500'
          }`}
          style={{
            width: `${pipeline.status === 'success' ? 100 : progress}%`,
          }}
        />
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-300" role="status">
        {pipeline.message}
      </p>

      <div className="mt-4 space-y-3">
        {pipeline.steps.map((step, index) => {
          const styles = {
            pending: 'border-slate-700 text-slate-500',
            running: 'border-blue-500/40 bg-blue-500/5 text-blue-300',
            success: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300',
            error: 'border-red-500/30 bg-red-500/5 text-red-300',
          }

          const icon = {
            pending: '○',
            running: '',
            success: '✓',
            error: '✕',
          }

          return (
            <div
              key={step.id}
              className={`flex items-start gap-3 rounded-lg border p-3 ${styles[step.status]}`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                {step.status === 'running' ? (
                  <Spinner />
                ) : (
                  icon[step.status]
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {index + 1}. {step.label}
                </p>

                {step.message && (
                  <p className="mt-1 break-words text-xs leading-5 opacity-80">
                    {step.message}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-slate-800 pt-3 text-xs text-slate-500">
        <span>Bắt đầu: {formatTime(pipeline.startedAt)}</span>
        <span>Kết thúc: {formatTime(pipeline.finishedAt)}</span>
      </div>
    </div>
  )
}

function DataImportSection({
  activeTab,
  setActiveTab,
}: {
  activeTab: DataTab
  setActiveTab: (tab: DataTab) => void
}) {
  return (
    <section className={`${PANEL} p-5 sm:p-6`}>
      <SectionTitle
        eyebrow="Data management"
        title="Quản lý dữ liệu đầu vào"
        description="Chọn nguồn dữ liệu để nhập, cập nhật và chuẩn bị cho các quy trình phân tích AI."
      />

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {DATA_TABS.map((tab) => {
          const active = activeTab === tab.id

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={active}
              className={`rounded-xl border p-4 text-left transition ${
                active
                  ? 'border-indigo-500/50 bg-indigo-500/10'
                  : 'border-slate-700 bg-slate-950/40 hover:border-slate-500'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>

              <p className="mt-3 text-sm font-semibold text-white">
                {tab.label}
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                {tab.description}
              </p>
            </button>
          )
        })}
      </div>

      <div className="mt-5 border-t border-slate-800 pt-5">
        {activeTab === 'vn30' && <ImportVN30 />}
        {activeTab === 'vnindex' && <ImportVNINDEX />}
        {activeTab === 'stocks' && <ImportStocks />}

        {activeTab === 'crypto' && (
          <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-5">
            <h3 className="font-semibold text-white">
              Quản lý danh sách Crypto
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Cấu hình các mã coin để hệ thống theo dõi dữ liệu và phân tích.
            </p>

            <Link
              href="/settings/crypto"
              className={`${BUTTON} mt-4 bg-indigo-600 text-white hover:bg-indigo-500`}
            >
              ⚙️ Quản lý danh sách Coin
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}

function PipelineCard({
  title,
  description,
  icon,
  pipeline,
  onRun,
  disabled,
  buttonLabel,
  accent,
}: {
  title: string
  description: string
  icon: string
  pipeline: Pipeline
  onRun: () => void
  disabled: boolean
  buttonLabel: string
  accent: 'green' | 'red'
}) {
  const buttonStyle =
    accent === 'green'
      ? 'bg-emerald-600 hover:bg-emerald-500'
      : 'bg-red-600 hover:bg-red-500'

  return (
    <article className={`${PANEL} p-5 sm:p-6`}>
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-2xl">
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-white">{title}</h3>

          <p className="mt-1 text-sm leading-6 text-slate-400">
            {description}
          </p>

          <div className="mt-3">
            <StatusBadge status={pipeline.status} />
          </div>
        </div>
      </div>

      <PipelineProgress pipeline={pipeline} />

      <button
        type="button"
        onClick={onRun}
        disabled={disabled}
        className={`${BUTTON} mt-5 w-full text-white ${buttonStyle}`}
      >
        {pipeline.status === 'running' ? (
          <>
            <Spinner />
            Đang xử lý...
          </>
        ) : (
          buttonLabel
        )}
      </button>
    </article>
  )
}

/* =====================================================
   MAIN SETTINGS PAGE
===================================================== */

export default function SettingsPage() {
  const router = useRouter()

  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [activeTab, setActiveTab] = useState<DataTab>('vn30')

  const [activePipeline, setActivePipeline] =
    useState<PipelineKind | null>(null)

  const [stockPipeline, setStockPipeline] =
    useState<Pipeline>(INITIAL_PIPELINE)

  const [marketPipeline, setMarketPipeline] =
    useState<Pipeline>(INITIAL_PIPELINE)

  /* AUTHENTICATION */

  useEffect(() => {
    let mounted = true

    const checkPermission = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) throw sessionError

        if (!session?.user) {
          router.replace('/login')
          return
        }

        const { data: user, error } = await supabase
          .from('users')
          .select('is_active')
          .eq('id', session.user.id)
          .single()

        if (error || !user?.is_active) {
          router.replace('/403')
          return
        }

        if (mounted) setAllowed(true)
      } catch (error) {
        console.error('Lỗi xác minh quyền:', error)
        router.replace('/403')
      } finally {
        if (mounted) setChecking(false)
      }
    }

    void checkPermission()

    return () => {
      mounted = false
    }
  }, [router])

  /* UPDATE PIPELINE */

  const updatePipeline = useCallback(
    (
      kind: PipelineKind,
      updater: (previous: Pipeline) => Pipeline,
    ) => {
      const setter =
        kind === 'stocks' ? setStockPipeline : setMarketPipeline

      setter(updater)
    },
    [],
  )

  /* STOCK AI: SIGNALS → TRAIN → PREDICT */

  const runStockPipeline = async () => {
    if (activePipeline) return

    setActivePipeline('stocks')

    const startedAt = new Date().toISOString()

    updatePipeline('stocks', () => ({
      status: 'running',
      message: 'Đang khởi chạy quy trình AI cổ phiếu...',
      steps: STOCK_STEPS.map((step) => ({ ...step })),
      startedAt,
      finishedAt: null,
    }))

    const jobs = [
      {
        id: 'signals',
        label: 'Tạo tín hiệu từ dữ liệu',
        url: '/api/generate-signals',
      },
      {
        id: 'train',
        label: 'Huấn luyện mô hình AI',
        url: '/api/train-model',
      },
      {
        id: 'predict',
        label: 'Dự đoán cho các mã cổ phiếu',
        url: '/api/predict-all',
      },
    ]

    try {
      for (const job of jobs) {
        updatePipeline('stocks', (previous) => ({
          ...previous,
          message: `Đang thực hiện: ${job.label}...`,
          steps: previous.steps.map((step) => ({
            ...step,
            status:
              step.id === job.id
                ? 'running'
                : step.status,
          })),
        }))

        try {
          const result = await postApi(job.url)

          updatePipeline('stocks', (previous) => ({
            ...previous,
            steps: previous.steps.map((step) =>
              step.id === job.id
                ? {
                    ...step,
                    status: 'success',
                    message: getApiMessage(
                      result,
                      'API phản hồi thành công.',
                    ),
                  }
                : step,
            ),
          }))
        } catch (error) {
          updatePipeline('stocks', (previous) => ({
            ...previous,
            status: 'error',
            message: `${job.label} thất bại: ${getErrorMessage(error)}`,
            steps: previous.steps.map((step) =>
              step.id === job.id
                ? {
                    ...step,
                    status: 'error',
                    message: getErrorMessage(error),
                  }
                : step,
            ),
            finishedAt: new Date().toISOString(),
          }))

          throw error
        }
      }

      updatePipeline('stocks', (previous) => ({
        ...previous,
        status: 'success',
        message:
          'Hoàn thành 3 bước AI cổ phiếu. Các API đã phản hồi thành công.',
        steps: previous.steps.map((step) => ({
          ...step,
          status: 'success',
        })),
        finishedAt: new Date().toISOString(),
      }))
    } catch (error) {
      console.error('Lỗi pipeline AI cổ phiếu:', error)

      updatePipeline('stocks', (previous) => ({
        ...previous,
        status: 'error',
        message: previous.message || getErrorMessage(error),
        finishedAt: previous.finishedAt || new Date().toISOString(),
      }))
    } finally {
      setActivePipeline(null)
    }
  }

  /* MARKET AI: VNINDEX + VN30 */

  const runMarketPipeline = async () => {
    if (activePipeline) return

    setActivePipeline('market')

    const startedAt = new Date().toISOString()

    updatePipeline('market', () => ({
      status: 'running',
      message: 'Đang gọi AI server xử lý VNINDEX - VN30...',
      steps: MARKET_STEPS.map((step) => ({
        ...step,
        status: 'running',
      })),
      startedAt,
      finishedAt: null,
    }))

    try {
      const result = await postApi('/api/ai/run')

      updatePipeline('market', (previous) => ({
        ...previous,
        status: 'success',
        message: getApiMessage(
          result,
          'AI server đã hoàn thành yêu cầu chạy pipeline thị trường.',
        ),
        steps: previous.steps.map((step) => ({
          ...step,
          status: 'success',
          message: getApiMessage(result, 'API phản hồi thành công.'),
        })),
        finishedAt: new Date().toISOString(),
      }))
    } catch (error) {
      console.error('Lỗi pipeline AI thị trường:', error)

      updatePipeline('market', (previous) => ({
        ...previous,
        status: 'error',
        message: `Không thể hoàn thành pipeline AI thị trường: ${getErrorMessage(error)}`,
        steps: previous.steps.map((step) => ({
          ...step,
          status: 'error',
          message: getErrorMessage(error),
        })),
        finishedAt: new Date().toISOString(),
      }))
    } finally {
      setActivePipeline(null)
    }
  }

  /* PAGE STATES */

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-300">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-5">
          <Spinner />
          <span className="text-sm">
            Đang xác minh quyền truy cập...
          </span>
        </div>
      </main>
    )
  }

  if (!allowed) return null

  /* RENDER */

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}

        <header className="overflow-hidden rounded-3xl border border-slate-700/70 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40">
          <div className="flex flex-col gap-5 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">
                LHP-FI · System Administration
              </p>

              <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Cài đặt hệ thống
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Quản lý dữ liệu đầu vào, vận hành AI cổ phiếu và phân tích
                xu hướng thị trường VNINDEX - VN30 trên cùng một giao diện.
              </p>
            </div>

            <Link
              href="/settings/ai-cleanup"
              className={`${BUTTON} border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20`}
            >
              🗂️ Quản lý dữ liệu AI
            </Link>
          </div>

          <div className="grid grid-cols-1 border-t border-slate-700/70 sm:grid-cols-3">
            <div className="border-b border-slate-800 p-4 sm:border-b-0 sm:border-r sm:p-5">
              <p className="text-xs text-slate-500">Nguồn dữ liệu</p>
              <p className="mt-2 font-semibold text-white">4 danh mục</p>
            </div>

            <div className="border-b border-slate-800 p-4 sm:border-b-0 sm:border-r sm:p-5">
              <p className="text-xs text-slate-500">AI cổ phiếu</p>
              <div className="mt-2">
                <StatusBadge status={stockPipeline.status} />
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <p className="text-xs text-slate-500">AI thị trường</p>
              <div className="mt-2">
                <StatusBadge status={marketPipeline.status} />
              </div>
            </div>
          </div>
        </header>

        {/* DATA MANAGEMENT */}

        <DataImportSection
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        {/* AI PIPELINES */}

        <section className="space-y-5">
          <SectionTitle
            eyebrow="AI operations"
            title="Trung tâm vận hành AI"
            description="Khởi chạy từng quy trình, theo dõi trạng thái xử lý và xem kết quả phản hồi của hệ thống."
          />

          <div className="grid gap-5 lg:grid-cols-2">
            <PipelineCard
              title="AI cổ phiếu"
              description="Tạo tín hiệu, huấn luyện mô hình và chạy dự đoán cho các mã cổ phiếu."
              icon="🧠"
              pipeline={stockPipeline}
              onRun={() => void runStockPipeline()}
              disabled={activePipeline !== null}
              buttonLabel="🚀 Chạy AI cổ phiếu"
              accent="green"
            />

            <PipelineCard
              title="AI thị trường VNINDEX - VN30"
              description="Gọi AI server chạy pipeline phân tích dữ liệu và tín hiệu thị trường."
              icon="📈"
              pipeline={marketPipeline}
              onRun={() => void runMarketPipeline()}
              disabled={activePipeline !== null}
              buttonLabel="🚀 Chạy AI thị trường"
              accent="red"
            />
          </div>
        </section>

        {/* DATA CLEANUP */}

        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-amber-200">
                ⚠️ Kiểm soát và làm sạch dữ liệu
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Kiểm tra nhật ký, quản lý dữ liệu AI và xử lý dữ liệu không
                hợp lệ. Hãy sao lưu trước khi xóa dữ liệu quan trọng.
              </p>
            </div>

            <Link
              href="/settings/ai-cleanup"
              className={`${BUTTON} shrink-0 border border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20`}
            >
              Mở quản lý dữ liệu →
            </Link>
          </div>
        </section>

        {/* FOOTER */}

        <footer className="border-t border-slate-800 pt-5 text-center text-xs text-slate-500">
          LHP-FI · Data Management & AI Operations
        </footer>
      </div>
    </main>
  )
}

