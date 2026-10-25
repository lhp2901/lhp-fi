'use client'

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

import ImportVN30 from './ImportVN30'
import ImportVNINDEX from './ImportVNINDEX'
import ImportStocks from './ImportStocks'

/* =========================================================
   TYPES
========================================================= */

type TabKey = 'vn30' | 'vnindex' | 'stocks' | 'crypto'

type SyncTarget = 'vnindex' | 'vn30' | 'stocks'

type PipelineStatus = 'idle' | 'running' | 'success' | 'error'

type StepStatus = 'pending' | 'running' | 'success' | 'error'

type ApiResult = {
  success?: boolean
  message?: string
  error?: string
  detail?: string
  [key: string]: unknown
}

type PipelineStep = {
  id: string
  title: string
  description: string
  status: StepStatus
  startedAt?: string
  finishedAt?: string
  durationSeconds?: number
  message?: string
}

type SyncTargetResult = {
  target?: string
  success?: boolean
  message?: string
  error?: string
  inserted?: number
  updated?: number
  skipped?: number
  total?: number
  symbol?: string
  [key: string]: unknown
}

type SyncApiResponse = ApiResult & {
  results?: SyncTargetResult[] | Record<string, unknown>
  started_at?: string
  finished_at?: string
  duration_seconds?: number
}

type MarketApiResponse = ApiResult & {
  results?: unknown
  started_at?: string
  finished_at?: string
  duration_seconds?: number
}

type PipelineJob = {
  id: string
  title: string
  description: string
  url: string
}

type UserInfo = {
  id: string
  email?: string
}

/* =========================================================
   CONSTANTS
========================================================= */

const STOCK_SYMBOLS = [
  'FPT',
  'HPG',
  'SSI',
  'VCB',
  'BID',
  'CTG',
  'MBB',
  'TCB',
  'ACB',
  'VPB',
  'VNM',
  'MWG',
  'GAS',
  'PLX',
  'VIC',
  'VHM',
  'VRE',
  'GVR',
  'DGC',
  'DXG',
]

const STOCK_PIPELINE_JOBS: PipelineJob[] = [
  {
    id: 'signals',
    title: 'Tạo tín hiệu từ dữ liệu',
    description:
      'Đọc dữ liệu thị trường, tính toán chỉ báo và tạo tín hiệu đầu vào.',
    url: '/api/generate-signals',
  },
  {
    id: 'train',
    title: 'Huấn luyện mô hình AI',
    description:
      'Huấn luyện hoặc cập nhật mô hình theo dữ liệu hiện có.',
    url: '/api/train-model',
  },
  {
    id: 'predict',
    title: 'Dự đoán các mã cổ phiếu',
    description:
      'Chạy dự đoán và lưu kết quả phân tích vào Supabase.',
    url: '/api/predict-all',
  },
]

const INITIAL_STEPS: PipelineStep[] = STOCK_PIPELINE_JOBS.map(
  (job) => ({
    id: job.id,
    title: job.title,
    description: job.description,
    status: 'pending',
  }),
)

/* =========================================================
   HELPERS
========================================================= */

function getBackendBaseUrl(): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_LHP_AI_SERVER_URL?.trim()

  const baseUrl =
    configuredUrl || 'http://127.0.0.1:10000'

  return baseUrl.replace(/\/+$/, '')
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDuration(seconds?: number): string {
  if (
    typeof seconds !== 'number' ||
    !Number.isFinite(seconds) ||
    seconds < 0
  ) {
    return '—'
  }

  if (seconds < 60) {
    return `${seconds.toFixed(1)} giây`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)

  return `${minutes} phút ${remainingSeconds} giây`
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'Đã xảy ra lỗi không xác định.'
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

async function readApiResponse<T extends ApiResult>(
  response: Response,
): Promise<T> {
  const text = await response.text()

  let payload: unknown = {}

  if (text.trim()) {
    try {
      payload = JSON.parse(text) as unknown
    } catch {
      payload = {
        message: text,
      }
    }
  }

  if (!response.ok) {
    const errorMessage =
      isRecord(payload) &&
      typeof payload.error === 'string'
        ? payload.error
        : isRecord(payload) &&
            typeof payload.message === 'string'
          ? payload.message
          : `Máy chủ trả về HTTP ${response.status}.`

    throw new Error(errorMessage)
  }

  if (!isRecord(payload)) {
    throw new Error(
      'Phản hồi từ máy chủ không đúng định dạng JSON object.',
    )
  }

  if (payload.success === false) {
    const errorMessage =
      typeof payload.error === 'string'
        ? payload.error
        : typeof payload.message === 'string'
          ? payload.message
          : 'Máy chủ báo tác vụ thất bại.'

    throw new Error(errorMessage)
  }

  return payload as T
}

async function postApi<T extends ApiResult>(
  url: string,
  body: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify(body),
  })

  return readApiResponse<T>(response)
}

