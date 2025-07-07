import { Metadata } from 'next'
import AuthForm from '@/components/AuthForm'

export const metadata: Metadata = {
  title: 'Đăng nhập | LHP-Fi',
  description: 'Đăng nhập để quản lý dòng tiền và đầu tư thông minh',
}

export default function LoginPage() {
  return (
    <AuthForm
      title="Chào mừng trở lại!"
      buttonLabel="Đăng nhập"
    />
  )
}
