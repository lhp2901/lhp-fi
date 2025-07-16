import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PROTECTED_PATHS = ['/dashboard', '/ai_signals', '/analysis', '/settings']
const AUTH_PAGES = ['/login', '/register', '/auth/callback']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ✅ Các loại path cơ bản
  const isProtected = PROTECTED_PATHS.some(path =>
    pathname === path || pathname.startsWith(`${path}/`)
  )
  const isAuthPage = AUTH_PAGES.some(path => pathname.startsWith(path))

  // ✅ Bỏ qua tài nguyên tĩnh & API
  const isPublicAsset =
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/logo') ||
    pathname.startsWith('/api')

  if (!isProtected && !isAuthPage && !isPublicAsset) {
    return NextResponse.next()
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value || null
          },
        },
      }
    )

    const {
      data: { session },
    } = await supabase.auth.getSession()

    // 🛡️ Nếu chưa login mà vào protected => redirect login
    if (!session && isProtected) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // 🔒 Nếu đã login mà vào trang login/register => redirect về home
    if (session && isAuthPage) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    // 🔐 Nếu vào trang /settings hoặc /settings/[id] thì check quyền
    if (pathname.startsWith('/settings')) {
      const { data: profile, error } = await supabase
        .from('users')
        .select('is_active')
        .eq('id', session?.user?.id)
        .single()

      if (error || !profile?.is_active) {
        return NextResponse.redirect(new URL('/403', req.url))
      }
    }

    return NextResponse.next()
  } catch (error) {
    console.error('[Middleware Error]', error)
    return NextResponse.next() // tránh chết app
  }
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/ai_signals/:path*',
    '/analysis/:path*',
    '/settings/:path*',
    '/login',
    '/register',
    '/auth/callback',
  ],
}
