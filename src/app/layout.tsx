// src/app/layout.tsx
import './globals.css'
import Sidebar from '@/components/Sidebar'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LHP-Fi',
  description: 'Quản lý tài chính cá nhân và đầu tư thông minh',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={inter.className}>
        <div className="flex min-h-screen bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white">
          <Sidebar />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </body>
    </html>
  )
}
