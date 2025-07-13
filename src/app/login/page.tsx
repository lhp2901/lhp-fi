import { Metadata } from 'next'
import Image from 'next/image'
import AuthForm from '@/components/AuthForm'

export const metadata: Metadata = {
  title: 'Đăng nhập | LHP-Fi',
  description: 'Nền tảng đầu tư AI cho nhà đầu tư thông minh',
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#0F172A] text-white">
      
      {/* LEFT IMAGE */}
      <div className="relative w-full md:w-1/2 h-80 md:h-auto">
        <Image
          src="/login-bg1.jpg"
          alt="Login Background"
          fill
          className="object-cover"
          priority
        />
        {/* Overlay đen nhẹ để chữ bên phải nổi bật hơn */}
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* RIGHT LOGIN PANEL */}
      <div className="w-full md:w-1/2 flex items-center justify-center px-6 md:px-10 py-12">
        <div className="w-full max-w-md bg-gradient-to-br from-[#1e293b] to-[#334155] p-8 md:p-10 rounded-2xl shadow-2xl border border-white/10">
          <h1 className="text-4xl font-extrabold text-center mb-6 text-white tracking-wide">LHP-Fi</h1>
          <AuthForm title="" buttonLabel="Đăng nhập" />
          <p className="text-sm text-center text-slate-300 mt-4">
            Chưa có tài khoản?{' '}
            <a href="/register" className="text-sky-400 hover:underline font-medium">
              Đăng ký ngay
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
