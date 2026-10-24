'use client'

import { useState } from 'react'
import AISignalHistoryChart from './AISignalHistoryChart'
import AISignalTable from './AISignalTable'
import AISignalTrendChart from './AISignalTrendChart'
import IndicatorChartsPage from './IndicatorChart'
import SignalCategoryStats from './SignalCategoryStats'

const TABS = [
{ id: 'signal-overview', label: 'Tổng quan tín hiệu', icon: '🧩' },
{ id: 'signal-history', label: 'Lịch sử', icon: '📉' },
{ id: 'technical-indicators', label: 'Chỉ báo kỹ thuật', icon: '📊' },
{ id: 'signal-trends', label: 'Xu hướng', icon: '📈' },
{ id: 'signal-data', label: 'Dữ liệu tín hiệu', icon: '📋' },
] as const

type TabId = (typeof TABS)[number]['id']

function TabContent({ activeTab }: { activeTab: TabId }) {
switch (activeTab) {
case 'signal-overview':
return <SignalCategoryStats />
case 'signal-history':
return <AISignalHistoryChart />
case 'technical-indicators':
return <IndicatorChartsPage />
case 'signal-trends':
return <AISignalTrendChart />
case 'signal-data':
return ( <div className="min-w-0 overflow-x-auto"> <AISignalTable /> </div>
)
default:
return null
}
}

export default function DashboardContent() {
const [activeTab, setActiveTab] = useState<TabId>('signal-overview')

return ( <main className="mx-auto w-full max-w-[1920px] space-y-5 pb-8 text-slate-100">
{/* HEADER */} <header className="relative isolate overflow-hidden rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-slate-950 via-slate-900 to-[#082b3c] shadow-2xl"> <div
       aria-hidden="true"
       className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-cyan-400/[0.08] blur-3xl"
     />


    <div className="relative p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1.5 text-xs font-bold text-emerald-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            LHP-FI Market Intelligence
          </span>

          <h1 className="text-2xl font-extrabold text-white sm:text-3xl lg:text-4xl">
            AI Market Dashboard
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
            Trung tâm phân tích thị trường, tín hiệu AI, chỉ báo kỹ thuật
            và xu hướng giao dịch.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-black/20 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-400/[0.08] text-2xl">
            📊
          </div>
          <div>
            <p className="text-sm font-bold text-white">LHP-FI Analytics</p>
            <p className="mt-1 text-xs text-slate-400">
              Intelligent Market Insights
            </p>
          </div>
        </div>
      </div>

      <div className="my-6 h-px bg-gradient-to-r from-cyan-400/20 via-white/[0.08] to-transparent" />

      {/* NAVIGATION */}
      <nav
        aria-label="Điều hướng dashboard"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={active}
              className={[
                'flex min-h-[58px] min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400',
                active
                  ? 'border-cyan-400/40 bg-cyan-400/10 shadow-lg shadow-cyan-950/20'
                  : 'border-white/[0.07] bg-white/[0.025] hover:border-cyan-400/25 hover:bg-white/[0.05]',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg',
                  active
                    ? 'bg-cyan-400/15 text-cyan-300'
                    : 'bg-white/[0.04] text-slate-400',
                ].join(' ')}
              >
                {tab.icon}
              </span>

              <span
                className={[
                  'min-w-0 flex-1 text-sm font-bold',
                  active ? 'text-cyan-300' : 'text-slate-300',
                ].join(' ')}
              >
                {tab.label}
              </span>

              <span
                className={[
                  'h-2 w-2 shrink-0 rounded-full',
                  active ? 'bg-cyan-400' : 'bg-slate-700',
                ].join(' ')}
              />
            </button>
          )
        })}
      </nav>
    </div>
  </header>

  {/* CONTENT: NO DUPLICATE TITLE */}
  <section
    key={activeTab}
    className="min-w-0 animate-[fadeIn_0.2s_ease-out] rounded-2xl border border-white/[0.08] bg-slate-900/70 p-4 shadow-xl sm:p-5 lg:p-6"
  >
    <TabContent activeTab={activeTab} />
  </section>

  {/* DISCLAIMER */}
  <footer className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.035] p-4 sm:p-5">
    <h2 className="text-sm font-bold text-amber-300">
      ⚠️ Lưu ý về quyết định đầu tư
    </h2>
    <p className="mt-2 text-xs leading-6 text-slate-400 sm:text-sm">
      Tín hiệu AI và chỉ báo kỹ thuật chỉ mang tính tham khảo, không bảo
      đảm lợi nhuận. Hãy kết hợp phân tích thị trường, quản trị vốn và
      kiểm soát rủi ro trước khi giao dịch.
    </p>
  </footer>

  {/* FOOTER */}
  <div className="flex flex-col justify-between gap-2 border-t border-white/[0.06] pt-4 text-xs text-slate-500 sm:flex-row">
    <p>
      <span className="font-semibold text-slate-400">LHP-FI</span>
      {' '}· Market Intelligence & Analytics
    </p>
    <p>AI-assisted analysis · Risk-aware investing</p>
  </div>

  <style jsx>{`
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(5px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `}</style>
</main>

)
}
