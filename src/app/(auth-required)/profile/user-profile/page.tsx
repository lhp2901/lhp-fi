'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

export default function UserProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (error || !session?.user) {
        console.error('Chưa đăng nhập hoặc lỗi session:', error)
        setLoading(false)
        return
      }

      const currentUser = session.user
      setUser(currentUser)

      const { data, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', currentUser.id)
        .single()

      if (profileError) {
        console.error('Lỗi khi tải profile:', profileError)
      } else {
        setForm(data)
      }

      setLoading(false)
    }

    init()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleUpdate = async () => {
    if (!user) return
    setUpdating(true)
    const { error } = await supabase.from('users').update(form).eq('id', user.id)

    if (error) alert('❌ Cập nhật lỗi!')
    else alert('✅ Cập nhật thành công!')

    setUpdating(false)
  }

  if (loading) return <div className="p-6 text-white">Đang tải thông tin...</div>
  if (!user) return <div className="p-6 text-white">Bạn chưa đăng nhập.</div>

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="bg-[#0f172a] text-white shadow-xl rounded-2xl p-8">
        <h1 className="text-3xl font-bold mb-6">Thông tin cá nhân</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input label="Họ và tên" name="full_name" value={form.full_name} onChange={handleChange} />
          <Input label="Biệt danh" name="nickname" value={form.nickname} onChange={handleChange} />
          <Input label="Ngày sinh" name="birth_date" value={form.birth_date} onChange={handleChange} />
          <Input label="Địa chỉ" name="address" value={form.address} onChange={handleChange} />
          <Input label="Số điện thoại" name="phone_number" value={form.phone_number} onChange={handleChange} />
          <Input label="CCCD" name="id_number" value={form.id_number} onChange={handleChange} />
          <Input label="Ngày cấp CCCD" name="id_issue_date" value={form.id_issue_date} onChange={handleChange} />
          <Input label="Facebook" name="facebook_url" value={form.facebook_url} onChange={handleChange} />
          <Input label="TikTok" name="tiktok_url" value={form.tiktok_url} onChange={handleChange} />
          <Input label="Website cá nhân" name="website_url" value={form.website_url} onChange={handleChange} />
        </div>

        <div className="mt-6">
          <label className="block mb-2 font-semibold">Tiểu sử</label>
          <textarea
            name="bio"
            value={form.bio || ''}
            onChange={handleChange}
            className="w-full bg-slate-700 text-white border-none px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            rows={4}
            placeholder="Viết vài dòng về bản thân..."
          />
        </div>

        <div className="text-right mt-6">
          <Button
            onClick={handleUpdate}
            disabled={updating}
            className="bg-teal-500 hover:bg-teal-600 text-white font-bold px-6 py-2 rounded-lg"
          >
            {updating ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Input({ label, name, value, onChange }: any) {
  return (
    <div className="flex flex-col">
      <label className="mb-1 font-semibold">{label}</label>
      <input
        type="text"
        name={name}
        value={value || ''}
        onChange={onChange}
        className="bg-slate-700 text-white border-none px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
    </div>
  )
}
