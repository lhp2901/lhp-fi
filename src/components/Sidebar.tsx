'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Session } from '@supabase/supabase-js'
import AvatarUploader from '@/components/AvatarUploader'

export default function Sidebar() {
  const [open, setOpen] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [showAnalysisMenu, setShowAnalysisMenu] = useState(false)

  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const getSessionAndProfile = async () => {
      const { data } = await supabase.auth.getSession()
      const currentSession = data.session
      setSession(currentSession)

      if (currentSession?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('is_active')
          .eq('id', currentSession.user.id)
          .single()

        if (profile?.is_active === true) {
          setIsActive(true)
        }
      }
    }

    getSessionAndProfile()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActiveRoute = (path: string) => pathname === path

  if (!session) return null

  return (
    <aside className={`transition-all duration-300 ${open ? 'w-64' : 'w-16'} bg-gray-900 p-4 min-h-screen flex flex-col justify-between`}>
      <div>
        <button onClick={() => setOpen(!open)} className="text-white mb-6">
          ☰
        </button>

        {open && <AvatarUploader session={session} />}

        <nav className="space-y-2">
          <button
            onClick={() => router.push('/')}
            className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition ${
              isActiveRoute('/') ? 'bg-indigo-600 text-white' : 'text-slate-200 hover:bg-white/10'
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
                    isActiveRoute('/analysis/stocks') ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  • Cổ phiếu
                </button>
                <button
                  onClick={() => router.push('/analysis/market-analysis')}
                  className={`block w-full text-left px-3 py-1 rounded-md text-sm ${
                    isActiveRoute('/analysis/market-analysis') ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  • Thị Trường
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => router.push('/portfolio')}
            className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition ${
              isActiveRoute('/portfolio') ? 'bg-indigo-600 text-white' : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            {open ? '🎯 Giao dịch' : '🎯'}
          </button>

          {/* ✅ Chỉ hiện khi user đã được duyệt */}
          {isActive && (
            <button
              onClick={() => router.push('/settings')}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition ${
                pathname.startsWith('/settings') ? 'bg-indigo-600 text-white' : 'text-slate-200 hover:bg-white/10'
              }`}
            >
              {open ? '⚙️ Cài đặt' : '⚙️'}
            </button>
          )}
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
