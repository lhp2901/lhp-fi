// app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LHP-Fi',
  description: 'Quản lý tài chính cá nhân và đầu tư thông minh',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="bg-gradient-to-br from-[#0F172A] to-[#1E293B]">
      <body className={`${inter.className} text-white min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
