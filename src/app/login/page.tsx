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
          src="/Smartyregedit.jpg"
          alt="Login Background"
          fill
          className="object-cover"
          priority
        />
        {/* Overlay đen nhẹ */}
        <div className="absolute inset-0 bg-black/5"></div>
      </div>

      {/* RIGHT LOGIN PANEL */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-gradient-to-br from-[#1e293b] to-[#334155] p-8 rounded-2xl shadow-xl border border-white/10">
          <h1 className="text-3xl font-bold text-center mb-6 text-white">LHP-Fi</h1>
          <AuthForm title="" buttonLabel="Đăng nhập" />
        
        </div>
      </div>
    </div>
  )
}
