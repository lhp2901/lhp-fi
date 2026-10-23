'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type JsonObject = Record<string, any>

type FootprintLevel = {
price: number
bid: number
ask: number
volume: number
delta: number
cumulativeDelta: number
}

type FootprintTrade = {
id: string
time: string
price: number
volume: number
side: string
}

type FootprintCandle = {
time: string
open: number
high: number
low: number
close: number
volume: number
}

type StreamStatus = {
connected?: boolean
running?: boolean
status?: string
message?: string
[key: string]: any
}

const API_BASE = (
  process.env.NEXT_PUBLIC_LHP_AI_SERVER_URL || 'http://127.0.0.1:10000'
).replace(/\/+$/, '')

const DEFAULT_SYMBOLS = [
'FPT',
'SSI',
'HPG',
'VCB',
'VND',
'DXG',
'GEX',
'MWG',
'CTG',
'TCB',
'MBB',
'STB',
'VIC',
'VHM',
'DGC',
'VNM',
'HSG',
'NVL',
'PDR',
'VNINDEX',
'VN30',
]

const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1H']

function asNumber(value: unknown, fallback = 0): number {
if (typeof value === 'number' && Number.isFinite(value)) return value

if (typeof value === 'string' && value.trim() !== '') {
const parsed = Number(value)
if (Number.isFinite(parsed)) return parsed
}

return fallback
}

function firstValue(obj: JsonObject, keys: string[], fallback?: unknown): unknown {
for (const key of keys) {
if (obj[key] !== undefined && obj[key] !== null) {
return obj[key]
}
}

return fallback
}

function formatNumber(value: number, decimals = 0): string {
return new Intl.NumberFormat('vi-VN', {
minimumFractionDigits: decimals,
maximumFractionDigits: decimals,
}).format(Number.isFinite(value) ? value : 0)
}

function formatPrice(value: number): string {
if (!Number.isFinite(value)) return '—'
return formatNumber(value, value % 1 === 0 ? 0 : 2)
}

function formatTime(value: unknown): string {
if (value === undefined || value === null || value === '') return '—'

const raw = String(value)

if (/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
return raw
}

const date = new Date(
typeof value === 'number' && value < 1e12 && value > 1e9
? value * 1000
: (value as string | number),
)

if (Number.isNaN(date.getTime())) return raw

return date.toLocaleTimeString('vi-VN', {
hour12: false,
hour: '2-digit',
minute: '2-digit',
second: '2-digit',
})
}

function findArray(data: any, keys: string[]): any[] {
if (Array.isArray(data)) return data

if (!data || typeof data !== 'object') return []

for (const key of keys) {
if (Array.isArray(data[key])) return data[key]
}

if (data.data && data.data !== data) {
const nested = findArray(data.data, keys)
if (nested.length) return nested
}

if (data.result && data.result !== data) {
const nested = findArray(data.result, keys)
if (nested.length) return nested
}

return []
}

function normalizeSymbols(data: any): string[] {
const rows = findArray(data, ['symbols', 'items', 'stocks', 'results'])

const values = rows
.map((item: any) => {
if (typeof item === 'string') return item

  if (item && typeof item === 'object') {
    return firstValue(item, ['symbol', 'ticker', 'code', 'stock_code'])
  }

  return undefined
})
.filter((item): item is string => typeof item === 'string')
.map((item) => item.trim().toUpperCase())
.filter(Boolean)


const combined = [...values, ...DEFAULT_SYMBOLS]

return [...new Set(combined)]
}

