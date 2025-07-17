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
          src="/Smarty.jpg" // 👉 có thể thay ảnh khác nếu muốn phân biệt với login
          alt="Register Background"
          fill
          className="object-cover"
          priority
        />
        {/* Overlay nhẹ để phần phải nổi hơn */}
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* RIGHT REGISTER PANEL */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8">
         <div className="w-full max-w-md bg-gradient-to-br from-[#1e293b] to-[#334155] p-8 rounded-2xl shadow-xl border border-white/10">
        
          <AuthForm title="" buttonLabel="Đăng ký" isRegister />
         
        </div>
      </div>
    </div>
  )
}
