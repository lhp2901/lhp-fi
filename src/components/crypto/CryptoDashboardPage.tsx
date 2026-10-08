'use client'

import PredictionList from '@/components/crypto/PredictionList'
import ExecutedLogList from '@/components/crypto/ExecutedLogList'
import CryptoAIChart from '@/components/crypto/CryptoAIChart' 

export default function CryptoDashboardPage() {
  return (
    <main className="max-w-8xl mx-auto p-8">
      {/* <h1 className="text-4xl font-bold mb-6 text-center">⚡ AI Crypto</h1> */}

      <section className="mb-12">
        {/* <h2 className="text-2xl font-semibold mb-4">🔮 Tín hiệu AI gần nhất</h2> */}
        <PredictionList />
      </section>

      <section className="mb-12">
   
        <CryptoAIChart />
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">📊 Lệnh đã thực thi</h2>
        <ExecutedLogList />
      </section>
    </main>
  )
}