function normalizeLevels(data: any): FootprintLevel[] {
const rows = findArray(data, [
'levels',
'price_levels',
'footprint',
'rows',
'clusters',
])

const mapped = rows
.map((row: any) => {
if (!row || typeof row !== 'object') return null


  const price = asNumber(
    firstValue(row, ['price', 'price_level', 'p', 'level']),
    Number.NaN,
  )

  if (!Number.isFinite(price)) return null

  const bid = asNumber(
    firstValue(row, [
      'bid',
      'sell',
      'sell_volume',
      'bid_volume',
      'aggressive_sell',
      'bidVol',
    ]),
  )

  const ask = asNumber(
    firstValue(row, [
      'ask',
      'buy',
      'buy_volume',
      'ask_volume',
      'aggressive_buy',
      'askVol',
    ]),
  )

  const volume = asNumber(
    firstValue(row, ['volume', 'total_volume', 'total', 'vol']),
    bid + ask,
  )

  return {
    price,
    bid,
    ask,
    volume,
    delta: asNumber(row.delta, ask - bid),
    cumulativeDelta: asNumber(
      firstValue(row, ['cumulativeDelta', 'cumulative_delta', 'cum_delta']),
    ),
  } as FootprintLevel
})
.filter((row): row is FootprintLevel => row !== null)


mapped.sort((a, b) => b.price - a.price)

let cumulative = 0

return mapped.map((row) => {
cumulative += row.delta


return {
  ...row,
  cumulativeDelta:
    row.cumulativeDelta !== 0 ? row.cumulativeDelta : cumulative,
}


})
}

function normalizeTrades(data: any): FootprintTrade[] {
const rows = findArray(data, ['trades', 'items', 'ticks', 'results'])

return rows.slice(-100).reverse().map((row: any, index: number) => ({
id: String(row.id ?? row.trade_id ?? `${row.timestamp ?? row.time}-${index}`),
time: formatTime(
firstValue(row, ['timestamp', 'time', 'trade_time', 'created_at']),
),
price: asNumber(firstValue(row, ['price', 'trade_price', 'match_price'])),
volume: asNumber(
firstValue(row, ['volume', 'quantity', 'qty', 'trade_volume']),
),
side: String(
firstValue(row, ['side', 'aggressor_side', 'trade_side', 'direction'], 'UNKNOWN'),
).toUpperCase(),
}))
}

function normalizeCandles(data: any): FootprintCandle[] {
const rows = findArray(data, ['candles', 'ohlc', 'bars', 'items', 'results'])

return rows.slice(-60).map((row: any) => ({
time: formatTime(
firstValue(row, ['timestamp', 'time', 'start_time', 'datetime']),
),
open: asNumber(firstValue(row, ['open', 'o'])),
high: asNumber(firstValue(row, ['high', 'h'])),
low: asNumber(firstValue(row, ['low', 'l'])),
close: asNumber(firstValue(row, ['close', 'c'])),
volume: asNumber(firstValue(row, ['volume', 'vol', 'v'])),
}))
}

function normalizePayload(data: any): JsonObject {
if (!data || typeof data !== 'object') return {}
if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
return { ...data.data, ...data }
}
return data
}

function isPositiveSide(side: string): boolean {
return ['BUY', 'B', 'BUYER', 'ASK', 'AGGRESSIVE_BUY', '1'].includes(side)
}

function isNegativeSide(side: string): boolean {
return ['SELL', 'S', 'SELLER', 'BID', 'AGGRESSIVE_SELL', '-1'].includes(side)
}

function StatCard({
label,
value,
sub,
tone = 'neutral',
}: {
label: string
value: string
sub?: string
tone?: 'neutral' | 'green' | 'red' | 'blue'
}) {
const toneClass = {
neutral: 'text-white',
green: 'text-emerald-400',
red: 'text-rose-400',
blue: 'text-sky-400',
}[tone]

return ( <div className="min-w-0 rounded-xl border border-slate-800 bg-[#101722] p-3"> <div className="text-[11px] uppercase tracking-wider text-slate-500">
{label} </div>
<div className={`mt-2 truncate text-xl font-bold tabular-nums ${toneClass}`}>
{value} </div>
{sub && <div className="mt-1 truncate text-xs text-slate-500">{sub}</div>} </div>
)
}

function EmptyPanel({ children }: { children: React.ReactNode }) {
return ( <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">
{children} </div>
)
}

