import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PROTECTED_PATHS = ['/dashboard', '/ai_signals', '/analysis', '/settings']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isProtected = PROTECTED_PATHS.some((path) =>
    pathname === path || pathname.startsWith(`${path}/`)
  )

  const isAuthPage = ['/login', '/register', '/auth/callback'].some((path) =>
    pathname.startsWith(path)
  )

  const isPublicAsset =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/logo') ||
    pathname.startsWith('/api')

  if (!isProtected) return NextResponse.next()

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

    if (!session && !isAuthPage && !isPublicAsset) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    if (session && isAuthPage) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    return NextResponse.next()
  } catch (err) {
    console.error('[Middleware Error]', err)
    return NextResponse.next()
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/ai_signals/:path*', '/analysis/:path*', '/settings/:path*'],
}
