'use client'

import { useRef, useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Session } from '@supabase/supabase-js'

interface AvatarUploaderProps {
  session: Session
}

export default function AvatarUploader({ session }: AvatarUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [fullName, setFullName] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('users') // ✅ bảng chuẩn
        .select('avatar, full_name')
        .eq('id', session.user.id)
        .single()

      if (error) {
        console.error('Lỗi khi lấy profile:', error.message)
        return
      }

      if (data) {
        setAvatarUrl(data.avatar || null)
        setFullName(data.full_name || '')
      }
    }

    fetchProfile()
  }, [session.user.id])

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const fileExt = file.name.split('.').pop()
    const filePath = `${session.user.id}/avatar.${fileExt}`

    setLoading(true)

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      console.error('Lỗi upload:', uploadError.message)
      alert('❌ Upload thất bại: ' + uploadError.message)
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ avatar: filePath })
      .eq('id', session.user.id)

    if (updateError) {
      console.error('Lỗi cập nhật DB:', updateError.message)
      alert('❌ Cập nhật avatar thất bại: ' + updateError.message)
    } else {
      setAvatarUrl(filePath)
    }

    setLoading(false)
  }

  // ✅ Lấy URL phù hợp từ Supabase storage hoặc fallback ngoài
  const getAvatarUrl = (
  avatar: string | null,
  fullName: string,
  email?: string
): string => {
  const fallbackName = fullName || email || 'Người dùng'
  if (!avatar) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}`
  }

  return avatar.startsWith('http')
    ? avatar
    : supabase.storage.from('avatars').getPublicUrl(avatar).data.publicUrl
}

  const publicUrl = getAvatarUrl(
  avatarUrl,
  fullName,
  session.user.email ?? '' // fallback nếu undefined
)

  return (
  <div className="flex flex-col items-center gap-2 text-white text-sm mb-6">
    <div className="relative w-20 h-20">
      <Image
        src={publicUrl}
        alt="Avatar"
        className="rounded-full cursor-pointer object-cover"
        fill
        sizes="(max-width: 768px) 80px"
        onClick={() => fileInputRef.current?.click()}
      />
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        onChange={handleAvatarChange}
      />
    </div>

    {loading ? (
      <span className="text-xs text-gray-400">Đang tải lên...</span>
    ) : (
      <Link
        href="/profile"
        className="hover:underline text-sm text-white cursor-pointer"
      >
        {fullName || session.user.email}
      </Link>
    )}
  </div>
)
}