function getSyncResultItems(
  value: SyncApiResponse['results'],
): SyncTargetResult[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is SyncTargetResult =>
        isRecord(item),
    )
  }

  if (!isRecord(value)) {
    return []
  }

  return Object.entries(value).map(([key, item]) => {
    if (isRecord(item)) {
      return {
        target:
          typeof item.target === 'string'
            ? item.target
            : key,
        ...item,
      } as SyncTargetResult
    }

    return {
      target: key,
      message:
        typeof item === 'string'
          ? item
          : 'Đã nhận kết quả.',
    }
  })
}

function getStepStatusLabel(status: StepStatus): string {
  switch (status) {
    case 'running':
      return 'Đang xử lý'
    case 'success':
      return 'Hoàn thành'
    case 'error':
      return 'Thất bại'
    default:
      return 'Đang chờ'
  }
}

function getPipelineStatusLabel(
  status: PipelineStatus,
): string {
  switch (status) {
    case 'running':
      return 'Đang chạy'
    case 'success':
      return 'Hoàn thành'
    case 'error':
      return 'Có lỗi'
    default:
      return 'Chưa chạy'
  }
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function SettingsPage() {
  const router = useRouter()

  /* -------------------------
     AUTHENTICATION
  ------------------------- */

  const [authLoading, setAuthLoading] = useState(true)
  const [currentUser, setCurrentUser] =
    useState<UserInfo | null>(null)

  const [pageError, setPageError] = useState('')

  /* -------------------------
     TABS
  ------------------------- */

  const [activeTab, setActiveTab] =
  useState<TabKey | null>(null)

  /* -------------------------
     DNSE SYNC
  ------------------------- */

  const [syncTargets, setSyncTargets] =
    useState<SyncTarget[]>([
      'vnindex',
      'vn30',
      'stocks',
    ])

  const [selectedStockSymbols, setSelectedStockSymbols] =
    useState<string[]>(['FPT', 'HPG', 'SSI'])

  const [customSymbol, setCustomSymbol] = useState('')

  const [syncStatus, setSyncStatus] =
    useState<PipelineStatus>('idle')

  const [syncMessage, setSyncMessage] = useState('')

  const [syncError, setSyncError] = useState('')

  const [syncResults, setSyncResults] =
    useState<SyncTargetResult[]>([])

  const [syncStartedAt, setSyncStartedAt] =
    useState<string | null>(null)

  const [syncFinishedAt, setSyncFinishedAt] =
    useState<string | null>(null)

  const [syncDuration, setSyncDuration] =
    useState<number | undefined>(undefined)

  /* -------------------------
     STOCK AI PIPELINE
  ------------------------- */

  const [stockPipelineStatus, setStockPipelineStatus] =
    useState<PipelineStatus>('idle')

  const [stockSteps, setStockSteps] =
    useState<PipelineStep[]>(INITIAL_STEPS)

  const [stockPipelineError, setStockPipelineError] =
    useState('')

  const [stockPipelineMessage, setStockPipelineMessage] =
    useState('')

  const [stockPipelineStartedAt, setStockPipelineStartedAt] =
    useState<string | null>(null)

  const [stockPipelineFinishedAt, setStockPipelineFinishedAt] =
    useState<string | null>(null)

  const [stockPipelineDuration, setStockPipelineDuration] =
    useState<number | undefined>(undefined)

  /* -------------------------
     MARKET AI
  ------------------------- */

  const [marketPipelineStatus, setMarketPipelineStatus] =
    useState<PipelineStatus>('idle')

  const [marketPipelineMessage, setMarketPipelineMessage] =
    useState('')

  const [marketPipelineError, setMarketPipelineError] =
    useState('')

  const [marketStartedAt, setMarketStartedAt] =
    useState<string | null>(null)

  const [marketFinishedAt, setMarketFinishedAt] =
    useState<string | null>(null)

  const [marketDuration, setMarketDuration] =
    useState<number | undefined>(undefined)

  const [marketResponse, setMarketResponse] =
    useState<MarketApiResponse | null>(null)

  /* =========================================================
     AUTH CHECK
  ========================================================= */

  useEffect(() => {
    let cancelled = false

    async function verifyAccess() {
      setAuthLoading(true)
      setPageError('')

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          throw sessionError
        }

        if (!session?.user) {
          router.replace('/login')
          return
        }

        const user = session.user

        const { data: profile, error: profileError } =
          await supabase
            .from('users')
            .select('is_active')
            .eq('id', user.id)
            .maybeSingle()

        if (profileError) {
          throw new Error(
            `Không thể xác minh trạng thái tài khoản: ${profileError.message}`,
          )
        }

        if (!profile || profile.is_active !== true) {
          router.replace('/403')
          return
        }

        if (!cancelled) {
          setCurrentUser({
            id: user.id,
            email: user.email ?? undefined,
          })
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setPageError(getErrorMessage(error))
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false)
        }
      }
    }

    void verifyAccess()

    return () => {
      cancelled = true
    }
  }, [router])

  /* =========================================================
     DNSE TARGET HELPERS
  ========================================================= */

  const toggleSyncTarget = useCallback(
    (target: SyncTarget) => {
      setSyncTargets((previous) =>
        previous.includes(target)
          ? previous.filter((item) => item !== target)
          : [...previous, target],
      )
    },
    [],
  )

  const toggleStockSymbol = useCallback(
    (symbol: string) => {
      const normalized = symbol.trim().toUpperCase()

      if (!normalized) return

      setSelectedStockSymbols((previous) =>
        previous.includes(normalized)
          ? previous.filter(
              (item) => item !== normalized,
            )
          : [...previous, normalized],
      )
    },
    [],
  )

  const addCustomSymbol = useCallback(() => {
    const normalized = customSymbol
      .trim()
      .toUpperCase()

    if (!/^[A-Z0-9]{2,10}$/.test(normalized)) {
      setSyncError(
        'Mã cổ phiếu không hợp lệ. Hãy nhập mã gồm 2–10 ký tự chữ hoặc số.',
      )
      return
    }

    setSelectedStockSymbols((previous) =>
      previous.includes(normalized)
        ? previous
        : [...previous, normalized],
    )

    setCustomSymbol('')
    setSyncError('')
  }, [customSymbol])

  /* =========================================================
     DNSE SYNC
  ========================================================= */

  const runDnseSync = useCallback(async () => {
    if (!currentUser) {
      setSyncError(
        'Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.',
      )
      return
    }

    if (syncTargets.length === 0) {
      setSyncError(
        'Vui lòng chọn ít nhất một nhóm dữ liệu cần đồng bộ.',
      )
      return
    }

    if (
      syncTargets.includes('stocks') &&
      selectedStockSymbols.length === 0
    ) {
      setSyncError(
        'Vui lòng chọn ít nhất một mã cổ phiếu.',
      )
      return
    }

    const baseUrl = getBackendBaseUrl()
    const requestUrl = `${baseUrl}/api/dnse/sync`

    const started = new Date()

    setSyncStatus('running')
    setSyncMessage('Đang gửi yêu cầu đồng bộ đến backend DNSE...')
    setSyncError('')
    setSyncResults([])
    setSyncStartedAt(started.toISOString())
    setSyncFinishedAt(null)
    setSyncDuration(undefined)

    try {
      const response = await postApi<SyncApiResponse>(
        requestUrl,
        {
          targets: syncTargets,
          symbols: syncTargets.includes('stocks')
            ? selectedStockSymbols
            : [],
          user_id: currentUser.id,
        },
      )

      const finished = new Date()

      const resultItems = getSyncResultItems(
        response.results,
      )

      setSyncResults(resultItems)
      setSyncFinishedAt(
        response.finished_at ?? finished.toISOString(),
      )

      const elapsed =
        typeof response.duration_seconds === 'number'
          ? response.duration_seconds
          : (finished.getTime() - started.getTime()) /
            1000

      setSyncDuration(elapsed)

      const failedItems = resultItems.filter(
        (item) => item.success === false,
      )

      if (failedItems.length > 0) {
        setSyncStatus('error')
        setSyncError(
          failedItems
            .map(
              (item) =>
                `${item.target ?? item.symbol ?? 'Dữ liệu'}: ${
                  item.error ??
                  item.message ??
                  'Đồng bộ thất bại'
                }`,
            )
            .join('\n'),
        )

        setSyncMessage(
          'Backend đã trả về kết quả nhưng có nhóm dữ liệu chưa đồng bộ thành công.',
        )

        return
      }

      setSyncStatus('success')
      setSyncMessage(
        response.message ??
          'Đã nhận phản hồi đồng bộ từ backend DNSE.',
      )
    } catch (error: unknown) {
      const finished = new Date()

      setSyncStatus('error')
      setSyncFinishedAt(finished.toISOString())
      setSyncDuration(
        (finished.getTime() - started.getTime()) / 1000,
      )
      setSyncError(getErrorMessage(error))
      setSyncMessage(
        'Không thể hoàn thành yêu cầu đồng bộ dữ liệu.',
      )
    }
  }, [
    currentUser,
    selectedStockSymbols,
    syncTargets,
  ])

  /* =========================================================
     STOCK AI PIPELINE
  ========================================================= */

  const updateStockStep = useCallback(
    (
      stepId: string,
      update: Partial<PipelineStep>,
    ) => {
      setStockSteps((previous) =>
        previous.map((step) =>
          step.id === stepId
            ? { ...step, ...update }
            : step,
        ),
      )
    },
    [],
  )

  const runStockPipeline = useCallback(async () => {
    if (stockPipelineStatus === 'running') return

    const started = new Date()

    setStockPipelineStatus('running')
    setStockPipelineError('')
    setStockPipelineMessage(
      'Đang khởi chạy tiến trình AI cổ phiếu.',
    )
    setStockPipelineStartedAt(started.toISOString())
    setStockPipelineFinishedAt(null)
    setStockPipelineDuration(undefined)
    setStockSteps(
      STOCK_PIPELINE_JOBS.map((job) => ({
        id: job.id,
        title: job.title,
        description: job.description,
        status: 'pending',
      })),
    )

    try {
      for (const job of STOCK_PIPELINE_JOBS) {
        const stepStarted = new Date()

        updateStockStep(job.id, {
          status: 'running',
          startedAt: stepStarted.toISOString(),
          finishedAt: undefined,
          durationSeconds: undefined,
          message: 'Đang xử lý...',
        })

        setStockPipelineMessage(
          `Đang thực hiện bước: ${job.title}`,
        )

        try {
          const response = await postApi<ApiResult>(
            job.url,
            {},
          )

          const stepFinished = new Date()

          updateStockStep(job.id, {
            status: 'success',
            finishedAt: stepFinished.toISOString(),
            durationSeconds:
              (stepFinished.getTime() -
                stepStarted.getTime()) /
              1000,
            message:
              response.message ??
              'Máy chủ đã xác nhận bước xử lý thành công.',
          })
        } catch (error: unknown) {
          const stepFinished = new Date()

          updateStockStep(job.id, {
            status: 'error',
            finishedAt: stepFinished.toISOString(),
            durationSeconds:
              (stepFinished.getTime() -
                stepStarted.getTime()) /
              1000,
            message: getErrorMessage(error),
          })

          throw new Error(
            `${job.title}: ${getErrorMessage(error)}`,
          )
        }
      }

      const finished = new Date()

      setStockPipelineStatus('success')
      setStockPipelineMessage(
        'Đã hoàn thành cả 3 bước của tiến trình AI cổ phiếu.',
      )
      setStockPipelineFinishedAt(finished.toISOString())
      setStockPipelineDuration(
        (finished.getTime() - started.getTime()) / 1000,
      )
    } catch (error: unknown) {
      const finished = new Date()

      setStockPipelineStatus('error')
      setStockPipelineError(getErrorMessage(error))
      setStockPipelineMessage(
        'Tiến trình đã dừng do có bước xử lý thất bại. Hãy kiểm tra lỗi trước khi chạy lại.',
      )
      setStockPipelineFinishedAt(finished.toISOString())
      setStockPipelineDuration(
        (finished.getTime() - started.getTime()) / 1000,
      )
    }
  }, [
    stockPipelineStatus,
    updateStockStep,
  ])

  /* =========================================================
     MARKET AI
  ========================================================= */

  const runMarketPipeline = useCallback(async () => {
    if (marketPipelineStatus === 'running') return

    const started = new Date()

    setMarketPipelineStatus('running')
    setMarketPipelineMessage(
      'Đang phân tích thị trường VNINDEX và VN30...',
    )
    setMarketPipelineError('')
    setMarketStartedAt(started.toISOString())
    setMarketFinishedAt(null)
    setMarketDuration(undefined)
    setMarketResponse(null)

    try {
      const response = await postApi<MarketApiResponse>(
        '/api/ai/run',
        {},
      )

      const finished = new Date()

      setMarketResponse(response)
      setMarketPipelineStatus('success')
      setMarketPipelineMessage(
        response.message ??
          'Backend đã xác nhận hoàn thành yêu cầu phân tích thị trường.',
      )
      setMarketFinishedAt(
        response.finished_at ?? finished.toISOString(),
      )
      setMarketDuration(
        typeof response.duration_seconds === 'number'
          ? response.duration_seconds
          : (finished.getTime() - started.getTime()) /
            1000,
      )
    } catch (error: unknown) {
      const finished = new Date()

      setMarketPipelineStatus('error')
      setMarketPipelineError(getErrorMessage(error))
      setMarketPipelineMessage(
        'Không thể hoàn thành phân tích thị trường.',
      )
      setMarketFinishedAt(finished.toISOString())
      setMarketDuration(
        (finished.getTime() - started.getTime()) / 1000,
      )
    }
  }, [marketPipelineStatus])

  /* =========================================================
     AUTH LOADING / ERROR
  ========================================================= */

  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <div className="mx-auto flex min-h-[60vh] max-w-5xl items-center justify-center">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />
            <h1 className="text-lg font-semibold">
              Đang xác minh quyền truy cập
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Vui lòng đợi trong giây lát...
            </p>
          </div>
        </div>
      </main>
    )
  }

  if (pageError) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-900/60 bg-red-950/30 p-6">
          <h1 className="text-lg font-semibold text-red-300">
            Không thể xác minh quyền truy cập
          </h1>

          <p className="mt-3 whitespace-pre-wrap text-sm text-red-200">
            {pageError}
          </p>

          <button
            type="button"
            onClick={() => router.replace('/login')}
            className="mt-5 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400"
          >
            Đăng nhập lại
          </button>
        </div>
      </main>
    )
  }

  if (!currentUser) {
    return null
  }

  const isAnyPipelineRunning =
    syncStatus === 'running' ||
    stockPipelineStatus === 'running' ||
    marketPipelineStatus === 'running'

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* HEADER */}

        <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              LHP-FI · AI CONTROL CENTER
            </div>

            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Trung tâm điều khiển hệ thống
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Quản lý dữ liệu thị trường, đồng bộ DNSE và theo
              dõi các tiến trình phân tích AI.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
            <p className="text-xs text-slate-500">
              Tài khoản đang đăng nhập
            </p>
            <p className="mt-1 max-w-xs break-all text-sm font-medium text-slate-200">
              {currentUser.email ?? currentUser.id}
            </p>
            <p className="mt-1 text-xs text-emerald-400">
              ● Đã xác minh quyền truy cập
            </p>
          </div>
        </header>
      
        {/* NAVIGATION TABS */}

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-2">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <TabButton
              active={activeTab === 'vn30'}
              onClick={() => setActiveTab('vn30')}
              title="VN30"
              subtitle="30 cổ phiếu vốn hóa lớn"
            />

            <TabButton
              active={activeTab === 'vnindex'}
              onClick={() => setActiveTab('vnindex')}
              title="VNINDEX"
              subtitle="Chỉ số thị trường"
            />

            <TabButton
              active={activeTab === 'stocks'}
              onClick={() => setActiveTab('stocks')}
              title="Cổ phiếu"
              subtitle="Dữ liệu và tín hiệu AI"
            />

            <TabButton
              active={activeTab === 'crypto'}
              onClick={() => setActiveTab('crypto')}
              title="Crypto"
              subtitle="Dữ liệu tài sản số"
            />
          </div>
        </section>

        {/* DATA MANAGEMENT: CHỈ HIỆN KHI NGƯỜI DÙNG CHỌN TAB */}
        {activeTab !== null && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
            <SectionHeading
              eyebrow="DATA MANAGEMENT"
              title={
                activeTab === 'vn30'
                  ? 'Quản lý dữ liệu VN30'
                  : activeTab === 'vnindex'
                    ? 'Quản lý dữ liệu VNINDEX'
                    : activeTab === 'stocks'
                      ? 'Quản lý dữ liệu cổ phiếu'
                      : 'Quản lý dữ liệu Crypto'
              }
              description={
                activeTab === 'vn30'
                  ? 'Nhập và quản lý dữ liệu thị trường của nhóm cổ phiếu VN30.'
                  : activeTab === 'vnindex'
                    ? 'Nhập và quản lý dữ liệu chỉ số VNINDEX.'
                    : activeTab === 'stocks'
                      ? 'Nhập và quản lý dữ liệu các mã cổ phiếu.'
                      : 'Truy cập khu vực quản lý tài sản số và dữ liệu Crypto.'
              }
            />

            <div className="mt-5">
              {activeTab === 'vn30' && <ImportVN30 />}

              {activeTab === 'vnindex' && <ImportVNINDEX />}

              {activeTab === 'stocks' && <ImportStocks />}

              {activeTab === 'crypto' && (
                <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-100">
                      Quản lý danh sách Crypto
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      Cấu hình các mã coin để hệ thống theo dõi dữ liệu và phân tích.
                    </p>
                  </div>

                  <Link
                    href="/settings/crypto"
                    className="inline-flex shrink-0 items-center justify-center rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                  >
                    ⚙️ Quản lý danh sách Coin →
                  </Link>
                </div>
              )}
            </div>
          </section>
        )}

        {/* HƯỚNG DẪN KHI CHƯA CHỌN TAB */}
        {activeTab === null && (
          <section className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-5 py-10 text-center sm:px-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-2xl text-cyan-300">
              ▦
            </div>

            <h2 className="mt-4 text-lg font-bold text-slate-100">
              Chọn khu vực dữ liệu
            </h2>

            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
              Chọn VN30, VNINDEX, Cổ phiếu hoặc Crypto ở phía trên
              để mở khu vực quản lý dữ liệu tương ứng.
            </p>
          </section>
        )}
    

        {/* DNSE SYNC */}

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
          <SectionHeading
            eyebrow="LIVE MARKET DATA"
            title="Đồng bộ dữ liệu DNSE"
            description="Gửi yêu cầu tới backend để lấy dữ liệu thị trường và lưu vào Supabase. Kết quả hiển thị dựa trên phản hồi thực tế của máy chủ."
          />

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <TargetCard
              title="VNINDEX"
              description="Dữ liệu chỉ số thị trường"
              selected={syncTargets.includes('vnindex')}
              onClick={() => toggleSyncTarget('vnindex')}
            />

            <TargetCard
              title="VN30"
              description="Dữ liệu chỉ số và nhóm cổ phiếu VN30"
              selected={syncTargets.includes('vn30')}
              onClick={() => toggleSyncTarget('vn30')}
            />

            <TargetCard
              title="Cổ phiếu"
              description="Đồng bộ theo các mã đã chọn"
              selected={syncTargets.includes('stocks')}
              onClick={() => toggleSyncTarget('stocks')}
            />
          </div>

          {syncTargets.includes('stocks') && (
            <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold">
                    Mã cổ phiếu cần đồng bộ
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Đã chọn {selectedStockSymbols.length} mã.
                  </p>
                </div>

                <div className="flex gap-2">
                  <input
                    value={customSymbol}
                    onChange={(event) =>
                      setCustomSymbol(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addCustomSymbol()
                      }
                    }}
                    placeholder="Nhập mã, ví dụ DXG"
                    maxLength={10}
                    className="min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm uppercase outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
                  />

                  <button
                    type="button"
                    onClick={addCustomSymbol}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium transition hover:border-cyan-500 hover:text-cyan-300"
                  >
                    Thêm
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {STOCK_SYMBOLS.map((symbol) => {
                  const selected =
                    selectedStockSymbols.includes(symbol)

                  return (
                    <button
                      key={symbol}
                      type="button"
                      onClick={() => toggleStockSymbol(symbol)}
                      aria-pressed={selected}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                        selected
                          ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300'
                          : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {selected ? '✓ ' : ''}
                      {symbol}
                    </button>
                  )
                })}
              </div>

              {selectedStockSymbols.length > 0 && (
                <div className="mt-4 border-t border-slate-800 pt-3">
                  <p className="mb-2 text-xs text-slate-500">
                    Danh sách đã chọn
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {selectedStockSymbols.map((symbol) => (
                      <button
                        key={symbol}
                        type="button"
                        onClick={() =>
                          toggleStockSymbol(symbol)
                        }
                        title={`Bỏ chọn ${symbol}`}
                        className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300 transition hover:bg-red-500/15 hover:text-red-300"
                      >
                        {symbol} ×
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs leading-5 text-slate-500">
              <p>
                Backend:{' '}
                <span className="break-all text-slate-400">
                  {getBackendBaseUrl()}
                </span>
              </p>
              <p className="mt-1">
                Endpoint: POST /api/dnse/sync
              </p>
            </div>

            <button
              type="button"
              onClick={() => void runDnseSync()}
              disabled={
                isAnyPipelineRunning ||
                syncTargets.length === 0
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {syncStatus === 'running' ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-800 border-t-transparent" />
                  Đang đồng bộ...
                </>
              ) : (
                <>↻ Đồng bộ DNSE</>
              )}
            </button>
          </div>

          {syncMessage && (
            <StatusBanner
              status={syncStatus}
              title={getPipelineStatusLabel(syncStatus)}
              message={syncMessage}
            />
          )}

          {syncError && (
            <ErrorPanel
              title="Lỗi đồng bộ DNSE"
              message={syncError}
            />
          )}

          {(syncStartedAt || syncFinishedAt) && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricCard
                label="Bắt đầu"
                value={formatDateTime(syncStartedAt)}
              />

              <MetricCard
                label="Kết thúc"
                value={formatDateTime(syncFinishedAt)}
              />

              <MetricCard
                label="Thời gian xử lý"
                value={formatDuration(syncDuration)}
              />
            </div>
          )}

          {syncResults.length > 0 && (
            <div className="mt-5 overflow-hidden rounded-xl border border-slate-800">
              <div className="border-b border-slate-800 bg-slate-950/70 px-4 py-3">
                <h3 className="text-sm font-semibold">
                  Chi tiết kết quả đồng bộ
                </h3>
              </div>

              <div className="divide-y divide-slate-800">
                {syncResults.map((item, index) => {
                  const successful = item.success !== false

                  return (
                    <div
                      key={`${item.target ?? item.symbol ?? 'result'}-${index}`}
                      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-200">
                          {item.target ??
                            item.symbol ??
                            `Kết quả ${index + 1}`}
                        </p>

                        {item.message && (
                          <p className="mt-1 break-words text-xs text-slate-400">
                            {item.message}
                          </p>
                        )}

                        {item.error && (
                          <p className="mt-1 break-words text-xs text-red-300">
                            {item.error}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {typeof item.inserted === 'number' && (
                          <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-300">
                            Thêm: {item.inserted}
                          </span>
                        )}

                        {typeof item.updated === 'number' && (
                          <span className="rounded-md bg-blue-500/10 px-2 py-1 text-blue-300">
                            Cập nhật: {item.updated}
                          </span>
                        )}

                        {typeof item.skipped === 'number' && (
                          <span className="rounded-md bg-slate-800 px-2 py-1 text-slate-300">
                            Bỏ qua: {item.skipped}
                          </span>
                        )}

                        <span
                          className={`rounded-md px-2 py-1 ${
                            successful
                              ? 'bg-emerald-500/10 text-emerald-300'
                              : 'bg-red-500/10 text-red-300'
                          }`}
                        >
                          {successful ? 'Thành công' : 'Thất bại'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>

        {/* MARKET AI PIPELINE */}
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2"> 
        <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
          <SectionHeading
            eyebrow="MARKET INTELLIGENCE"
            title="Phân tích AI thị trường"
            description="Gửi yêu cầu phân tích thị trường tới API nội bộ. Chỉ hiển thị trạng thái hoàn thành khi API phản hồi thành công."
          />

          <div className="mt-5 flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">
                  VNINDEX + VN30
                </h3>

                <StatusPill status={marketPipelineStatus} />
              </div>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Chạy quy trình phân tích thị trường thông qua
                endpoint <code>/api/ai/run</code>.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void runMarketPipeline()}
              disabled={isAnyPipelineRunning}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {marketPipelineStatus === 'running'
                ? 'Đang phân tích...'
                : '▶ Chạy phân tích thị trường'}
            </button>
          </div>

          {marketPipelineMessage && (
            <StatusBanner
              status={marketPipelineStatus}
              title={getPipelineStatusLabel(
                marketPipelineStatus,
              )}
              message={marketPipelineMessage}
            />
          )}

          {marketPipelineError && (
            <ErrorPanel
              title="Phân tích thị trường thất bại"
              message={marketPipelineError}
            />
          )}

          {(marketStartedAt || marketFinishedAt) && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricCard
                label="Bắt đầu"
                value={formatDateTime(marketStartedAt)}
              />

              <MetricCard
                label="Kết thúc"
                value={formatDateTime(marketFinishedAt)}
              />

              <MetricCard
                label="Thời gian xử lý"
                value={formatDuration(marketDuration)}
              />
            </div>
          )}

          {marketResponse && (
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <h3 className="text-sm font-semibold">
                Phản hồi API
              </h3>

              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3 text-xs leading-5 text-slate-300">
                {JSON.stringify(marketResponse, null, 2)}
              </pre>
            </div>
          )}
        </section>

        {/* STOCK AI PIPELINE */}

        <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <SectionHeading
              eyebrow="STOCK AI PIPELINE"
              title="Tiến trình AI cổ phiếu"
              description="Theo dõi lần lượt từng bước: tạo tín hiệu, huấn luyện mô hình và dự đoán các mã cổ phiếu."
            />

            <StatusPill status={stockPipelineStatus} />
          </div>

          <div className="mt-6 space-y-3">
            {stockSteps.map((step, index) => (
              <PipelineStepCard
                key={step.id}
                index={index + 1}
                step={step}
              />
            ))}
          </div>

          {stockPipelineMessage && (
            <StatusBanner
              status={stockPipelineStatus}
              title={getPipelineStatusLabel(
                stockPipelineStatus,
              )}
              message={stockPipelineMessage}
            />
          )}

          {stockPipelineError && (
            <ErrorPanel
              title="Tiến trình AI bị dừng"
              message={stockPipelineError}
            />
          )}

          {(stockPipelineStartedAt ||
            stockPipelineFinishedAt) && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricCard
                label="Bắt đầu"
                value={formatDateTime(
                  stockPipelineStartedAt,
                )}
              />

              <MetricCard
                label="Kết thúc"
                value={formatDateTime(
                  stockPipelineFinishedAt,
                )}
              />

              <MetricCard
                label="Tổng thời gian"
                value={formatDuration(
                  stockPipelineDuration,
                )}
              />
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl text-xs leading-5 text-slate-500">
              <p>
                Các bước chạy tuần tự. Nếu một bước thất bại,
                tiến trình sẽ dừng để tránh tiếp tục các bước
                phụ thuộc vào kết quả chưa hoàn chỉnh.
              </p>
              <p className="mt-1">
                Hãy kiểm tra API backend và quyền ghi Supabase
                nếu gặp lỗi lưu tín hiệu.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void runStockPipeline()}
              disabled={isAnyPipelineRunning}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {stockPipelineStatus === 'running' ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
                  Đang chạy tiến trình...
                </>
              ) : (
                <>▶ Chạy toàn bộ tiến trình AI</>
              )}
            </button>
          </div>
        </section>

      </div>
     
      {/* MAINTENANCE */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
          <SectionHeading
            eyebrow="MAINTENANCE"
            title="Quản trị và bảo trì"
            description="Truy cập các khu vực quản lý dữ liệu và kiểm tra hệ thống."
          />

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <QuickLink
              href="/settings/ai-cleanup"
              title="Dọn dẹp dữ liệu"
              description="Mở công cụ quản lý và dọn dẹp dữ liệu."
              icon="⌫"
            />

            <QuickLink
              href="/footprint"
              title="Footprint / Order Flow"
              description="Theo dõi hoạt động giao dịch theo mức giá."
              icon="⇅"
            />
          </div>
        </section>

        {/* FOOTER */}

        <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-600">
          LHP-FI · AI Control Center
          <span className="mx-2">·</span>
          Dữ liệu và trạng thái xử lý được hiển thị theo phản
          hồi từ API.
        </footer>
      </div>
    </main>
  )
}

/* =========================================================
   REUSABLE UI COMPONENTS
========================================================= */

function SectionHeading({
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
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-400">
        {eyebrow}
      </p>

      <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-100">
        {title}
      </h2>

      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
        {description}
      </p>
    </div>
  )
}

function QuickLink({
  href,
  title,
  description,
  icon,
}: {
  href: string
  title: string
  description: string
  icon: string
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-slate-800 bg-slate-900/70 p-4 transition hover:border-cyan-500/40 hover:bg-slate-900"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-lg text-cyan-300 transition group-hover:border-cyan-500/40 group-hover:bg-cyan-500/10">
          {icon}
        </div>

        <div className="min-w-0">
          <h3 className="font-semibold text-slate-200 transition group-hover:text-cyan-300">
            {title}
          </h3>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            {description}
          </p>
        </div>
      </div>
    </Link>
  )
}

function TabButton({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean
  onClick: () => void
  title: string
  subtitle: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl border p-4 text-left transition ${
        active
          ? 'border-cyan-500/40 bg-cyan-500/10'
          : 'border-transparent bg-slate-950/40 hover:border-slate-700 hover:bg-slate-950/70'
      }`}
    >
      <h3
        className={`font-semibold ${
          active ? 'text-cyan-300' : 'text-slate-200'
        }`}
      >
        {title}
      </h3>

      <p className="mt-1 text-xs leading-5 text-slate-500">
        {subtitle}
      </p>
    </button>
  )
}

function TargetCard({
  title,
  description,
  selected,
  onClick,
}: {
  title: string
  description: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-xl border p-4 text-left transition ${
        selected
          ? 'border-cyan-500/50 bg-cyan-500/10'
          : 'border-slate-800 bg-slate-950/40 hover:border-slate-600'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3
          className={`font-semibold ${
            selected ? 'text-cyan-300' : 'text-slate-200'
          }`}
        >
          {title}
        </h3>

        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs ${
            selected
              ? 'border-cyan-400 bg-cyan-400 text-slate-950'
              : 'border-slate-600 text-transparent'
          }`}
        >
          ✓
        </span>
      </div>

      <p className="mt-2 text-xs leading-5 text-slate-400">
        {description}
      </p>
    </button>
  )
}

function MetricCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <p className="text-xs text-slate-500">{label}</p>

      <p className="mt-2 break-words text-sm font-semibold text-slate-200">
        {value}
      </p>
    </div>
  )
}

function StatusPill({
  status,
}: {
  status: PipelineStatus
}) {
  const classes: Record<PipelineStatus, string> = {
    idle: 'border-slate-700 bg-slate-800 text-slate-400',
    running:
      'border-blue-500/30 bg-blue-500/10 text-blue-300',
    success:
      'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    error:
      'border-red-500/30 bg-red-500/10 text-red-300',
  }

  const dotClasses: Record<PipelineStatus, string> = {
    idle: 'bg-slate-500',
    running: 'animate-pulse bg-blue-400',
    success: 'bg-emerald-400',
    error: 'bg-red-400',
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${classes[status]}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${dotClasses[status]}`}
      />
      {getPipelineStatusLabel(status)}
    </span>
  )
}

function StatusBanner({
  status,
  title,
  message,
}: {
  status: PipelineStatus
  title: string
  message: string
}) {
  const classes: Record<PipelineStatus, string> = {
    idle: 'border-slate-700 bg-slate-800/40',
    running: 'border-blue-500/30 bg-blue-500/5',
    success: 'border-emerald-500/30 bg-emerald-500/5',
    error: 'border-red-500/30 bg-red-500/5',
  }

  return (
    <div
      className={`mt-4 rounded-xl border p-4 ${classes[status]}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <StatusPill status={status} />

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-200">
            {title}
          </h3>

          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-400">
            {message}
          </p>
        </div>
      </div>
    </div>
  )
}

function ErrorPanel({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
      <h3 className="text-sm font-semibold text-red-300">
        {title}
      </h3>

      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-red-200/80">
        {message}
      </p>
    </div>
  )
}

function PipelineStepCard({
  index,
  step,
}: {
  index: number
  step: PipelineStep
}) {
  const statusClasses: Record<StepStatus, string> = {
    pending: 'border-slate-700 bg-slate-800 text-slate-400',
    running:
      'border-blue-500/40 bg-blue-500/10 text-blue-300',
    success:
      'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    error:
      'border-red-500/40 bg-red-500/10 text-red-300',
  }

  const indexClasses: Record<StepStatus, string> = {
    pending: 'bg-slate-800 text-slate-400',
    running: 'bg-blue-500/20 text-blue-300',
    success: 'bg-emerald-500/20 text-emerald-300',
    error: 'bg-red-500/20 text-red-300',
  }

  return (
    <div
      className={`rounded-xl border p-4 transition ${
        step.status === 'running'
          ? 'border-blue-500/40 bg-blue-500/5'
          : step.status === 'success'
            ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
            : step.status === 'error'
              ? 'border-red-500/30 bg-red-500/[0.03]'
              : 'border-slate-800 bg-slate-950/40'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${indexClasses[step.status]}`}
        >
          {step.status === 'success'
            ? '✓'
            : step.status === 'error'
              ? '!'
              : index}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-semibold text-slate-200">
              {step.title}
            </h3>

            <span
              className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClasses[step.status]}`}
            >
              {getStepStatusLabel(step.status)}
            </span>
          </div>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            {step.description}
          </p>

          {step.message && (
            <p
              className={`mt-2 whitespace-pre-wrap break-words text-xs leading-5 ${
                step.status === 'error'
                  ? 'text-red-300'
                  : step.status === 'success'
                    ? 'text-emerald-300'
                    : 'text-slate-500'
              }`}
            >
              {step.message}
            </p>
          )}

          {(step.startedAt || step.finishedAt) && (
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-500">
              {step.startedAt && (
                <span>
                  Bắt đầu: {formatDateTime(step.startedAt)}
                </span>
              )}

              {step.finishedAt && (
                <span>
                  Kết thúc: {formatDateTime(step.finishedAt)}
                </span>
              )}

              {typeof step.durationSeconds === 'number' && (
                <span>
                  Thời gian:{' '}
                  {formatDuration(step.durationSeconds)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}