import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value
          },
        },
      }
    )

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const { pathname } = req.nextUrl

    const isAuthPage =
      pathname.startsWith('/login') ||
      pathname.startsWith('/register') ||
      pathname.startsWith('/auth/callback')

    const isPublicAsset =
      pathname.startsWith('/_next') ||
      pathname.endsWith('.ico') ||
      pathname.endsWith('.png') ||
      pathname.endsWith('.svg') ||
      pathname.includes('/logo') ||
      pathname.startsWith('/api')

    // 🔐 Nếu chưa đăng nhập mà cố vào page cần bảo vệ => redirect
    if (!session && !isAuthPage && !isPublicAsset) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // ✅ Nếu đã đăng nhập mà vào trang login/register => đẩy về dashboard
    if (session && isAuthPage) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    return NextResponse.next()
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.next() // fallback an toàn
  }
}

// ✅ Áp dụng middleware cho tất cả route ngoại trừ file tĩnh & auth routes
export const config = {
  matcher: ['/((?!_next/static|favicon.ico|logo|api|auth/callback|login|register).*)'],
}
