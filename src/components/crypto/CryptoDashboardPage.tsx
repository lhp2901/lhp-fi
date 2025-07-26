'use client'

import PredictionList from '@/components/crypto/PredictionList'
import ExecutedLogList from '@/components/crypto/ExecutedLogList'

export default function CryptoDashboardPage() {
  return (
    <main className="w-full px-2 sm:px-4 md:px-6 lg:px-8 py-4">
      {/* <h1 className="text-4xl font-bold mb-6 text-center">⚡ AI Crypto</h1> */}

      <section className="mb-12">
        {/* <h2 className="text-2xl font-semibold mb-4">🔮 Tín hiệu AI gần nhất</h2> */}
        <PredictionList />
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">📊 Lệnh đã thực thi</h2>
        <ExecutedLogList />
      </section>
    </main>
  )
}
