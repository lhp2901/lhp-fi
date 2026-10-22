'use client'

import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import type { StockRow, VNIndexRow, VN30Row, ImportLog } from '@/types'

export default function ImportVN30() {
  const [entries, setEntries] = useState<VN30Row[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<ImportLog[]>([])

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
      const match = val.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/)
      if (match) {
        const [_, day, month, year] = match
        return `${year}-${month}-${day}`
      }
      const d = new Date(val)
      return isNaN(d.getTime()) ? undefined : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    }
    return undefined
  }

  const mergeByDate = (sources: VN30Row[][]): VN30Row[] => {
    const map = new Map<string, VN30Row>()
    for (const source of sources) {
      for (const row of source) {
        if (!row.date) continue
        const existing = map.get(row.date) || { date: row.date }
        map.set(row.date, { ...existing, ...row })
      }
    }
    return Array.from(map.values())
  }

const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return

  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  const user_id = user?.id || ''
  if (!user_id) return setMessage('❌ Không tìm thấy user.')

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer)

  const vnSheet = workbook.Sheets['VN30']
  const rawVN = XLSX.utils.sheet_to_json(vnSheet, { header: 1 }) as any[][]
  const vnData: VN30Row[] = rawVN.slice(2).map((row) => ({
    date: parseDate(row[1]) || '',
    close: parseNumber(row[2]) || 0,
    open: parseNumber(row[9]) || 0,
    high: parseNumber(row[10]) || 0,
    low: parseNumber(row[11]) || 0,
    volume: parseNumber(row[5]) || 0,
    value: parseNumber(row[6]) || 0,
    user_id,
  }))

  const fkSheet = workbook.Sheets['KHOINGOAI']
  const rawFK = fkSheet ? XLSX.utils.sheet_to_json(fkSheet, { header: 1 }) as any[][] : []
  const fkData: VN30Row[] = rawFK.slice(2).map((row) => ({
    date: parseDate(row[1]) || '',
    foreign_buy_value: parseNumber(row[6]) || 0,
    foreign_sell_value: parseNumber(row[8]) || 0,
    user_id,
  }))

  // ── TUDOANH Sheet ───────────────────────────────
   const tdSheet = workbook.Sheets['TUDOANH']
   const rawTD = tdSheet ? XLSX.utils.sheet_to_json(tdSheet, { header: 1 }) as any[][] : []
   const tdData: VN30Row[] = rawTD
     .slice(2)
     .filter(row => row[0] === 'VN30INDEX')
     .map(row => ({
       date: parseDate(row[1]) || '',
       proprietary_buy_value: parseNumber(row[3]) || 0,
       proprietary_sell_value: parseNumber(row[5]) || 0,
       user_id,
     }))

  const merged = mergeByDate([vnData, fkData, tdData])
  const cleaned = merged.filter((r) => r.date)

  setEntries(cleaned)
  setMessage(`📄 Đã đọc được ${cleaned.length} dòng dữ liệu.`)
}

  const handleImport = async () => {
    if (!entries.length) return
    setLoading(true)

    const { data: existing } = await supabase.from('vn30_data').select('date')
    const existingDates = new Set(existing?.map((r: any) => r.date))
    const updatedCount = entries.filter(row => existingDates.has(row.date)).length
    const oldCount = entries.filter(row => new Date(row.date) < new Date('2020-01-01')).length

    const { error } = await supabase.from('vn30_data').upsert(entries, { onConflict: 'user_id,date' as any })
    if (error) {
      setMessage(`❌ Lỗi khi import: ${error.message}`)
    } else {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id
      if (userId) {
        await supabase.from('import_logs').insert({
          user_id: userId,
          imported_at: new Date().toISOString(),
          type: 'vn30',
          total_rows: entries.length,
          updated_rows: updatedCount,
          note: oldCount > 0 ? `Có ${oldCount} dòng quá cũ (trước 2020)` : 'Import OK'
        })
      }
      setMessage(
        `✅ Import thành công ${entries.length} dòng.` +
        (updatedCount > 0 ? ` 🔁 ${updatedCount} dòng được cập nhật.` : '') +
        (oldCount > 0 ? ` ⚠️ Có ${oldCount} dòng quá cũ.` : '')
      )
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
      .eq('type', 'vn30')
      .order('imported_at', { ascending: false })
      .limit(5)

    setLogs(data || [])
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">📥 Import dữ liệu VN30</h2>
      <label className="inline-block cursor-pointer px-4 py-2 bg-white text-black font-medium rounded shadow hover:bg-gray-200 transition">
      📂 Chọn tệp Excel
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileUpload}
        className="hidden"
      />
    </label>

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
                🗓️ {formatDate(log.imported_at).toLocaleString()} – {log.total_rows} dòng ({log.updated_rows} cập nhật) – {log.note}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
