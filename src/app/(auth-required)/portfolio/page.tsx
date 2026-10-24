'use client'

import {
useCallback,
useEffect,
useState,
type ReactNode,
} from 'react'

import { createBrowserClient } from '@supabase/ssr'

import AddTransactionForm from '@/components/portfolio/AddTransactionForm'
import TransactionList from '@/components/portfolio/TransactionList'
import DashboardReport from '@/components/portfolio/DashboardReport'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

type Tab = 'overview' | 'transactions' | 'reports'

/**

* Kiểu dữ liệu chuẩn sử dụng bên trong ứng dụng.
* Các trường số đã được chuẩn hóa thành number.
  */
  type PortfolioTransaction = {
  id: string
  user_id: string
  assetname: string
  category: string | null
  quantity: number
  buyprice: number
  currentprice: number | null
  buydate: string | null
  transactionfee: number | null
  sellprice: number | null
  sellfee: number | null
  issold: boolean
  }

/**

* Kiểu dữ liệu thô nhận được từ Supabase.
  */
  type PortfolioRow = {
  id: string | number
  user_id: string
  assetname: string | null
  category: string | null
  quantity: number | string | null
  buyprice: number | string | null
  currentprice: number | string | null
  buydate: string | null
  transactionfee: number | string | null
  sellprice: number | string | null
  sellfee: number | string | null
  issold: boolean | null
  }

function toNumber(value: unknown): number {
if (value === null || value === undefined || value === '') {
return 0
}

const result = Number(value)

return Number.isFinite(result) ? result : 0
}

function formatMoney(value: number): string {
return new Intl.NumberFormat('vi-VN', {
maximumFractionDigits: 2,
}).format(value)
}

/**

* Chuẩn hóa dữ liệu trước khi đưa vào state.
  */
  function normalizePortfolioRow(
  item: PortfolioRow,
  ): PortfolioTransaction {
  return {
  id: String(item.id),
  user_id: String(item.user_id),
  assetname: String(item.assetname ?? ''),
  category: item.category == null ? null : String(item.category),
  quantity: toNumber(item.quantity),
  buyprice: toNumber(item.buyprice),
  currentprice:
  item.currentprice == null
  ? null
  : toNumber(item.currentprice),
  buydate: item.buydate == null ? null : String(item.buydate),
  transactionfee:
  item.transactionfee == null
  ? null
  : toNumber(item.transactionfee),
  sellprice:
  item.sellprice == null ? null : toNumber(item.sellprice),
  sellfee:
  item.sellfee == null ? null : toNumber(item.sellfee),
  issold: item.issold === true,
  }
  }

export default function PortfolioPage() {
const [transactions, setTransactions] = useState<
PortfolioTransaction[]

> ([])

const [activeTab, setActiveTab] = useState<Tab>('overview')
const [showAddForm, setShowAddForm] = useState(false)
const [loading, setLoading] = useState(true)
const [error, setError] = useState('')
const [refreshKey, setRefreshKey] = useState(0)

/**

* Tạo Supabase client trong trình duyệt.
*
* Không sử dụng một client được tạo ở phạm vi module,
* tránh việc khởi tạo khi biến môi trường chưa sẵn sàng.
  */
  const loadTransactions = useCallback(async () => {
  if (!supabaseUrl || !supabaseAnonKey) {
  setError(
  'Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY trong file .env.local.',
  )
  setLoading(false)
  return
  }

setLoading(true)

setError('')

try {
  const supabase = createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
  )

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    throw authError
  }

  if (!user) {
    setTransactions([])
    setError('Vui lòng đăng nhập để xem danh mục đầu tư.')
    return
  }

  /*
   * Chỉ lấy các trường cần thiết.
   *
   * Lưu ý: truy vấn này sử dụng cấu trúc bảng
   * portfolio_transactions mà code hiện tại yêu cầu.
   */
  const { data, error: queryError } = await supabase
    .from('portfolio_transactions')
    .select(
      'id,user_id,assetname,category,quantity,buyprice,currentprice,buydate,transactionfee,sellprice,sellfee,issold',
    )
    .eq('user_id', user.id)
    .order('buydate', { ascending: false })

  if (queryError) {
    throw queryError
  }

  /*
   * Kiểm tra kiểu dữ liệu trả về ở ranh giới Supabase.
   *
   * Chỉ chuyển sang kiểu dữ liệu thô sau khi đã kiểm tra
   * cấu trúc từng bản ghi. Không ép kiểu trực tiếp cả mảng.
   */
  const rows: PortfolioTransaction[] = []

  for (const value of data ?? []) {
    if (
      typeof value !== 'object' ||
      value === null ||
      !('id' in value) ||
      !('user_id' in value) ||
      !('assetname' in value) ||
      !('quantity' in value) ||
      !('buyprice' in value)
    ) {
      throw new Error(
        'Dữ liệu portfolio_transactions không đúng cấu trúc mong đợi. Hãy kiểm tra schema Supabase.',
      )
    }

    const item = value as unknown as PortfolioRow

    rows.push(normalizePortfolioRow(item))
  }

  setTransactions(rows)
} catch (err: unknown) {
  console.error('Lỗi tải danh mục đầu tư:', err)

  setError(
    err instanceof Error
      ? err.message
      : 'Không thể tải dữ liệu danh mục đầu tư.',
  )
} finally {
  setLoading(false)
}


}, [])

