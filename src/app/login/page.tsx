import { Metadata } from 'next'
import AuthForm from '@/components/AuthForm'

export const metadata: Metadata = {
  title: 'Đăng nhập | LHP-Fi',
  description: 'Nền tảng đầu tư AI cho nhà đầu tư thông minh',
}
export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white px-4">
      <AuthForm title="" buttonLabel="Đăng nhập" />
    </div>
  )
}
