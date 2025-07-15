'use client'

import AISignalPanel from './AISignalPanel'
import AISignalHistoryChart from './AISignalHistoryChart'
import AISignalTable from './AISignalTable'
import AIAccuracyChart from './AIAccuracyChart'

export default function DashboardContent() {
  return (
    <div className="space-y-10">
      <h1 className="text-2xl md:text-3xl font-bold tracking-wide text-teal-300">📊 AI Market Dashboard</h1>

      {/* 🧠 Tín hiệu hôm nay */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AISignalPanel indexCode="VNINDEX" />
        <AISignalPanel indexCode="VN30" />
      </div>

      {/* 📉 Biểu đồ so sánh chia đôi */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 🎯 Accuracy */}
        <div className="bg-white/10 p-4 rounded-xl border border-white/20 shadow space-y-4">
          <h2 className="text-lg font-semibold">🎯 Độ chính xác AI</h2>
          <AIAccuracyChart />
        </div>

        {/* 📉 History */}
        <div className="bg-white/10 p-4 rounded-xl border border-white/20 shadow space-y-4">
          <h2 className="text-lg font-semibold">📉 Lịch sử tín hiệu</h2>
          <AISignalHistoryChart />
        </div>
      </div>

      {/* 📋 Bảng chi tiết */}
      <div className="bg-white/10 p-4 rounded-xl border border-white/20 shadow space-y-4">
        <h2 className="text-xl font-semibold">📋 Bảng phân tích tín hiệu chi tiết</h2>
        <AISignalTable />
      </div>
    </div>
  )
}
