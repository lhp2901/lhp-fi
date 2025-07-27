'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import Link from 'next/link'

type WatchedSymbol = {
  id: number
  symbol: string
  created_at: string
}

export default function CryptoWatchlistPage() {
  const [symbols, setSymbols] = useState<WatchedSymbol[]>([])
  const [newSymbol, setNewSymbol] = useState('')
  const [loadingList, setLoadingList] = useState(false)
  const [adding, setAdding] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [aiRunning, setAiRunning] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [aiLogs, setAiLogs] = useState<string[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  const aiLogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error) console.error('Lỗi auth:', error.message)
      setUserId(data?.user?.id || null)
    }

    fetchUser()
    fetchSymbols()
  }, [])

  useEffect(() => {
    if (aiLogs.length > 0 && aiLogRef.current) {
      aiLogRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [aiLogs])

  const fetchSymbols = async () => {
    setLoadingList(true)
    const { data, error } = await supabase
      .from('watched_symbols')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('❌ Lỗi khi tải danh sách coin!')
      console.error(error)
    } else {
      setSymbols(data || [])
    }

    setLoadingList(false)
  }

  const handleAddSymbol = async () => {
    const symbol = newSymbol.trim()

    if (!/^[A-Z0-9]+$/.test(symbol)) {
      return toast.warning('⚠️ Tên coin phải viết HOA và không chứa ký tự đặc biệt!')
    }

    const upperSymbol = symbol.toUpperCase()
    const exists = symbols.some((item) => item.symbol === upperSymbol)
    if (exists) return toast.warning('⚠️ Coin này đã có trong danh sách!')

    setAdding(true)

    const { error } = await supabase.from('watched_symbols').insert([
      {
        symbol: upperSymbol,
        user_id: userId,
      },
    ])

    if (error) {
      toast.error('❌ Lỗi khi thêm coin!')
      console.error(error)
    } else {
      toast.success(`✅ Đã thêm ${symbol}!`)
      setNewSymbol('')
      fetchSymbols()
    }

    setAdding(false)
  }

  const handleDeleteSymbol = async (id: number) => {
    const { error } = await supabase.from('watched_symbols').delete().eq('id', id)

    if (error) {
      toast.error('❌ Lỗi khi xoá coin!')
      console.error(error)
    } else {
      toast.success('🗑️ Đã xoá coin.')
      fetchSymbols()
    }
  }

  const handleFetchFromBybit = async () => {
    setFetching(true)
    setLogs([])

    try {
      const res = await fetch('/api/crypto/fetch-bybit', { method: 'POST' })
      const json = await res.json()

      if (!res.ok || json.error) {
        toast.error(`❌ ${json.message || json.error || 'Có lỗi xảy ra!'}`)
        const logText = json.message || json.error || 'Không rõ lỗi từ server.'
        setLogs([logText])
        console.error('Lỗi:', json)
      } else {
        toast.success(json.message || '✅ Đã đồng bộ thành công!')
        const rawLogs = json.logs

        if (Array.isArray(rawLogs)) {
          setLogs(rawLogs)
        } else if (typeof rawLogs === 'string') {
          setLogs(rawLogs.split('\n').map(line => line.trim()).filter(Boolean))
        } else {
          setLogs(['⚠️ Không nhận được logs hợp lệ từ server.'])
        }
      }
    } catch (err: any) {
      toast.error('❌ Lỗi khi gọi API!')
      setLogs([err.message || 'Lỗi không xác định khi gọi API.'])
      console.error('Exception:', err)
    } finally {
      setFetching(false)
    }
  }

  const handleRunDaily = async () => {
    setAiRunning(true)
    setAiLogs([])

    try {
      const res = await fetch('/api/crypto/run-daily', { method: 'POST' })
      const json = await res.json()

      const message = json.message || '✅ Đã chạy AI!'
      const stdout = json.stdout || json.logs || ''
      const stderr = json.stderr || ''

      const parseLogs = (raw: string | string[]) => {
        if (typeof raw === 'string') {
          return raw.split('\n').map(line => line.trim()).filter(Boolean)
        }
        if (Array.isArray(raw)) {
          return raw.map(line => String(line).trim()).filter(Boolean)
        }
        return ['⚠️ Không có log hợp lệ.']
      }

      if (!res.ok || json.error) {
        toast.error(`❌ ${message}`)
        setAiLogs(parseLogs(stderr || json.error))
        console.error('AI Error:', json)
      } else {
        toast.success(message)
        setAiLogs(parseLogs(stdout))
      }
    } catch (err: any) {
      toast.error('❌ Lỗi gọi API sinh tín hiệu!')
      setAiLogs([err.message || 'Lỗi không xác định.'])
      console.error('Exception:', err)
    } finally {
      setAiRunning(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto mt-12 p-8 bg-white dark:bg-slate-900 shadow-xl rounded-2xl border dark:border-slate-700">
  
      <div className="flex items-center gap-3 mb-5">
        <input
          type="text"
          placeholder="Nhập coin (VD: BTCUSDT)"
          value={newSymbol}
          onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-black dark:text-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <Button
          onClick={handleAddSymbol}
          disabled={adding}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-lg"
        >
          {adding ? 'Đang thêm...' : '➕ Thêm'}
        </Button>
      </div>

      <div className="flex justify-center gap-4 mb-4">
        <Button
          onClick={handleFetchFromBybit}
          disabled={fetching}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg"
        >
          {fetching ? 'Đang tải từ Bybit...' : '⚡ Đổ dữ liệu vào Supabase'}
        </Button>

        <Button
          onClick={handleRunDaily}
          disabled={aiRunning}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"
        >
          {aiRunning ? '⏳ Đang sinh tín hiệu AI...' : '🤖 Sinh tín hiệu AI'}
        </Button>
      </div>

      {logs.length > 0 && (
        <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-4 text-sm text-left mb-6 border border-slate-300 dark:border-slate-600 max-h-80 overflow-y-auto shadow-md transition-all duration-300">
          <p className="font-semibold text-gray-700 dark:text-gray-200 mb-2">📄 Kết quả đồng bộ:</p>
          <ul className="list-disc pl-5 space-y-1">
            {logs.map((log, index) => (
              <li key={index} className="text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
                {log}
              </li>
            ))}
          </ul>
        </div>
      )}

      {aiLogs.length > 0 && (
        <div
          ref={aiLogRef}
          className="bg-blue-50 dark:bg-blue-900 rounded-2xl p-4 text-sm text-left mb-6 border border-blue-200 dark:border-blue-700 max-h-96 overflow-y-auto shadow-lg transition-all duration-300"
        >
          <p className="font-semibold text-blue-700 dark:text-blue-200 mb-2">🧠 Logs AI:</p>
          <pre className="whitespace-pre-wrap text-blue-900 dark:text-blue-100 font-mono leading-relaxed">
            {aiLogs.join('\n')}
          </pre>
        </div>
      )}

      {loadingList && (
        <p className="text-center text-gray-500 dark:text-gray-400 mb-4">⏳ Đang tải danh sách coin...</p>
      )}

      <ul className="space-y-3">
        {symbols.map((item) => (
          <li
            key={item.id}
            className="flex justify-between items-center px-4 py-3 border border-gray-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <span className="font-semibold text-gray-800 dark:text-white">{item.symbol}</span>
            <button
              onClick={() => handleDeleteSymbol(item.id)}
              className="text-red-600 hover:underline text-sm"
            >
              ❌ Xoá
            </button>
          </li>
        ))}
      </ul>
      <div className="bg-red-900/30 border border-red-500 text-red-300 rounded p-3 text-sm mt-4">

          <Link href="/settings/ai-cleanup" className="underline text-blue-300 hover:text-blue-400">
            🔥 Quản lý xoá dữ liệu AI
          </Link> để kiểm tra hoặc xoá sạch dữ liệu lỗi.
        </div>
    </div>
    
  )
}
