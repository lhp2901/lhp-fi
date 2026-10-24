
'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import AvatarUploader from '@/components/AvatarUploader'

type MenuGroup = 'analysis' | 'finance' | null

export default function Sidebar() {
  const [open, setOpen] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [openGroup, setOpenGroup] = useState<MenuGroup>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const router = useRouter()
  const pathname = usePathname()

  // ==========================================
  // XÁC THỰC SUPABASE
  // ==========================================

  useEffect(() => {
    let mounted = true

    const getSessionAndProfile = async () => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession()

        if (!mounted) return

        setSession(currentSession)

        if (currentSession?.user) {
          const { data: profile, error } = await supabase
            .from('users')
            .select('is_active')
            .eq('id', currentSession.user.id)
            .maybeSingle()

          if (!mounted) return

          if (error) {
            console.error(
              'Không thể kiểm tra trạng thái tài khoản:',
              error.message
            )
          }

          setIsActive(profile?.is_active === true)
        } else {
          setIsActive(false)
        }
      } catch (error) {
        console.error('Lỗi kiểm tra phiên đăng nhập:', error)

        if (mounted) {
          setSession(null)
          setIsActive(false)
        }
      } finally {
        if (mounted) {
          setCheckingAuth(false)
        }
      }
    }

    void getSessionAndProfile()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return

      setSession(newSession)

      if (!newSession) {
        setIsActive(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // ==========================================
  // TỰ ĐỘNG MỞ MENU THEO TRANG ĐANG TRUY CẬP
  // ==========================================

  useEffect(() => {
    if (
      pathname.startsWith('/analysis') ||
      pathname.startsWith('/footprint')
    ) {
      setOpenGroup('analysis')
    } else if (
      pathname.startsWith('/portfolio') ||
      pathname.startsWith('/savings')
    ) {
      setOpenGroup('finance')
    }
  }, [pathname])

  // ==========================================
  // ĐIỀU HƯỚNG
  // ==========================================

  const navigateTo = (path: string) => {
    setOpenGroup(null)
    router.push(path)
  }

  const toggleGroup = (group: Exclude<MenuGroup, null>) => {
    if (!open) {
      setOpen(true)
      setOpenGroup(group)
      return
    }

    setOpenGroup((current) => (current === group ? null : group))
  }

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Đăng xuất thất bại:', error.message)
      return
    }

    setSession(null)
    setIsActive(false)

    router.replace('/login')
    router.refresh()
  }

  // ==========================================
  // KIỂM TRA TRẠNG THÁI MENU
  // ==========================================

  const isActiveRoute = (path: string) => {
    if (path === '/') {
      return pathname === '/'
    }

    return pathname === path || pathname.startsWith(`${path}/`)
  }

  const analysisActive =
    pathname.startsWith('/analysis') ||
    pathname.startsWith('/footprint')

  const financeActive =
    pathname.startsWith('/portfolio') ||
    pathname.startsWith('/savings')

  // ==========================================
  // STYLE DÙNG CHUNG
  // ==========================================

  const itemClass = (active: boolean) =>
    `flex w-full items-center gap-3 rounded-lg px-3 py-2.5
     text-left text-sm font-medium transition-colors duration-200
     ${
       active
         ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/30'
         : 'text-slate-300 hover:bg-slate-800 hover:text-white'
     }`

  const subItemClass = (active: boolean) =>
    `flex w-full items-center gap-3 rounded-lg px-3 py-2
     text-left text-sm transition-colors duration-200
     ${
       active
         ? 'bg-indigo-500/15 text-indigo-300'
         : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
     }`

  // ==========================================
  // CHỜ KIỂM TRA PHIÊN ĐĂNG NHẬP
  // ==========================================

  if (checkingAuth || !session) {
    return null
  }

  // ==========================================
  // SIDEBAR
  // ==========================================

  return (
    <aside
      className={`
        sticky top-0 flex min-h-screen shrink-0 flex-col
        justify-between border-r border-slate-800
        bg-slate-950 text-white
        transition-[width] duration-300
        ${open ? 'w-64 p-3' : 'w-16 p-2'}
      `}
    >
      <div className="min-w-0">

        {/* ====================================== */}
        {/* LOGO VÀ NÚT THU GỌN */}
        {/* ====================================== */}

        <div
          className={`mb-5 flex items-center ${
            open ? 'justify-between px-1' : 'justify-center'
          }`}
        >
          {open && (
            <button
              type="button"
              onClick={() => navigateTo('/')}
              className="flex min-w-0 items-center gap-2"
              title="LHP-FI Dashboard"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold shadow-lg shadow-indigo-950/40">
                L
              </span>

              <span className="min-w-0 text-left">
                <span className="block text-sm font-bold tracking-wide">
                  LHP-FI
                </span>
                <span className="block text-[10px] uppercase tracking-[0.15em] text-slate-500">
                  Financial Terminal
                </span>
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-label={open ? 'Thu gọn Sidebar' : 'Mở rộng Sidebar'}
            title={open ? 'Thu gọn Sidebar' : 'Mở rộng Sidebar'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            {open ? '◀' : '☰'}
          </button>
        </div>

        {/* ====================================== */}
        {/* AVATAR */}
        {/* ====================================== */}

        {open && (
          <div className="mb-5 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 p-2">
            <AvatarUploader session={session} />
          </div>
        )}

        {/* ====================================== */}
        {/* NHÃN MENU */}
        {/* ====================================== */}

        {open && (
          <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Không gian làm việc
          </div>
        )}

        <nav aria-label="Menu chính" className="space-y-1">

          {/* ==================================== */}
          {/* DASHBOARD */}
          {/* ==================================== */}

          <button
            type="button"
            onClick={() => navigateTo('/')}
            title={!open ? 'Dashboard' : undefined}
            aria-current={isActiveRoute('/') ? 'page' : undefined}
            className={itemClass(isActiveRoute('/'))}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center text-base">
              📊
            </span>

            {open && <span className="flex-1">Dashboard</span>}
          </button>

          {/* ==================================== */}
          {/* THỊ TRƯỜNG */}
          {/* ==================================== */}

          <button
            type="button"
            onClick={() => navigateTo('/analysis/market-analysis')}
            title={!open ? 'Thị trường' : undefined}
            aria-current={
              isActiveRoute('/analysis/market-analysis')
                ? 'page'
                : undefined
            }
            className={itemClass(
              isActiveRoute('/analysis/market-analysis')
            )}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center text-base">
              🌏
            </span>

            {open && <span className="flex-1">Thị trường</span>}
          </button>

          {/* ==================================== */}
          {/* PHÂN TÍCH */}
          {/* ==================================== */}

          <div>
            <button
              type="button"
              onClick={() => toggleGroup('analysis')}
              title={!open ? 'Phân tích' : undefined}
              aria-expanded={open && openGroup === 'analysis'}
              aria-haspopup="true"
              className={itemClass(
                analysisActive ||
                  (open && openGroup === 'analysis')
              )}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center text-base">
                📈
              </span>

              {open && (
                <>
                  <span className="flex-1">Phân tích</span>

                  <span className="text-xs text-slate-400">
                    {openGroup === 'analysis' ? '▾' : '›'}
                  </span>
                </>
              )}
            </button>

            {open && openGroup === 'analysis' && (
              <div className="ml-3 mt-1 space-y-1 border-l border-slate-800 pl-3">

                <button
                  type="button"
                  onClick={() => navigateTo('/analysis/stocks')}
                  aria-current={
                    isActiveRoute('/analysis/stocks')
                      ? 'page'
                      : undefined
                  }
                  className={subItemClass(
                    isActiveRoute('/analysis/stocks')
                  )}
                >
                  <span>📊</span>
                  <span>Cổ phiếu</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigateTo('/footprint')}
                  aria-current={
                    isActiveRoute('/footprint') ? 'page' : undefined
                  }
                  className={subItemClass(
                    isActiveRoute('/footprint')
                  )}
                >
                  <span>🔥</span>
                  <span>Footprint</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigateTo('/crypto')}
                  aria-current={
                    isActiveRoute('/crypto') ? 'page' : undefined
                  }
                  className={subItemClass(
                    isActiveRoute('/crypto')
                  )}
                >
                  <span>💎</span>
                  <span>Crypto</span>
                </button>

                <a
                  href="https://vn30f1m.trunghsgs.edu.vn/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={subItemClass(false)}
                >
                  <span>⚡</span>
                  <span className="flex-1">BOOKMAP VN30F1M</span>
                  <span className="text-xs text-slate-500">↗</span>
                </a>
              </div>
            )}
          </div>

          {/* ==================================== */}
          {/* TÀI CHÍNH */}
          {/* ==================================== */}

          <div>
            <button
              type="button"
              onClick={() => toggleGroup('finance')}
              title={!open ? 'Tài chính' : undefined}
              aria-expanded={open && openGroup === 'finance'}
              aria-haspopup="true"
              className={itemClass(
                financeActive ||
                  (open && openGroup === 'finance')
              )}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center text-base">
                💼
              </span>

              {open && (
                <>
                  <span className="flex-1">Tài chính</span>

                  <span className="text-xs text-slate-400">
                    {openGroup === 'finance' ? '▾' : '›'}
                  </span>
                </>
              )}
            </button>

            {open && openGroup === 'finance' && (
              <div className="ml-3 mt-1 space-y-1 border-l border-slate-800 pl-3">

                <button
                  type="button"
                  onClick={() => navigateTo('/portfolio')}
                  aria-current={
                    isActiveRoute('/portfolio') ? 'page' : undefined
                  }
                  className={subItemClass(
                    isActiveRoute('/portfolio')
                  )}
                >
                  <span>🎯</span>
                  <span>Giao dịch</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigateTo('/portfolio/savings')}
                  aria-current={
                    isActiveRoute('/portfolio/savings')
                      ? 'page'
                      : undefined
                  }
                  className={subItemClass(
                    isActiveRoute('/portfolio/savings')
                  )}
                >
                  <span>💰</span>
                  <span>Tiết kiệm</span>
                </button>
              </div>
            )}
          </div>

          {/* ==================================== */}
          {/* CÀI ĐẶT */}
          {/* ==================================== */}

          {isActive && (
            <button
              type="button"
              onClick={() => navigateTo('/settings')}
              title={!open ? 'Cài đặt' : undefined}
              aria-current={
                isActiveRoute('/settings') ? 'page' : undefined
              }
              className={itemClass(isActiveRoute('/settings'))}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center text-base">
                ⚙️
              </span>

              {open && <span className="flex-1">Cài đặt</span>}
            </button>
          )}
        </nav>
      </div>

      {/* ======================================== */}
      {/* THÔNG TIN VÀ ĐĂNG XUẤT */}
      {/* ======================================== */}

      <div className="mt-8 space-y-3">

        {open && (
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />

              <span className="text-xs font-medium text-slate-300">
                Hệ thống hoạt động
              </span>
            </div>

            <p className="mt-1 truncate text-[10px] text-slate-500">
              {session.user.email || 'Tài khoản LHP-FI'}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={handleLogout}
          title={!open ? 'Đăng xuất' : undefined}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center text-base">
            🚪
          </span>

          {open && <span>Đăng xuất</span>}
        </button>
      </div>
    </aside>
  )
}

