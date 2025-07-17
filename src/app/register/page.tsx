import { Metadata } from 'next'
import AuthForm from '@/components/AuthForm'

export const metadata: Metadata = {
  title: 'Đăng ký | LHP-Fi',
  description: 'Tạo tài khoản để bắt đầu hành trình đầu tư thông minh với AI',
}
export default function RegisterPage() {
  return (    
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white px-4">
        <AuthForm title="" buttonLabel="Đăng ký" isRegister />
      </div>
  )
}
