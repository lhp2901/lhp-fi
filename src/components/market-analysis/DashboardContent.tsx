'use client'

import AISignalHistoryChart from './AISignalHistoryChart'
import AISignalTable from './AISignalTable'
import AISignalTrendChart from './AISignalTrendChart'
import IndicatorChartsPage from './IndicatorChart'
import SignalCategoryStats from './SignalCategoryStats'

export default function DashboardContent() {
  return (
    <div className="space-y-10">
      <h1 className="text-2xl md:text-3xl font-bold tracking-wide text-teal-300">
        📊 AI Market Dashboard
      </h1>

      {/* 🧩 Tổng hợp phân loại - FULL WIDTH */}
      <div className="bg-white/10 p-4 rounded-xl border border-white/20 shadow space-y-4">
        <h2 className="text-lg font-semibold">🧩 Tổng hợp chỉ báo phân loại</h2>
        <SignalCategoryStats />
      </div>

      {/* 📉 Lịch sử tín hiệu + 📊 Chỉ báo kỹ thuật - CHIA ĐÔI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 📉 History */}
        <div className="bg-white/10 p-4 rounded-xl border border-white/20 shadow space-y-4">
          <h2 className="text-lg font-semibold">📉 Lịch sử tín hiệu</h2>
          <AISignalHistoryChart />
        </div>

        {/* 📊 Biểu đồ kỹ thuật */}
        <div className="bg-white/10 p-4 rounded-xl border border-white/20 shadow space-y-4">
          <h2 className="text-lg font-semibold">📊 Tổng hợp 5 chỉ báo kỹ thuật (RSI, Spike, Momentum...)</h2>
          <IndicatorChartsPage />
        </div>
      </div>

      {/* 🌈 Biểu đồ xu hướng chi tiết */}
      <div className="bg-white/10 p-4 rounded-xl border border-white/20 shadow space-y-4">
        <h2 className="text-xl font-semibold">📈 Biểu đồ xu hướng tín hiệu chi tiết (30 ngày)</h2>
        <AISignalTrendChart />
      </div>

      {/* 📋 Bảng phân tích chi tiết */}
      <div className="bg-white/10 p-4 rounded-xl border border-white/20 shadow space-y-4">
        <h2 className="text-xl font-semibold">📋 Bảng phân tích tín hiệu chi tiết</h2>
        <AISignalTable />
      </div>
    </div>
  )
}
