'use client'

import CryptoWatchlistPage from '@/components/crypto/watched-symbols'

export default function CryptoSettingPage() {
  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">⚙️ Quản lý Coin Theo Dõi</h1>
      <CryptoWatchlistPage />
    </main>
  )
}
