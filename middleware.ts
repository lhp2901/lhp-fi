import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PROTECTED_PATHS = ['/dashboard', '/ai_signals', '/analysis', '/settings']
const AUTH_PAGES = ['/login', '/register', '/auth/callback']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isProtected = ['/dashboard', '/ai_signals', '/analysis', '/settings'].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )

  const isAuthPage = ['/login', '/register', '/auth/callback'].some((path) =>
    pathname.startsWith(path)
  )

  const isPublicAsset =
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/logo') ||
    pathname.startsWith('/api')

  if (!isProtected && !isAuthPage) return NextResponse.next()

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

  if (!session && isProtected) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (session && isAuthPage) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  // 👇 Check quyền riêng cho trang /settings
  if (pathname.startsWith('/settings')) {
    const { data: profile, error } = await supabase
      .from('users')
      .select('is_active')
      .eq('id', session.user.id)
      .single()

    console.log('🛡️ Kiểm tra quyền user:', profile)

    if (error || !profile?.is_active) {
      return NextResponse.redirect(new URL('/403', req.url))
    }
  }

  return NextResponse.next()
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
