import { Metadata } from 'next'
import AuthForm from '@/components/AuthForm'

export const metadata: Metadata = {
  title: 'Đăng ký | LHP-Fi',
  description: 'Tạo tài khoản để bắt đầu quản lý tài chính cá nhân và đầu tư thông minh',
}

export default function RegisterPage() {
  return (
    <AuthForm
      title="Tạo tài khoản mới"
      buttonLabel="Đăng ký"
      isRegister
    />
  )
}
