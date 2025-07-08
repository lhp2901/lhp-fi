'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { Session } from '@supabase/supabase-js'

// ⚡ Load Sidebar client-side để tránh lỗi SSR
const Sidebar = dynamic(() => import('@/components/Sidebar'), { ssr: false })
// ⚡ Tạo client Supabase khi cần
const getSupabaseClient = () => import('@/lib/supabase').then(mod => mod.supabase)

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = await getSupabaseClient()
      const { data } = await supabase.auth.getSession()

      if (!data.session) {
        router.replace('/login') // Dùng replace để không giữ lại trong lịch sử
      } else {
        setSession(data.session)
      }

      setLoading(false)
    }

    checkAuth()
  }, [router])

  if (loading) return null // 👈 có thể thay bằng spinner nếu muốn

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white">
      <Sidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
