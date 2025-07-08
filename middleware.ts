import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PROTECTED_PATHS = ['/dashboard', '/ai_signals', '/analysis', '/settings']
const AUTH_PAGES = ['/login', '/register', '/auth/callback']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Kiểm tra xem route có cần auth hay không
  const isProtected = PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )

  // Các trang auth không cần redirect nếu đã đăng nhập
  const isAuthPage = AUTH_PAGES.some((path) => pathname.startsWith(path))

  // Loại trừ các tài nguyên tĩnh, API, favicon, logo khỏi middleware
  const isPublicAsset =
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/logo') ||
    pathname.startsWith('/api')

  if (!isProtected && !isAuthPage) {
    // Nếu không phải trang bảo vệ hoặc auth page, cho qua luôn
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

    // Nếu chưa login mà truy cập trang bảo vệ, redirect về login
    if (!session && isProtected) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // Nếu đã login mà truy cập trang login/register thì redirect về trang chính
    if (session && isAuthPage) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    // Các trường hợp còn lại cho phép truy cập
    return NextResponse.next()
  } catch (error) {
    console.error('[Middleware Error]', error)
    // Trường hợp lỗi middleware vẫn cho tiếp tục request để tránh chết trang
    return NextResponse.next()
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
