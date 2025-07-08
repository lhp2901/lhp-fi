'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'

const getSupabaseClient = () => import('@/lib/supabase').then(mod => mod.supabase)

export default function Sidebar() {
  const [open, setOpen] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [showAnalysisMenu, setShowAnalysisMenu] = useState(false)

  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    let supabase: any
    let unsubscribe: () => void

    const init = async () => {
      supabase = await getSupabaseClient()

      const { data } = await supabase.auth.getSession()
      setSession(data.session)

      const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession)
      })

      unsubscribe = () => listener?.subscription?.unsubscribe?.()
    }

    init()

    return () => {
      unsubscribe?.()
    }
  }, [])

  const handleLogout = async () => {
    const supabase = await getSupabaseClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (path: string) => pathname === path

  if (!session) return null

  return (
    <aside className={`transition-all duration-300 ${open ? 'w-64' : 'w-16'} bg-gray-900 p-4 min-h-screen flex flex-col justify-between`}>
      <div>
        <button onClick={() => setOpen(!open)} className="text-white mb-6">
          ☰
        </button>

        <nav className="space-y-2">
          <button
            onClick={() => router.push('/')}
            className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition ${
              isActive('/') ? 'bg-indigo-600 text-white' : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            {open ? '📊 Dashboard' : '📊'}
          </button>

          <div>
            <button
              onClick={() => setShowAnalysisMenu(!showAnalysisMenu)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition ${
                pathname.startsWith('/analysis') ? 'bg-indigo-600 text-white' : 'text-slate-200 hover:bg-white/10'
              }`}
            >
              {open ? '🧠 Phân tích' : '🧠'}
            </button>

            {open && showAnalysisMenu && (
              <div className="ml-4 mt-1 space-y-1">
                <button
                  onClick={() => router.push('/analysis/stocks')}
                  className={`block w-full text-left px-3 py-1 rounded-md text-sm ${
                    isActive('/analysis/stocks') ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  • Cổ phiếu
                </button>
                <button
                  onClick={() => router.push('/analysis/market-analysis')}
                  className={`block w-full text-left px-3 py-1 rounded-md text-sm ${
                    isActive('/analysis/market-analysis') ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  • Thị Trường
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => router.push('/settings')}
            className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition ${
              isActive('/settings') ? 'bg-indigo-600 text-white' : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            {open ? '⚙️ Cài đặt' : '⚙️'}
          </button>
        </nav>
      </div>

      <div className="mt-8">
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-2 rounded-md text-sm text-red-400 hover:bg-red-600 hover:text-white transition"
        >
          {open ? '🚪 Đăng xuất' : '🚪'}
        </button>
      </div>
    </aside>
  )
}
