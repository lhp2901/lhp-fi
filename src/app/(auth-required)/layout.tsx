'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { Session } from '@supabase/supabase-js'

// Load Sidebar sau khi render client
const Sidebar = dynamic(() => import('@/components/Sidebar'), { ssr: false })
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
        router.replace('/login')
      } else {
        setSession(data.session)
      }

      setLoading(false)
    }

    checkAuth()
  }, [router])

  if (loading) return null // 👈 Có thể thay bằng spinner loading nếu muốn

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="max-w-screen-2xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