export default function FootprintPage() {
const [symbols, setSymbols] = useState<string[]>(DEFAULT_SYMBOLS)
const [symbol, setSymbol] = useState('FPT')
const [symbolInput, setSymbolInput] = useState('')
const [timeframe, setTimeframe] = useState('1m')

const [payload, setPayload] = useState<JsonObject>({})
const [levels, setLevels] = useState<FootprintLevel[]>([])
const [trades, setTrades] = useState<FootprintTrade[]>([])
const [candles, setCandles] = useState<FootprintCandle[]>([])
const [streamStatus, setStreamStatus] = useState<StreamStatus>({})

const [loading, setLoading] = useState(true)
const [requestError, setRequestError] = useState('')
const [actionMessage, setActionMessage] = useState('')
const [autoRefresh, setAutoRefresh] = useState(true)
const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
const [busy, setBusy] = useState(false)

const [showTrades, setShowTrades] = useState(true)
const [showVolumeProfile, setShowVolumeProfile] = useState(true)

const requestLock = useRef(false)
const mounted = useRef(true)

const api = useCallback(async (path: string, init?: RequestInit) => {
const response = await fetch(`${API_BASE}${path}`, {
...init,
headers: {
Accept: 'application/json',
...(init?.headers || {}),
},
cache: 'no-store',
})


const text = await response.text()
let body: any = {}

try {
  body = text ? JSON.parse(text) : {}
} catch {
  body = { message: text }
}

if (!response.ok) {
  throw new Error(
    body?.error || body?.message || `HTTP ${response.status}`,
  )
}

return body


}, [])

const loadSymbols = useCallback(async () => {
try {
const data = await api('/api/footprint/symbols')
if (!mounted.current) return
setSymbols(normalizeSymbols(data))
} catch {
// Vẫn giữ danh sách mã mặc định nếu API danh sách chưa sẵn sàng.
}
}, [api])

const loadAll = useCallback(
async (currentSymbol: string) => {
if (requestLock.current) return
requestLock.current = true


  try {
    const encoded = encodeURIComponent(currentSymbol)

    const results = await Promise.allSettled([
      api(`/api/footprint/${encoded}`),
      api(`/api/footprint/${encoded}/trades`),
      api(`/api/footprint/${encoded}/candles`),
      api('/api/footprint/stream/status'),
    ])

    if (!mounted.current) return

    const [bookResult, tradesResult, candlesResult, statusResult] = results

    if (bookResult.status === 'fulfilled') {
      const data = normalizePayload(bookResult.value)
      setPayload(data)
      setLevels(normalizeLevels(data))
      setRequestError('')
    } else {
      setRequestError(bookResult.reason?.message || 'Không tải được Footprint')
    }

    if (tradesResult.status === 'fulfilled') {
      setTrades(normalizeTrades(tradesResult.value))
    }

    if (candlesResult.status === 'fulfilled') {
      setCandles(normalizeCandles(candlesResult.value))
    }

    if (statusResult.status === 'fulfilled') {
      setStreamStatus(normalizePayload(statusResult.value))
    }

    setLastUpdated(new Date())
  } catch (error: any) {
    if (mounted.current) {
      setRequestError(error?.message || 'Không kết nối được backend')
    }
  } finally {
    requestLock.current = false
    if (mounted.current) setLoading(false)
  }
},
[api],


)

useEffect(() => {
mounted.current = true
void loadSymbols()


return () => {
  mounted.current = false
}


}, [loadSymbols])

useEffect(() => {
setLoading(true)
void loadAll(symbol)


if (!autoRefresh) return

const timer = window.setInterval(() => {
  void loadAll(symbol)
}, 1500)

return () => window.clearInterval(timer)


}, [symbol, autoRefresh, loadAll])

const applySymbol = (value: string) => {
const next = value.trim().toUpperCase()
if (!next) return


setSymbol(next)
setSymbolInput('')
setActionMessage('')


}

const startStream = async () => {
setBusy(true)
setActionMessage('Đang yêu cầu backend khởi động luồng dữ liệu...')


try {
  const result = await api('/api/footprint/stream/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      symbol,
      symbols: [symbol],
    }),
  })

  setActionMessage(
    result?.message || `Đã gửi yêu cầu bắt đầu stream cho ${symbol}.`,
  )

  await loadAll(symbol)
} catch (error: any) {
  setActionMessage(
    `Không khởi động được stream: ${error?.message || 'Lỗi không xác định'}`,
  )
} finally {
  setBusy(false)
}


}