/**

* Tải lại danh mục sau khi thêm, sửa hoặc xóa giao dịch.
  */
  const handleRefresh = useCallback(async () => {
  await loadTransactions()
  setRefreshKey((previous) => previous + 1)
  }, [loadTransactions])

useEffect(() => {
void loadTransactions()
}, [loadTransactions])

const holdingTransactions = transactions.filter(
(transaction) => !transaction.issold,
)

const soldTransactions = transactions.filter(
(transaction) => transaction.issold,
)

const marketValue = holdingTransactions.reduce(
(sum, transaction) =>
sum +
transaction.quantity *
(transaction.currentprice ?? transaction.buyprice),
0,
)

const unrealizedPnL = holdingTransactions.reduce(
(sum, transaction) => {
const profit =
transaction.quantity *
((transaction.currentprice ?? transaction.buyprice) -
transaction.buyprice)


  return sum + profit - (transaction.transactionfee ?? 0)
},
0,


)

const recentTransactions = transactions.slice(0, 5)

return ( <main className="min-h-screen space-y-6 bg-zinc-950 p-4 text-white md:p-6"> <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"> <div> <p className="text-sm font-medium tracking-wide text-emerald-500">
 </p>


      <h1 className="mt-2 text-3xl font-bold">
        📈 Danh mục đầu tư
      </h1>

      <p className="mt-2 text-sm text-zinc-400">
        Quản lý giao dịch, theo dõi tài sản và phân tích hiệu quả đầu tư.
      </p>
    </div>

    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={() => void handleRefresh()}
        disabled={loading}
        className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium hover:bg-zinc-800 disabled:opacity-50"
      >
        ↻ Làm mới
      </button>

      <button
        type="button"
        onClick={() => setShowAddForm((previous) => !previous)}
        className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold hover:bg-emerald-500"
      >
        {showAddForm ? 'Đóng biểu mẫu' : '+ Thêm giao dịch'}
      </button>
    </div>
  </header>

  {error && (
    <div
      role="alert"
      className="break-words rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-300"
    >
      {error}

      <button
        type="button"
        onClick={() => void handleRefresh()}
        className="ml-3 font-semibold underline"
      >
        Thử lại
      </button>
    </div>
  )}

  {showAddForm && (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <AddTransactionForm
        onSaved={async () => {
          setShowAddForm(false)
          await handleRefresh()
        }}
      />
    </section>
  )}

  <nav className="flex flex-wrap gap-2 border-b border-zinc-800 pb-4">
    <TabButton
      active={activeTab === 'overview'}
      onClick={() => setActiveTab('overview')}
    >
      📊 Tổng quan
    </TabButton>

    <TabButton
      active={activeTab === 'transactions'}
      onClick={() => setActiveTab('transactions')}
    >
      📋 Giao dịch ({transactions.length})
    </TabButton>

    <TabButton
      active={activeTab === 'reports'}
      onClick={() => setActiveTab('reports')}
    >
      📈 Báo cáo
    </TabButton>
  </nav>

  {loading && (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-zinc-400">
      Đang tải dữ liệu danh mục...
    </div>
  )}

  {!loading && activeTab === 'overview' && (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <OverviewCard
          title="Tổng giao dịch"
          value={String(transactions.length)}
          description="Tổng số bản ghi trong danh mục"
          valueClass="text-white"
        />

        <OverviewCard
          title="Đang nắm giữ"
          value={String(holdingTransactions.length)}
          description="Giao dịch chưa đánh dấu đã bán"
          valueClass="text-emerald-500"
        />

        <OverviewCard
          title="Đã bán"
          value={String(soldTransactions.length)}
          description="Giao dịch đã đánh dấu hoàn tất"
          valueClass="text-sky-500"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <OverviewCard
          title="Giá trị thị trường"
          value={`${formatMoney(marketValue)} đ`}
          description="Khối lượng × giá hiện tại"
          valueClass="text-purple-400"
        />

        <OverviewCard
          title="Lãi/lỗ chưa thực hiện"
          value={`${unrealizedPnL > 0 ? '+' : ''}${formatMoney(unrealizedPnL)} đ`}
          description="Ước tính theo giá hiện tại và phí mua đã lưu"
          valueClass={
            unrealizedPnL >= 0
              ? 'text-emerald-500'
              : 'text-red-500'
          }
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 p-5">
          <div>
            <h2 className="text-lg font-bold">
              📋 Giao dịch gần đây
            </h2>

            <p className="mt-1 text-sm text-zinc-400">
              Tối đa 5 giao dịch mới nhất.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800"
          >
            Xem tất cả →
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">
            Chưa có giao dịch nào.
            <br />
            Hãy nhấn “Thêm giao dịch” để bắt đầu.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-zinc-950/70 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Tài sản</th>
                  <th className="px-4 py-3">Ngày mua</th>
                  <th className="px-4 py-3 text-right">Khối lượng</th>
                  <th className="px-4 py-3 text-right">Giá mua</th>
                  <th className="px-4 py-3 text-right">Giá hiện tại</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-800">
                {recentTransactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="hover:bg-zinc-800/40"
                  >
                    <td className="px-4 py-4">
                      <div className="font-semibold">
                        {transaction.assetname}
                      </div>

                      <div className="mt-1 text-xs text-zinc-500">
                        {transaction.category || 'Chưa phân loại'}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-zinc-400">
                      {transaction.buydate
                        ? new Date(
                            `${transaction.buydate.slice(0, 10)}T00:00:00`,
                          ).toLocaleDateString('vi-VN')
                        : '—'}
                    </td>

                    <td className="px-4 py-4 text-right">
                      {transaction.quantity.toLocaleString('vi-VN')}
                    </td>

                    <td className="px-4 py-4 text-right">
                      {formatMoney(transaction.buyprice)}
                    </td>

                    <td className="px-4 py-4 text-right">
                      {formatMoney(
                        transaction.issold
                          ? (transaction.sellprice ?? 0)
                          : (transaction.currentprice ??
                              transaction.buyprice),
                      )}
                    </td>

                    <td className="px-4 py-4 text-center">
                      {transaction.issold ? (
                        <span className="rounded-full bg-sky-500/10 px-2.5 py-1 text-xs text-sky-400">
                          Đã bán
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-400">
                          Đang giữ
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )}

  {!loading && activeTab === 'transactions' && (
    <TransactionList
      key={`transactions-${refreshKey}`}
      onChanged={handleRefresh}
    />
  )}

  {!loading && activeTab === 'reports' && (
    <DashboardReport key={`report-${refreshKey}`} />
  )}
</main>


)
}

function TabButton({
active,
onClick,
children,
}: {
active: boolean
onClick: () => void
children: ReactNode
}) {
return (
<button
type="button"
onClick={onClick}
className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
        active
          ? 'bg-emerald-600 text-white ring-2 ring-purple-500'
          : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
      }`}
>
{children} </button>
)
}

function OverviewCard({
title,
value,
description,
valueClass,
}: {
title: string
value: string
description: string
valueClass: string
}) {
return ( <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5"> <p className="text-sm text-zinc-400">{title}</p>


  <p className={`mt-3 break-words text-2xl font-bold ${valueClass}`}>
    {value}
  </p>

  <p className="mt-2 text-xs text-zinc-500">
    {description}
  </p>
</div>


)
}
