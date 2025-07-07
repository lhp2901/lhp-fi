'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Header() {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh() // ⚡️ ép Next.js lấy lại session ngay lập tức
    
  }

  if (!user) return null

  return (
    <header className="sticky top-0 z-40 w-full h-14 bg-[#1F2937] shadow-md flex items-center justify-between px-6">
  <h1 className="text-purple-300 font-bold">🌟 LHP-Fi</h1>
  <div className="text-xs text-gray-500">v1.0.0</div>
    </header>
  )
}
