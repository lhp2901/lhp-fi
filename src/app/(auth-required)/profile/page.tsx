'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?name=User'

export default function ProfilePage() {
  const [avatar, setAvatar] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [editingBio, setEditingBio] = useState(false)
  const [facebook, setFacebook] = useState('')
  const [tiktok, setTiktok] = useState('')
  const [website, setWebsite] = useState('')
  const [session, setSession] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const fetchData = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData.session
      setSession(session)

      if (!session) return

      const { data, error } = await supabase
        .from('users')
        .select('nickname, bio, facebook_url, tiktok_url, website_url, avatar')
        .eq('id', session.user.id)
        .single()

      if (error) {
        console.error('Lỗi khi lấy dữ liệu người dùng:', error.message)
        return
      }

      setFullName(data.nickname || '')
      setBio(data.bio || '')
      setFacebook(data.facebook_url || '')
      setTiktok(data.tiktok_url || '')
      setWebsite(data.website_url || '')
      setAvatar(data.avatar || null)
    }

    fetchData()
  }, [])

  const handleEdit = async (
    label: string,
    key: 'nickname' | 'bio' | 'facebook_url' | 'tiktok_url' | 'website_url',
    current: string,
    setValue: (val: string) => void
  ) => {
    const input = prompt(`Nhập ${label} mới:`, current)
    if (input !== null && session?.user) {
      const value = input.trim()
      const { error } = await supabase
        .from('users')
        .update({ [key]: value })
        .eq('id', session.user.id)

      if (!error) {
        setValue(value)
      } else {
        alert('❌ Cập nhật thất bại: ' + error.message)
      }
    }
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !session?.user) return

    const filePath = `${session.user.id}/avatar.${file.name.split('.').pop()}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true })

    if (uploadError) return alert('❌ Upload thất bại: ' + uploadError.message)

    const publicUrl = supabase.storage.from('avatars').getPublicUrl(filePath).data.publicUrl

    const { error: updateError } = await supabase
      .from('users')
      .update({ avatar: filePath })
      .eq('id', session.user.id)

    if (updateError) {
      alert('❌ Không thể cập nhật ảnh đại diện: ' + updateError.message)
    } else {
      setAvatar(filePath)
    }
  }

  const avatarUrl = avatar?.startsWith('http')
    ? avatar
    : supabase.storage.from('avatars').getPublicUrl(avatar || '').data.publicUrl || DEFAULT_AVATAR

  return (
    <div className="max-w-2xl mx-auto p-4 text-white">
      <div className="flex flex-col items-center">
        <label className="cursor-pointer relative w-28 h-28 mb-4">
          <Image
            src={avatarUrl}
            alt="Avatar"
            fill
            className="rounded-full object-cover border-2 border-white"
          />
          <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </label>

        <button
          onClick={() => handleEdit('Họ tên', 'nickname', fullName, setFullName)}
          className="text-lg font-semibold mb-2 hover:underline"
        >
          {fullName || 'Chưa có tên'}
        </button>

        <p className="text-sm text-center text-gray-400 mb-4">
          Tâm sáng – Chí bền – Tài nguyên mở rộng<br />Kinh doanh & đầu tư | Chia sẻ tài chính
        </p>

        <div className="flex gap-4 mb-6">
          <button onClick={() => handleEdit('Facebook', 'facebook_url', facebook, setFacebook)} title="Thêm/sửa Facebook">📘</button>
          <button onClick={() => handleEdit('TikTok', 'tiktok_url', tiktok, setTiktok)} title="Thêm/sửa TikTok">🎵</button>
          <button onClick={() => handleEdit('Website', 'website_url', website, setWebsite)} title="Thêm/sửa Website">🌐</button>
        </div>

        <div className="w-full bg-gray-800 p-4 rounded-xl">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-semibold text-lg">🌿 Về tôi</h2>
            <button
              onClick={async () => {
                if (editingBio && session?.user) {
                  const { error } = await supabase
                    .from('users')
                    .update({ bio })
                    .eq('id', session.user.id)
                  if (error) alert('❌ Lưu mô tả thất bại: ' + error.message)
                }
                setEditingBio(!editingBio)
              }}
              className="text-sm text-purple-300"
            >
              {editingBio ? '💾 Lưu' : '✏️ Sửa'}
            </button>
          </div>
          {editingBio ? (
            <textarea
              className="w-full p-2 rounded bg-gray-700 text-white"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          ) : (
            <p className="text-sm whitespace-pre-line">{bio || 'Chưa có mô tả cá nhân...'}</p>
          )}
        </div>

        <button
          className="mt-8 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-white"
          onClick={() => router.push('profile/user-profile')}
        >
          👉 Xem thông tin cá nhân
        </button>
      </div>
    </div>
  )
}
