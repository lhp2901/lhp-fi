'use client'

import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { StockRow } from '@/types/types'

// ... các kiểu dữ liệu giữ nguyên như bạn gửi
export default function ImportStocks() {
  const [entries, setEntries] = useState<StockRow[]>([])
  const [symbol, setSymbol] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<ImportLog[]>([])
  const [availableSymbols, setAvailableSymbols] = useState<string[]>([])

  const parseNumber = (val: any): number | undefined => {
    if (typeof val === 'string') {
      const cleaned = val.replace(/,/g, '').replace(/[()%]/g, '').trim()
      const num = parseFloat(cleaned.split(' ')[0])
      return isNaN(num) ? undefined : num
    }
    if (typeof val === 'number') return val
    return undefined
  }

  const parseDate = (val: any): string | undefined => {
    const pad = (n: number) => n.toString().padStart(2, '0')
    if (typeof val === 'number') {
      const d = new Date(Math.round((val - 25569) * 86400 * 1000))
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    }
    if (val instanceof Date && !isNaN(val.getTime())) {
      return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())}`
    }
    if (typeof val === 'string') {
      const match = val.match(/^([0-9]{2})[\/-]([0-9]{2})[\/-]([0-9]{4})$/)
      if (match) {
        const [_, day, month, year] = match
        return `${year}-${month}-${day}`
      }
      const d = new Date(val)
      return isNaN(d.getTime()) ? undefined : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    }
    return undefined
  }

  const mergeBySymbolDate = (sources: StockRow[][]): StockRow[] => {
    const map = new Map<string, StockRow>()
    for (const source of sources) {
      for (const row of source) {
        if (!row.date || !row.symbol) continue
        const key = `${row.symbol}-${row.date}`
        const existing = map.get(key) || { symbol: row.symbol, date: row.date }
        map.set(key, { ...existing, ...row })
      }
    }
    return Array.from(map.values())
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer)
    const sheets = workbook.SheetNames
    setAvailableSymbols(sheets.filter((s) => !['KHOINGOAI', 'TUDOANH'].includes(s)))

    const allMergedEntries: StockRow[] = []

    for (const sheetName of sheets) {
      if (['KHOINGOAI', 'TUDOANH'].includes(sheetName)) continue
      const mainSheet = workbook.Sheets[sheetName]
      const rawMain = XLSX.utils.sheet_to_json(mainSheet, { header: 1 }) as any[][]

      const mainData: StockRow[] = rawMain.slice(2).map(row => ({
        symbol: sheetName,
        date: parseDate(row[0]),
        close: parseNumber(row[1]),
        open: parseNumber(row[8]),
        high: parseNumber(row[9]),
        low: parseNumber(row[10]),
        volume: parseNumber(row[4]),
        asset_value: parseNumber(row[5])
      }))

      const fkSheet = workbook.Sheets['KHOINGOAI']
      const rawFK = fkSheet ? XLSX.utils.sheet_to_json(fkSheet, { header: 1 }) as any[][] : []
      const fkData: StockRow[] = rawFK.slice(2).map(row => ({
        symbol: sheetName,
        date: parseDate(row[0]),
        foreign_buy_volume: parseNumber(row[4]),
        foreign_buy_value: parseNumber(row[5]),
        foreign_sell_volume: parseNumber(row[6]),
        foreign_sell_value: parseNumber(row[7])
      }))

      const merged = mergeBySymbolDate([mainData, fkData])
      allMergedEntries.push(...merged.filter(r => r.date && r.symbol))
    }

    setEntries(allMergedEntries)
    setMessage(`📄 Đã đọc được ${allMergedEntries.length} dòng từ ${availableSymbols.length} mã cổ phiếu.`)
  }

  const handleImport = async () => {
    if (!entries.length) return
    setLoading(true)

    const { data: existing } = await supabase.from('stock_entries').select('date, symbol')
    const existingKeys = new Set((existing as any[]).map((r) => `${r.symbol}-${r.date}`)) 
    const updatedCount = entries.filter(row => existingKeys.has(`${row.symbol}-${row.date}`)).length
    const oldCount = entries.filter(row => new Date(row.date) < new Date('2020-01-01')).length

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) return setMessage('❌ Không tìm thấy user.')

    const rowsWithUser = entries.map(row => ({ ...row, user_id: userId }))

    const { error } = await supabase.from('stock_entries').upsert(rowsWithUser, {
       onConflict: 'user_id,date,symbol'
    })

    if (error) {
      setMessage(`❌ Lỗi khi import: ${error.message}`)
    } else {
      await supabase.from('import_logs').insert({
        user_id: userId,
        imported_at: new Date().toISOString(),
        type: 'stock',
        total_rows: entries.length,
        updated_rows: updatedCount,
        note: oldCount > 0 ? `Có ${oldCount} dòng quá cũ (trước 2020)` : 'Import OK'
      })

      setMessage(`✅ Import thành công ${entries.length} dòng.` +
        (updatedCount > 0 ? ` 🔁 ${updatedCount} dòng được cập nhật.` : '') +
        (oldCount > 0 ? ` ⚠️ Có ${oldCount} dòng quá cũ.` : ''))

      setEntries([])
      fetchLogs()
    }

    setLoading(false)
  }

  const fetchLogs = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) return

    const { data } = await supabase
      .from('import_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'stock')
      .order('imported_at', { ascending: false })
      .limit(5)

    setLogs(data || [])
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">📥 Import dữ liệu cổ phiếu</h2>

      <label className="inline-block cursor-pointer px-4 py-2 bg-white text-black font-medium rounded shadow hover:bg-gray-200 transition">
        📂 Chọn tệp Excel
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          className="hidden"
        />
      </label>

      {availableSymbols.length > 0 && (
        <p className="text-sm text-white">📌 Đã phát hiện các mã: {availableSymbols.join(', ')}</p>
      )}

      {entries.length > 0 && (
        <div>
          <p>✅ Sẵn sàng import {entries.length} dòng dữ liệu.</p>
          <button
            onClick={handleImport}
            disabled={loading}
            className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            {loading ? 'Đang import...' : 'Import All'}
          </button>
        </div>
      )}

      {message && (
        <div className="mt-4 p-3 bg-blue-100 text-blue-800 rounded border border-blue-300 text-sm">
          {message}
        </div>
      )}

      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-2">🕓 Lịch sử import gần nhất</h3>
        {logs.length === 0 ? (
          <p>Chưa có lịch sử.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {logs.map(log => (
              <li key={log.id} className="border p-2 rounded bg-white/5 text-white">
                🗓️ {new Date(log.imported_at).toLocaleString()} – {log.total_rows} dòng ({log.updated_rows} cập nhật) – {log.note}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
