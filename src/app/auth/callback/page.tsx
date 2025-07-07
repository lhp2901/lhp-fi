'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function CallbackPage() {
  const router = useRouter()
  const [message, setMessage] = useState('⏳ Đang xử lý xác thực...')

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Lấy lại session sau khi xác thực
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error || !session) {
          console.error('❌ Callback error:', error?.message || 'Không có session')
          setMessage('❌ Xác thực thất bại. Vui lòng thử lại hoặc đăng nhập lại.')
          setTimeout(() => router.push('/login'), 3000)
          return
        }

        console.log('✅ Xác thực thành công:', session)
        setMessage('✅ Xác thực thành công! Đang chuyển hướng...')
        setTimeout(() => router.push('/'), 1500)
      } catch (err) {
        console.error('❌ Lỗi không xác định:', err)
        setMessage('⚠️ Có lỗi bất ngờ xảy ra. Vui lòng thử lại.')
        setTimeout(() => router.push('/login'), 3000)
      }
    }

    processCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <h2 className="text-xl font-medium animate-pulse">{message}</h2>
    </div>
  )
}
