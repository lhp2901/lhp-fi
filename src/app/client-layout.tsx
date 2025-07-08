'use client'

import Sidebar from '@/components/Sidebar'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white">
      <Sidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
