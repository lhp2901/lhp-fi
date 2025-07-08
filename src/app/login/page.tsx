import { Metadata } from 'next'
import Image from 'next/image'
import AuthForm from '@/components/AuthForm'

export const metadata: Metadata = {
  title: 'Đăng nhập | LHP-Fi',
  description: 'Đăng nhập để quản lý dòng tiền và đầu tư thông minh',
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
      <div className="flex w-full max-w-6xl shadow-xl rounded-3xl overflow-hidden">
        {/* LEFT: Background image full height */}
        <div className="relative w-1/2 hidden md:block">
          <Image
            src="/login-bg1.jpg"
            alt="Login Background"
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* RIGHT: Login panel */}
        <div className="w-full md:w-1/2 bg-[#1e293b] p-10 flex flex-col justify-center space-y-6">
          <h1 className="text-3xl font-bold text-white text-center">Chào mừng trở lại!</h1>
          <AuthForm title="" buttonLabel="Đăng nhập" />
        </div>
      </div>
    </div>
  )
}
