
'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?name=User'

type UserSession = {
  user: {
    id: string
    email?: string
  }
} | null

export default function ProfilePage() {
  const [avatar, setAvatar] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [editingBio, setEditingBio] = useState(false)

  const [facebook, setFacebook] = useState('')
  const [tiktok, setTiktok] = useState('')
  const [website, setWebsite] = useState('')

  const [session, setSession] = useState<UserSession>(null)

  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const router = useRouter()

  // =========================================================
  // LOAD USER PROFILE
  // =========================================================

  useEffect(() => {
    let mounted = true

    const fetchData = async () => {
      try {
        setLoading(true)

        // Lấy session hiện tại
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          console.error(
            'Lỗi lấy session:',
            sessionError.message
          )

          return
        }

        if (!mounted) return

        setSession(session)

        // Kiểm tra đăng nhập
        if (!session?.user) {
          setAvatar(null)
          setFullName('')
          setBio('')
          setFacebook('')
          setTiktok('')
          setWebsite('')

          return
        }

        // Lấy dữ liệu từ database
        const { data, error } = await supabase
          .from('users')
          .select(
            `
              nickname,
              bio,
              facebook_url,
              tiktok_url,
              website_url,
              avatar
            `
          )
          .eq('id', session.user.id)
          .maybeSingle()

        if (error) {
          console.error(
            'Lỗi lấy thông tin người dùng:',
            error.message
          )

          return
        }

        if (!mounted) return

        if (!data) {
          console.warn(
            'Không tìm thấy thông tin người dùng trong bảng users'
          )

          return
        }

        // Cập nhật thông tin cá nhân
        setFullName(data.nickname || '')
        setBio(data.bio || '')
        setFacebook(data.facebook_url || '')
        setTiktok(data.tiktok_url || '')
        setWebsite(data.website_url || '')

        // Lấy avatar đã lưu
        const savedAvatar =
          typeof data.avatar === 'string'
            ? data.avatar.trim()
            : null

        setAvatar(savedAvatar || null)

        console.log('Profile loaded:', {
          userId: session.user.id,
          avatar: savedAvatar,
        })
      } catch (error) {
        console.error(
          'Lỗi tải thông tin người dùng:',
          error
        )
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      mounted = false
    }
  }, [])

  // =========================================================
  // AVATAR URL
  // =========================================================

  const avatarUrl = (() => {
    if (!avatar) {
      return DEFAULT_AVATAR
    }

    // Nếu database lưu URL đầy đủ
    if (
      avatar.startsWith('http://') ||
      avatar.startsWith('https://')
    ) {
      return avatar
    }

    // Nếu database lưu đường dẫn Storage
    const {
      data: { publicUrl },
    } = supabase.storage
      .from('avatars')
      .getPublicUrl(avatar)

    return publicUrl || DEFAULT_AVATAR
  })()

  // =========================================================
  // EDIT USER INFORMATION
  // =========================================================

  const handleEdit = async (
    label: string,
    key:
      | 'nickname'
      | 'bio'
      | 'facebook_url'
      | 'tiktok_url'
      | 'website_url',
    current: string,
    setValue: (value: string) => void
  ) => {
    if (!session?.user) {
      alert('Vui lòng đăng nhập!')
      return
    }

    const input = prompt(
      `Nhập ${label} mới:`,
      current
    )

    if (input === null) return

    const value = input.trim()

    const { error } = await supabase
      .from('users')
      .update({
        [key]: value,
      })
      .eq('id', session.user.id)

    if (error) {
      console.error(
        'Lỗi cập nhật thông tin:',
        error.message
      )

      alert(
        '❌ Cập nhật thất bại: ' + error.message
      )

      return
    }

    setValue(value)
  }

  // =========================================================
  // UPLOAD AVATAR
  // =========================================================

  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]

    // Cho phép chọn lại cùng một file
    event.target.value = ''

    if (!file) return

    if (!session?.user) {
      alert('Vui lòng đăng nhập trước!')
      return
    }

    // Kiểm tra định dạng ảnh
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file hình ảnh!')
      return
    }

    // Giới hạn 5MB
    const MAX_SIZE = 5 * 1024 * 1024

    if (file.size > MAX_SIZE) {
      alert('Ảnh không được vượt quá 5MB!')
      return
    }

    try {
      setUploading(true)

      // Lấy phần mở rộng file
      const fileExt =
        file.name.split('.').pop()?.toLowerCase() || 'jpg'

      // Đường dẫn ảnh trong Storage
      const filePath =
        `${session.user.id}/avatar.${fileExt}`

      // Upload ảnh lên Supabase Storage
      const { error: uploadError } =
        await supabase.storage
          .from('avatars')
          .upload(filePath, file, {
            upsert: true,
            contentType: file.type,
            cacheControl: '3600',
          })

      if (uploadError) {
        console.error(
          'Lỗi upload ảnh:',
          uploadError.message
        )

        alert(
          '❌ Upload thất bại: ' +
            uploadError.message
        )

        return
      }

      // Cập nhật avatar trong database
      const { data: updatedUser, error: updateError } =
        await supabase
          .from('users')
          .update({
            avatar: filePath,
          })
          .eq('id', session.user.id)
          .select('avatar')
          .single()

      if (updateError) {
        console.error(
          'Lỗi cập nhật avatar:',
          updateError.message
        )

        alert(
          '❌ Không thể cập nhật ảnh đại diện: ' +
            updateError.message
        )

        return
      }

      // Cập nhật giao diện ngay lập tức
      setAvatar(updatedUser.avatar)

      alert(
        '✅ Cập nhật ảnh đại diện thành công!'
      )
    } catch (error) {
      console.error(
        'Lỗi upload avatar:',
        error
      )

      alert(
        '❌ Có lỗi xảy ra khi upload ảnh!'
      )
    } finally {
      setUploading(false)
    }
  }

  // =========================================================
  // SAVE BIO
  // =========================================================

  const handleSaveBio = async () => {
    if (!session?.user) {
      alert('Vui lòng đăng nhập!')
      return
    }

    const { error } = await supabase
      .from('users')
      .update({
        bio,
      })
      .eq('id', session.user.id)

    if (error) {
      console.error(
        'Lỗi lưu mô tả:',
        error.message
      )

      alert(
        '❌ Lưu mô tả thất bại: ' +
          error.message
      )

      return
    }

    setEditingBio(false)
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />

          <p className="text-gray-400">
            Đang tải thông tin cá nhân...
          </p>
        </div>
      </div>
    )
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-8">
      <div className="max-w-2xl mx-auto">

        {/* PROFILE HEADER */}

        <div className="flex flex-col items-center">

          {/* AVATAR */}

          <label
            className={`cursor-pointer relative w-32 h-32 mb-5 ${
              uploading
                ? 'opacity-60 pointer-events-none'
                : ''
            }`}
          >
            <Image
              src={avatarUrl}
              alt="Avatar"
              fill
              sizes="128px"
              unoptimized
              className="rounded-full object-cover border-4 border-gray-800 shadow-xl"
            />

            {/* Upload overlay */}

            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 hover:opacity-100 transition flex items-center justify-center">
              <span className="text-sm font-semibold">
                📷 Thay ảnh
              </span>
            </div>

            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={handleAvatarUpload}
            />
          </label>

          {/* UPLOAD STATUS */}

          {uploading && (
            <p className="text-sm text-indigo-400 mb-3">
              Đang tải ảnh lên...
            </p>
          )}

          {/* FULL NAME */}

          <button
            onClick={() =>
              handleEdit(
                'Họ tên',
                'nickname',
                fullName,
                setFullName
              )
            }
            className="text-2xl font-bold mb-2 hover:text-indigo-400 transition"
          >
            {fullName || 'Chưa có tên'}
          </button>

          {/* DESCRIPTION */}

          <p className="text-sm text-center text-gray-400 mb-6 leading-relaxed">
            Tâm sáng – Chí bền – Tài nguyên mở rộng
            <br />
            Kinh doanh & đầu tư | Chia sẻ tài chính
          </p>

          {/* SOCIAL LINKS */}

          <div className="flex gap-4 mb-8">

            <button
              onClick={() =>
                handleEdit(
                  'Facebook',
                  'facebook_url',
                  facebook,
                  setFacebook
                )
              }
              title="Thêm/sửa Facebook"
              className="w-11 h-11 rounded-full bg-gray-800 hover:bg-blue-600 transition flex items-center justify-center text-xl"
            >
              📘
            </button>

            <button
              onClick={() =>
                handleEdit(
                  'TikTok',
                  'tiktok_url',
                  tiktok,
                  setTiktok
                )
              }
              title="Thêm/sửa TikTok"
              className="w-11 h-11 rounded-full bg-gray-800 hover:bg-pink-600 transition flex items-center justify-center text-xl"
            >
              🎵
            </button>

            <button
              onClick={() =>
                handleEdit(
                  'Website',
                  'website_url',
                  website,
                  setWebsite
                )
              }
              title="Thêm/sửa Website"
              className="w-11 h-11 rounded-full bg-gray-800 hover:bg-indigo-600 transition flex items-center justify-center text-xl"
            >
              🌐
            </button>

          </div>

          {/* ABOUT ME */}

          <div className="w-full bg-gray-900 border border-gray-800 p-5 rounded-2xl shadow-lg">

            <div className="flex justify-between items-center mb-4">

              <h2 className="font-semibold text-lg">
                🌿 Về tôi
              </h2>

              <button
                onClick={() => {
                  if (editingBio) {
                    handleSaveBio()
                  } else {
                    setEditingBio(true)
                  }
                }}
                className="text-sm text-purple-300 hover:text-purple-200 transition"
              >
                {editingBio
                  ? '💾 Lưu'
                  : '✏️ Sửa'}
              </button>

            </div>

            {editingBio ? (
              <textarea
                className="w-full p-3 rounded-xl bg-gray-800 border border-gray-700 text-white outline-none focus:border-indigo-500 transition"
                rows={5}
                value={bio}
                onChange={(e) =>
                  setBio(e.target.value)
                }
                placeholder="Viết đôi điều về bản thân..."
              />
            ) : (
              <p className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">
                {bio ||
                  'Chưa có mô tả cá nhân...'}
              </p>
            )}

          </div>

          {/* PROFILE BUTTON */}

          <button
            className="mt-8 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-white font-semibold transition shadow-lg"
            onClick={() =>
              router.push('/profile/user-profile')
            }
          >
            👉 Xem thông tin cá nhân
          </button>

        </div>

      </div>
    </div>
  )
}

