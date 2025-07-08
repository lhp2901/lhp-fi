'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }: {
  error: Error & { digest?: string },
  reset: () => void
}) {
  useEffect(() => {
    console.error('Lỗi xảy ra:', error)
  }, [error])

  return (
    <div className="h-screen flex flex-col items-center justify-center text-center">
      <h1 className="text-3xl font-bold text-red-600">💥 Đã xảy ra lỗi!</h1>
      <p className="text-gray-500 mt-4">Hệ thống đang gặp sự cố. Vui lòng thử lại.</p>
      <button
        onClick={() => reset()}
        className="mt-6 px-4 py-2 bg-blue-600 text-white rounded"
      >
        Thử lại
      </button>
    </div>
  )
}
