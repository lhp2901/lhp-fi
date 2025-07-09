// src/app/layout.tsx (KHÔNG có "use client")
import './globals.css'
import { Inter } from 'next/font/google'
import type { Metadata } from 'next'
import SupabaseProvider from '@/components/SupabaseProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LHP-Fi',
  description: 'Quản lý tài chính cá nhân và đầu tư thông minh',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={inter.className}>
        <SupabaseProvider>{children}</SupabaseProvider>
      </body>
    </html>
  )
}
