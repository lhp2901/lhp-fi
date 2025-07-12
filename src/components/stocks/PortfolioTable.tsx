'use client'

import React from 'react'

export interface PortfolioItem {
  symbol: string
  probability: number
  recommendation: string
  allocation: number
}

interface Props {
  loading: boolean
  date: string
  sourceDate?: string
  portfolio: PortfolioItem[]
}

const formatDateVN = (dateStr: string): string => {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('vi-VN')
}

export default function PortfolioTable({ loading, date, sourceDate, portfolio }: Props) {
  if (loading) {
    return <p className="mt-8 text-sm text-gray-300">⏳ Đang tải danh mục...</p>
  }

  const buyList = portfolio.filter((item) => item.recommendation === 'BUY')
  const displayList =
    buyList.length > 0
      ? buyList
      : portfolio
          .sort((a, b) => b.probability - a.probability)
          .slice(0, 3)
          .map((item) => ({ ...item, recommendation: 'WATCH', allocation: 0 }))

  return (
    <div className="mt-12 space-y-4">
      <h2 className="text-xl font-bold text-green-400">💼 Danh mục đầu tư AI đề xuất hôm nay</h2>

      <p className="text-sm text-gray-400">
        Ngày phân tích: {date ? formatDateVN(date) : <span className="text-red-400 italic">Không xác định</span>}
        {sourceDate && (
          <span className="ml-4 text-gray-500 italic">(dựa trên dữ liệu: {formatDateVN(sourceDate)})</span>
        )}
      </p>

      <p className="text-xs text-gray-500 italic">
        Gợi ý dựa trên xác suất thắng của mô hình AI.
        {buyList.length === 0 ? (
          <>
            {' '}Không có mã nào <span className="text-green-400 font-semibold">MUA</span>,
            hệ thống đề xuất <span className="text-blue-400 font-semibold">top 3 mã tiềm năng</span> để bạn <span className="text-blue-300">quan sát</span>.
          </>
        ) : (
          <> Chỉ hiển thị các mã có xác suất cao và được gợi ý <span className="text-green-400 font-semibold">MUA</span>.</>
        )}
      </p>

      {displayList.length === 0 ? (
        <p className="text-yellow-400">⚠️ Không có danh mục gợi ý hôm nay.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-slate-900 rounded-xl shadow-md text-sm">
            <thead className="bg-slate-800 text-gray-300 text-left">
              <tr>
                <th className="px-4 py-3">Mã</th>
                <th className="px-4 py-3 text-center">Xác suất thắng</th>
                <th className="px-4 py-3 text-center">Gợi ý</th>
                <th className="px-4 py-3 text-center">Phân bổ vốn</th>
              </tr>
            </thead>
            <tbody>
              {displayList.map((item, idx) => {
                const bgColor =
                  item.recommendation === 'BUY' ? 'bg-green-950/40' :
                  item.recommendation === 'SELL' ? 'bg-red-950/40' :
                  item.recommendation === 'HOLD' ? 'bg-yellow-950/30' :
                  item.recommendation === 'WATCH' ? 'bg-blue-950/20' : ''

                return (
                  <tr
                    key={idx}
                    className={`border-b border-slate-700 hover:bg-slate-800 transition duration-200 ${bgColor}`}
                  >
                    <td className="px-4 py-2 font-semibold text-blue-400">{item.symbol}</td>
                    <td className="px-4 py-2 text-center">
                      {(item.probability * 100).toFixed(2)}%
                    </td>
                    <td className="px-4 py-2 text-center">
                      {item.recommendation === 'BUY' && <span className="text-green-400 font-semibold">MUA</span>}
                      {item.recommendation === 'SELL' && <span className="text-red-400 font-semibold">BÁN</span>}
                      {item.recommendation === 'HOLD' && <span className="text-yellow-400 font-semibold">GIỮ</span>}
                      {item.recommendation === 'WATCH' && <span className="text-blue-400 font-semibold">QUAN SÁT</span>}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {typeof item.allocation === 'number' && item.recommendation !== 'WATCH'
                        ? `${(item.allocation * 100).toFixed(0)}%`
                        : <span className="text-gray-500 italic">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