const stopStream = async () => {
setBusy(true)
setActionMessage('Đang yêu cầu backend dừng luồng dữ liệu...')


try {
  const result = await api('/api/footprint/stream/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      symbol,
      symbols: [symbol],
    }),
  })

  setActionMessage(result?.message || 'Đã gửi yêu cầu dừng stream.')
  await loadAll(symbol)
} catch (error: any) {
  setActionMessage(
    `Không dừng được stream: ${error?.message || 'Lỗi không xác định'}`,
  )
} finally {
  setBusy(false)
}


}

const totalBid = useMemo(
() => levels.reduce((sum, row) => sum + row.bid, 0),
[levels],
)

const totalAsk = useMemo(
() => levels.reduce((sum, row) => sum + row.ask, 0),
[levels],
)

const totalVolume = useMemo(
() =>
levels.reduce(
(sum, row) => sum + (row.volume || row.bid + row.ask),
0,
),
[levels],
)

const totalDelta = useMemo(
() => levels.reduce((sum, row) => sum + row.delta, 0),
[levels],
)

const cumulativeDelta =
asNumber(
firstValue(payload, ['cumulative_delta', 'cumulativeDelta', 'cum_delta']),
Number.NaN,
)

const lastPrice = asNumber(
firstValue(payload, ['last_price', 'lastPrice', 'price', 'close']),
candles.length ? candles[candles.length - 1].close : 0,
)

const referencePrice = asNumber(
firstValue(payload, ['reference_price', 'referencePrice', 'ref_price']),
)

const change = asNumber(
firstValue(payload, ['change', 'price_change']),
lastPrice && referencePrice ? lastPrice - referencePrice : 0,
)

const changePercent = asNumber(
firstValue(payload, ['change_percent', 'changePercent', 'pct_change']),
referencePrice ? (change / referencePrice) * 100 : 0,
)

const maxCell = Math.max(
1,
...levels.map((row) => Math.max(row.bid, row.ask)),
)

const maxVolume = Math.max(1, ...levels.map((row) => row.volume))

const statusText = String(
firstValue(streamStatus, ['status', 'state', 'message'], 'Chưa xác định'),
)

const isConnected =
streamStatus.connected === true ||
streamStatus.running === true ||
['connected', 'running', 'active', 'started', 'online'].includes(
statusText.toLowerCase(),
)

const tradeCount = asNumber(
firstValue(streamStatus, ['trade_count', 'trades_received', 'received_count']),
trades.length,
)

const levelsHaveData = levels.length > 0

