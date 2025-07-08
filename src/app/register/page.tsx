import { Metadata } from 'next'
import Image from 'next/image'
import AuthForm from '@/components/AuthForm'

export const metadata: Metadata = {
  title: 'Đăng ký | LHP-Fi',
  description: 'Tạo tài khoản để bắt đầu quản lý tài chính cá nhân và đầu tư thông minh',
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
      <div className="flex w-full max-w-6xl shadow-xl rounded-3xl overflow-hidden">
        {/* LEFT: Background image full height */}
        <div className="relative w-1/2 hidden md:block">
          <Image
            src="/login-bg.jpg" // 👉 đổi ảnh riêng cho trang đăng ký, hoặc dùng lại login-bg.jpg
            alt="Register Background"
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* RIGHT: Register panel */}
        <div className="w-full md:w-1/2 bg-[#1e293b] p-10 flex flex-col justify-center space-y-6">
          <h1 className="text-3xl font-bold text-white text-center">Tạo tài khoản mới</h1>
          <AuthForm
            title=""
            buttonLabel="Đăng ký"
            isRegister
          />
        </div>
      </div>
    </div>
  )
}
