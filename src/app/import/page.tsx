'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

type StockEntry = {
  date: string
  open: number
  close: number
  high: number
  low: number
  volume: number
  value: number
  foreign_buy_value: number
  foreign_sell_value: number
  note: string
  proprietary_buy_value: number
  proprietary_sell_value: number
}

export default function ImportExcelPage() {
  const [entries, setEntries] = useState<StockEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data)
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet)

    const formatted: StockEntry[] = jsonData.map((row: any) => ({
      date: new Date(row.date).toISOString().split('T')[0], // yyyy-mm-dd
      open: Number(row.open),
      close: Number(row.close),
      high: Number(row.high),
      low: Number(row.low),
      volume: Number(row.volume),
      value: Number(row.value),
      foreign_buy_value: Number(row.foreignBuyValue),
      foreign_sell_value: Number(row.foreignSellValue),
      note: row.note || '',
      proprietary_buy_value: Number(row.proprietaryBuyValue),
      proprietary_sell_value: Number(row.proprietarySellValue),
    }))

    setEntries(formatted)
  }

  const importToSupabase = async () => {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    if (!userId) {
      setMessage('Bạn chưa đăng nhập!')
      setLoading(false)
      return
    }

    const withUserId = entries.map(entry => ({
      ...entry,
      user_id: userId,
    }))

    const { error } = await supabase.from('stock_entries').insert(withUserId)

    if (error) {
      setMessage('❌ Lỗi import: ' + error.message)
    } else {
      setMessage('✅ Import thành công!')
      setEntries([])
    }

    setLoading(false)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">📥 Import dữ liệu Excel vào Supabase</h1>

      <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="mb-4" />

      {entries.length > 0 && (
        <>
          <p className="mb-2">📄 Đã đọc {entries.length} dòng từ file</p>
          <button
            onClick={importToSupabase}
            disabled={loading}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
          >
            {loading ? 'Đang import...' : 'Import vào Supabase'}
          </button>
        </>
      )}

      {message && <p className="mt-4 text-sm">{message}</p>}
    </div>
  )
}
