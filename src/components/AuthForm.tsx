'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import RiveCharacter from '@/components/RiveCharacter'
import Image from 'next/image'
interface Props {
  title: string
  buttonLabel: string
  isRegister?: boolean
}

export default function AuthForm({ title, buttonLabel, isRegister }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isRegister) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}`,
              phone_number: '', // có thể thêm input nếu muốn
            },
            emailRedirectTo: 'https://lhp-fi.vercel.app/auth/callback',
          },
        })

        // 🔥 Trường hợp tài khoản đã tồn tại nhưng chưa xác nhận
        if (!signUpError && !data.user) {
          setError('Email đã được đăng ký nhưng chưa xác nhận. Vui lòng kiểm tra hộp thư.')
          setLoading(false)
          return
        }

        if (signUpError) {
          if (signUpError.code === 'user_already_exists') {
            setError('Tài khoản đã tồn tại. Vui lòng đăng nhập.')
          } else {
            setError('Đăng ký thất bại: ' + signUpError.message)
          }
          setLoading(false)
          return
        }

        setLoading(false)
        alert('Đăng ký thành công! Hãy kiểm tra email để xác nhận.')
        router.push('/login')
        router.refresh() // ⚡️ ép Next.js lấy lại session ngay lập tức
        return
      }

      // === ĐĂNG NHẬP ===
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (loginError) {
        if (loginError.message.includes('Email not confirmed')) {
          setError('Tài khoản chưa xác nhận email. Vui lòng kiểm tra hộp thư.')
        } else {
          setError('Sai email hoặc mật khẩu.')
        }
        setLoading(false)
        return
      }

      setLoading(false)
      router.push('/')
    } catch (err: any) {
      setLoading(false)
      setError(err.message || 'Có lỗi xảy ra')
    }
  }

  const handleGoogleLogin = async () => {
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/check-user', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })

      const result = await res.json()

      if (result.exists && result.provider === 'email') {
        setError('Tài khoản đã được đăng ký và xác nhận. Vui lòng đăng nhập.')
        setLoading(false)
        return
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'https://lhp-fi.vercel.app/auth/callback',
        },
      })

      if (error) throw error
    } catch (err: any) {
      setError(err.message || 'Lỗi khi đăng nhập Google')
    } finally {
      setLoading(false)
    }
  }
return (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white px-4">
   <div className="w-full max-w-md bg-black/30 backdrop-blur-md p-8 rounded-2xl shadow-xl border border-white/10">
      <h1 className="text-2xl font-bold mb-6 text-center text-purple-400">LHP-Fi</h1>

      {/* ✅ Rive Animation */}
      <div className="w-80 h-80 mx-auto mb-4">
        <RiveCharacter />
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isRegister && (
          <input
            type="text"
            placeholder="Họ và tên"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="bg-gray-800 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-gray-800 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          required
        />
        <input
          type="password"
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-gray-800 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          required
        />
        <button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-4 py-2 text-base font-semibold rounded-md hover:opacity-90 transition-all leading-[1.5rem]"
            >
              {loading ? 'Đang xử lý...' : buttonLabel}
        </button>
        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
      </form>

      <p className="text-sm text-gray-400 mt-6 text-center">
        {isRegister ? (
          <>
            Đã có tài khoản?{' '}
            <a href="/login" className="text-teal-300 hover:underline">Đăng nhập</a>
          </>
        ) : (
          <>
            Chưa có tài khoản?{' '}
            <a href="/register" className="text-teal-300 hover:underline">Đăng ký</a>
          </>
        )}
      </p>

      <div className="mt-6 flex flex-col gap-2">
      <button
          type="button"
          onClick={handleGoogleLogin}
          className="flex items-center justify-center gap-2 bg-gray-800 text-white py-2 rounded-md font-semibold hover:bg-gray-700 transition"
        >
          <Image src="/google-icon.png" alt="Google" width={20} height={20} />
          Đăng nhập bằng Google
        </button>
      </div>
    </div>
  </div>
)

}
