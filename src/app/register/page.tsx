import { Metadata } from 'next'
import Image from 'next/image'
import AuthForm from '@/components/AuthForm'

export const metadata: Metadata = {
  title: 'Đăng ký | LHP-Fi',
  description: 'Tạo tài khoản để bắt đầu hành trình đầu tư thông minh với AI',
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#0F172A] text-white">
      
      {/* LEFT IMAGE */}
      <div className="relative w-full md:w-1/2 h-80 md:h-auto">
        <Image
          src="/login-bg.jpg" // 👉 có thể thay ảnh khác nếu muốn phân biệt với login
          alt="Register Background"
          fill
          className="object-cover"
          priority
        />
        {/* Overlay nhẹ để phần phải nổi hơn */}
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* RIGHT REGISTER PANEL */}
      <div className="w-full md:w-1/2 flex items-center justify-center px-6 md:px-10 py-12">
        <div className="w-full max-w-md bg-gradient-to-br from-[#1e293b] to-[#334155] p-8 md:p-10 rounded-2xl shadow-2xl border border-white/10">
          <h1 className="text-4xl font-extrabold text-center mb-6 text-white tracking-wide">📝 Đăng ký tài khoản</h1>
          <AuthForm title="" buttonLabel="Đăng ký" isRegister />
          <p className="text-sm text-center text-slate-300 mt-4">
            Đã có tài khoản?{' '}
            <a href="/login" className="text-sky-400 hover:underline font-medium">
              Đăng nhập ngay
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