return ( <main className="min-h-screen bg-[#080d14] p-3 text-slate-100 sm:p-5"> <div className="mx-auto max-w-[1800px] space-y-4">
{/* Header */} <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-[#101722] p-4 lg:flex-row lg:items-center"> <div> <div className="flex flex-wrap items-center gap-2"> <span className="rounded-md bg-sky-500/15 px-2 py-1 text-xs font-bold text-sky-400">
LHP-FI </span> <span className="text-xs text-slate-500">
ORDER FLOW ANALYTICS </span> </div>


        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
          Footprint <span className="text-sky-400">Market</span>
        </h1>

        <p className="mt-1 text-sm text-slate-400">
          Phân tích khối lượng khớp lệnh theo từng mức giá.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#080d14] px-3 py-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isConnected ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
          <span className="text-xs font-semibold">
            {isConnected ? 'STREAM ONLINE' : 'KIỂM TRA STREAM'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => void loadAll(symbol)}
          disabled={loading}
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
        >
          ↻ Làm mới
        </button>

        <button
          type="button"
          onClick={() => setAutoRefresh((value) => !value)}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            autoRefresh
              ? 'bg-sky-500 text-slate-950'
              : 'border border-slate-700 text-slate-300'
          }`}
        >
          {autoRefresh ? '● Auto ON' : 'Auto OFF'}
        </button>
      </div>
    </header>

    {/* Symbol controls */}
    <section className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-800 bg-[#101722] p-4 md:grid-cols-2 xl:grid-cols-[minmax(200px,1.1fr)_minmax(220px,1fr)_minmax(250px,1.3fr)_auto]">
      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
          Mã cổ phiếu
        </label>

        <select
          value={symbol}
          onChange={(event) => applySymbol(event.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-[#080d14] px-3 py-3 text-base font-bold outline-none focus:border-sky-500"
        >
          {symbols.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
          {!symbols.includes(symbol) && (
            <option value={symbol}>{symbol}</option>
          )}
        </select>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          applySymbol(symbolInput)
        }}
      >
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
          Tìm mã khác
        </label>
        <div className="flex gap-2">
          <input
            value={symbolInput}
            onChange={(event) => setSymbolInput(event.target.value)}
            placeholder="Ví dụ: DXG"
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-[#080d14] px-3 py-3 uppercase outline-none focus:border-sky-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-700 px-4 text-sm font-bold hover:bg-slate-600"
          >
            Chọn
          </button>
        </div>
      </form>

      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
          Khung thời gian
        </label>
        <div className="flex flex-wrap gap-2">
          {TIMEFRAMES.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => setTimeframe(item)}
              className={`rounded-lg px-3 py-3 text-sm font-bold ${
                timeframe === item
                  ? 'bg-sky-500 text-slate-950'
                  : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-end gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void startStream()}
          className="flex-1 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          ▶ Start
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void stopStream()}
          className="flex-1 rounded-lg border border-rose-500/40 px-4 py-3 text-sm font-bold text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
        >
          ■ Stop
        </button>
      </div>
    </section>

    {actionMessage && (
      <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">
        {actionMessage}
      </div>
    )}

    {requestError && (
      <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
        <div className="font-bold">Không tải được đầy đủ dữ liệu Footprint</div>
        <div className="mt-1 break-words">{requestError}</div>
        <div className="mt-2 text-xs text-rose-200/70">
          Kiểm tra Flask, API /api/footprint và cấu trúc JSON trả về.
        </div>
      </div>
    )}

    {/* Price and market stats */}
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatCard
        label="Mã đang xem"
        value={symbol}
        sub={`Khung ${timeframe}`}
        tone="blue"
      />
      <StatCard
        label="Giá gần nhất"
        value={lastPrice ? formatPrice(lastPrice) : '—'}
        sub="Theo payload backend"
      />
      <StatCard
        label="Thay đổi"
        value={`${change > 0 ? '+' : ''}${formatPrice(change)}`}
        sub={`${changePercent > 0 ? '+' : ''}${formatNumber(changePercent, 2)}%`}
        tone={change > 0 ? 'green' : change < 0 ? 'red' : 'neutral'}
      />
      <StatCard
        label="Tổng khối lượng"
        value={formatNumber(totalVolume)}
        sub={`${levels.length} mức giá`}
      />
      <StatCard
        label="Net Delta"
        value={`${totalDelta > 0 ? '+' : ''}${formatNumber(totalDelta)}`}
        sub="Ask − Bid trong dữ liệu đang tải"
        tone={totalDelta > 0 ? 'green' : totalDelta < 0 ? 'red' : 'neutral'}
      />
      <StatCard
        label="Cumulative Delta"
        value={
          Number.isFinite(cumulativeDelta)
            ? `${cumulativeDelta > 0 ? '+' : ''}${formatNumber(cumulativeDelta)}`
            : '—'
        }
        sub="Chỉ hiện khi backend cung cấp"
        tone={
          cumulativeDelta > 0
            ? 'green'
            : cumulativeDelta < 0
              ? 'red'
              : 'neutral'
        }
      />
    </section>

    {/* Main footprint */}
    <section className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.8fr)_minmax(340px,0.8fr)]">
      <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-[#101722]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-4">
          <div>
            <h2 className="font-bold">Footprint / Bid × Ask</h2>
            <p className="mt-1 text-xs text-slate-500">
              Mỗi hàng đại diện cho một mức giá.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-2 text-emerald-400">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
              Mua chủ động / Ask
            </span>
            <span className="flex items-center gap-2 text-rose-400">
              <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
              Bán chủ động / Bid
            </span>
          </div>
        </div>

        {!levelsHaveData ? (
          <div className="p-4">
            <EmptyPanel>
              {loading
                ? 'Đang tải dữ liệu...'
                : 'Chưa có dữ liệu mức giá. Cần backend trả về levels hoặc price_levels từ Footprint Engine.'}
            </EmptyPanel>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] border-collapse text-sm tabular-nums">
              <thead className="sticky top-0 bg-[#0c121b] text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-3 text-right">Bid / Sell</th>
                  <th className="px-3 py-3 text-center">Giá</th>
                  <th className="px-3 py-3 text-left">Ask / Buy</th>
                  <th className="px-3 py-3 text-right">Delta</th>
                  <th className="px-3 py-3 text-right">Volume</th>
                </tr>
              </thead>

              <tbody>
                {levels.map((row, index) => {
                  const positive = row.delta > 0
                  const negative = row.delta < 0
                  const bidWidth = Math.max(0, (row.bid / maxCell) * 100)
                  const askWidth = Math.max(0, (row.ask / maxCell) * 100)
                  const profileWidth = Math.max(
                    0,
                    (row.volume / maxVolume) * 100,
                  )

                  return (
                    <tr
                      key={`${row.price}-${index}`}
                      className="border-t border-slate-800/80 hover:bg-white/[0.025]"
                    >
                      <td className="relative overflow-hidden px-3 py-2.5 text-right text-rose-300">
                        <div
                          className="absolute inset-y-1 right-0 rounded-l"
                          style={{
                            width: `${bidWidth}%`,
                            background: 'rgba(244,63,94,0.18)',
                          }}
                        />
                        <span className="relative font-semibold">
                          {formatNumber(row.bid)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap border-x border-slate-800 bg-[#0c121b] px-3 py-2.5 text-center font-bold text-slate-100">
                        {formatPrice(row.price)}
                      </td>

                      <td className="relative overflow-hidden px-3 py-2.5 text-left text-emerald-300">
                        <div
                          className="absolute inset-y-1 left-0 rounded-r"
                          style={{
                            width: `${askWidth}%`,
                            background: 'rgba(16,185,129,0.18)',
                          }}
                        />
                        <span className="relative font-semibold">
                          {formatNumber(row.ask)}
                        </span>
                      </td>

                      <td
                        className={`whitespace-nowrap px-3 py-2.5 text-right font-bold ${
                          positive
                            ? 'text-emerald-400'
                            : negative
                              ? 'text-rose-400'
                              : 'text-slate-400'
                        }`}
                      >
                        {row.delta > 0 ? '+' : ''}
                        {formatNumber(row.delta)}
                      </td>

                      <td className="relative overflow-hidden px-3 py-2.5 text-right text-slate-300">
                        <div
                          className="absolute inset-y-1 right-0 rounded-l bg-sky-500/15"
                          style={{ width: `${profileWidth}%` }}
                        />
                        <span className="relative">
                          {formatNumber(row.volume)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              <tfoot className="border-t border-slate-700 bg-[#0c121b] font-bold">
                <tr>
                  <td className="px-3 py-3 text-right text-rose-300">
                    {formatNumber(totalBid)}
                  </td>
                  <td className="px-3 py-3 text-center text-slate-400">
                    TỔNG
                  </td>
                  <td className="px-3 py-3 text-left text-emerald-300">
                    {formatNumber(totalAsk)}
                  </td>
                  <td
                    className={`px-3 py-3 text-right ${
                      totalDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {totalDelta > 0 ? '+' : ''}
                    {formatNumber(totalDelta)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {formatNumber(totalVolume)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="border-t border-slate-800 px-4 py-3 text-xs text-slate-500">
          Cột Bid và Ask phản ánh cách backend phân loại giao dịch. Nếu
          nguồn không có aggressor side, không thể mặc định xem đó là dữ
          liệu mua/bán chủ động chính xác.
        </div>
      </div>

      {/* Volume profile */}
      <div className="min-w-0 rounded-2xl border border-slate-800 bg-[#101722]">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
          <div>
            <h2 className="font-bold">Volume Profile</h2>
            <p className="mt-1 text-xs text-slate-500">
              Phân bố khối lượng theo mức giá
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowVolumeProfile((value) => !value)}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs"
          >
            {showVolumeProfile ? 'Ẩn' : 'Hiện'}
          </button>
        </div>

        {!showVolumeProfile ? (
          <div className="p-4">
            <EmptyPanel>Volume Profile đang được ẩn.</EmptyPanel>
          </div>
        ) : !levelsHaveData ? (
          <div className="p-4">
            <EmptyPanel>Chưa có khối lượng theo mức giá.</EmptyPanel>
          </div>
        ) : (
          <div className="space-y-1 p-4">
            {levels.slice(0, 35).map((row, index) => {
              const width = (row.volume / maxVolume) * 100

              return (
                <div
                  key={`${row.price}-${index}`}
                  className="grid grid-cols-[62px_minmax(0,1fr)_72px] items-center gap-2 text-xs"
                >
                  <span className="text-right text-slate-400">
                    {formatPrice(row.price)}
                  </span>
                  <div className="h-5 overflow-hidden rounded-sm bg-slate-800/60">
                    <div
                      className="h-full rounded-sm bg-sky-500/70"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <span className="text-right tabular-nums text-slate-300">
                    {formatNumber(row.volume)}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <div className="border-t border-slate-800 px-4 py-3 text-xs text-slate-500">
          Đây là phân bố khối lượng trong dữ liệu backend hiện trả về,
          không mặc định là toàn bộ khối lượng của phiên.
        </div>
      </div>
    </section>

    {/* Candle table */}
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#101722]">
      <div className="border-b border-slate-800 px-4 py-4">
        <h2 className="font-bold">OHLC / Nến giá</h2>
        <p className="mt-1 text-xs text-slate-500">
          Dữ liệu nến từ API backend; khung thời gian cần được hỗ trợ ở
          phía server.
        </p>
      </div>

      {candles.length === 0 ? (
        <div className="p-4">
          <EmptyPanel>
            Chưa có dữ liệu nến. Kiểm tra endpoint candles và dữ liệu OHLC
            từ DNSE.
          </EmptyPanel>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm tabular-nums">
            <thead className="bg-[#0c121b] text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3 text-right">Open</th>
                <th className="px-4 py-3 text-right">High</th>
                <th className="px-4 py-3 text-right">Low</th>
                <th className="px-4 py-3 text-right">Close</th>
                <th className="px-4 py-3 text-right">Volume</th>
              </tr>
            </thead>
            <tbody>
              {candles.slice(-20).reverse().map((candle, index) => {
                const up = candle.close >= candle.open

                return (
                  <tr
                    key={`${candle.time}-${index}`}
                    className="border-t border-slate-800/80"
                  >
                    <td className="px-4 py-3 text-slate-400">
                      {candle.time}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatPrice(candle.open)}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-300">
                      {formatPrice(candle.high)}
                    </td>
                    <td className="px-4 py-3 text-right text-rose-300">
                      {formatPrice(candle.low)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-bold ${
                        up ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatPrice(candle.close)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatNumber(candle.volume)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>

    {/* Tape and status */}
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#101722]">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
          <div>
            <h2 className="font-bold">Time & Sales</h2>
            <p className="mt-1 text-xs text-slate-500">
              Các giao dịch gần nhất do backend cung cấp
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowTrades((value) => !value)}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs"
          >
            {showTrades ? 'Ẩn' : 'Hiện'}
          </button>
        </div>

        {!showTrades ? (
          <div className="p-4">
            <EmptyPanel>Bảng giao dịch đang được ẩn.</EmptyPanel>
          </div>
        ) : trades.length === 0 ? (
          <div className="p-4">
            <EmptyPanel>Chưa có giao dịch được backend trả về.</EmptyPanel>
          </div>
        ) : (
          <div className="max-h-[430px] overflow-auto">
            <table className="w-full min-w-[460px] text-sm tabular-nums">
              <thead className="sticky top-0 bg-[#0c121b] text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3 text-right">Giá</th>
                  <th className="px-4 py-3 text-right">Khối lượng</th>
                  <th className="px-4 py-3 text-center">Side</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => {
                  const buy = isPositiveSide(trade.side)
                  const sell = isNegativeSide(trade.side)

                  return (
                    <tr
                      key={trade.id}
                      className="border-t border-slate-800/80"
                    >
                      <td className="px-4 py-3 text-slate-400">
                        {trade.time}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold ${
                          buy
                            ? 'text-emerald-400'
                            : sell
                              ? 'text-rose-400'
                              : 'text-slate-200'
                        }`}
                      >
                        {formatPrice(trade.price)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatNumber(trade.volume)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded px-2 py-1 text-[10px] font-bold ${
                            buy
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : sell
                                ? 'bg-rose-500/15 text-rose-400'
                                : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {buy ? 'BUY' : sell ? 'SELL' : 'UNKNOWN'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#101722]">
        <div className="border-b border-slate-800 px-4 py-4">
          <h2 className="font-bold">Trạng thái dữ liệu</h2>
          <p className="mt-1 text-xs text-slate-500">
            Thông tin chẩn đoán luồng dữ liệu
          </p>
        </div>

        <div className="space-y-3 p-4 text-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3">
            <span className="text-slate-400">Backend</span>
            <span className="max-w-[65%] break-all text-right text-slate-200">
              {API_BASE}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3">
            <span className="text-slate-400">Mã đang xem</span>
            <span className="font-bold text-sky-400">{symbol}</span>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3">
            <span className="text-slate-400">Stream</span>
            <span
              className={
                isConnected ? 'text-emerald-400' : 'text-amber-400'
              }
            >
              {statusText}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3">
            <span className="text-slate-400">Giao dịch nhận được</span>
            <span className="font-bold">
              {formatNumber(tradeCount)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3">
            <span className="text-slate-400">Mức giá</span>
            <span className="font-bold">{formatNumber(levels.length)}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Cập nhật giao diện</span>
            <span className="text-right text-slate-300">
              {lastUpdated
                ? lastUpdated.toLocaleTimeString('vi-VN', {
                    hour12: false,
                  })
                : '—'}
            </span>
          </div>

          <div className="rounded-lg border border-slate-700 bg-[#0c121b] p-3 text-xs leading-5 text-slate-400">
            <div className="mb-1 font-bold text-slate-300">
              Lưu ý realtime
            </div>
            Giao diện đang kiểm tra API định kỳ mỗi 1,5 giây khi Auto ON.
            Điều này không tự tạo ra dữ liệu mới. Backend phải duy trì kết
            nối DNSE và cập nhật Footprint Engine. Muốn đẩy dữ liệu ngay
            khi có tick, có thể bổ sung WebSocket từ Flask tới trình duyệt.
          </div>
        </div>
      </div>
    </section>

    {/* Raw data for diagnostics */}
    <details className="rounded-xl border border-slate-800 bg-[#101722]">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-300">
        Dữ liệu JSON từ backend (chẩn đoán)
      </summary>
      <pre className="max-h-96 overflow-auto border-t border-slate-800 p-4 text-xs leading-5 text-slate-400">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </details>

    <footer className="pb-4 text-center text-xs text-slate-600">
      LHP-FI Footprint · Dữ liệu phân tích phụ thuộc API DNSE và backend
      được cấu hình.
    </footer>
  </div>
</main>


)
}
