'use client'

import { useState, useEffect, ChangeEvent } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Session } from '@supabase/supabase-js'
import imageCompression from 'browser-image-compression'

const getSupabaseClient = () => import('@/lib/supabase').then(mod => mod.supabase)

export default function Sidebar() {
  const [open, setOpen] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showAnalysisMenu, setShowAnalysisMenu] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    let supabaseClient: any
    let unsubscribe: () => void

    const init = async () => {
      supabaseClient = await getSupabaseClient()

      const { data } = await supabaseClient.auth.getSession()
      setSession(data.session)
      setIsLoading(false)

      if (data.session?.user) {
        await loadAvatar(data.session.user.id)
      }

      const { data: listener } = supabaseClient.auth.onAuthStateChange(
        async (_event: string, newSession: Session | null) => {
          setSession(newSession)
          if (newSession?.user) {
            await loadAvatar(newSession.user.id)
          } else {
            setAvatarUrl(null)
          }
          router.refresh()
        }
      )

      unsubscribe = () => listener.subscription?.unsubscribe?.()
    }

    init()

    return () => {
      unsubscribe?.()
    }
  }, [router])

  // Load avatar từ Supabase Storage
  const loadAvatar = async (userId: string) => {
    const supabaseClient = await getSupabaseClient()
    const { data, error } = await supabaseClient.storage
      .from('avatars')
      .list(`${userId}`, { limit: 1 })

    if (error) {
      console.error('Error loading avatar:', error.message)
      setAvatarUrl(null)
      return
    }

    if (data.length > 0) {
      const fileName = data[0].name
      const { data: urlData } = supabaseClient.storage
        .from('avatars')
        .getPublicUrl(`${userId}/${fileName}`)

      setAvatarUrl(urlData.publicUrl)
    } else {
      setAvatarUrl(null)
    }
  }

  // Upload avatar (resize trước upload)
  const uploadAvatar = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!session?.user || !e.target.files || e.target.files.length === 0) return

    setUploading(true)
    let file = e.target.files[0]

    try {
      const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 500,
        useWebWorker: true,
      }
      file = await imageCompression(file, options)
    } catch (err) {
      console.warn('Resize failed, upload ảnh gốc', err)
    }

    const supabaseClient = await getSupabaseClient()
    const fileExt = file.name.split('.').pop()
    const fileName = `avatar.${fileExt}`
    const filePath = `${session.user.id}/${fileName}`

    // Xóa file cũ
    await supabaseClient.storage.from('avatars').remove([filePath])

    const { error } = await supabaseClient.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '86400',
        upsert: true,
        contentType: file.type,
      })

    if (error) {
      alert('Upload avatar thất bại: ' + error.message)
    } else {
      const { data: urlData } = supabaseClient.storage
        .from('avatars')
        .getPublicUrl(filePath)
      setAvatarUrl(urlData.publicUrl)
    }

    setUploading(false)
  }

  const handleLogout = async () => {
    const supabaseClient = await getSupabaseClient()
    await supabaseClient.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (path: string) => pathname === path

  if (isLoading) return null
  if (!session) return null

  const user = session.user
  const fullName = user.user_metadata?.full_name || user.email || 'Người dùng'

  const getInitials = (name: string) => {
    const names = name.trim().split(' ')
    if (names.length === 0) return ''
    if (names.length === 1) return names[0][0].toUpperCase()
    return (names[0][0] + names[names.length - 1][0]).toUpperCase()
  }

  return (
    <aside className={`transition-all duration-300 ${open ? 'w-64' : 'w-16'} bg-gray-900 p-4 min-h-screen flex flex-col justify-between`}>
      <div>
        {/* Avatar và họ tên */}
        <div className={`flex flex-col items-center mb-6 ${open ? 'block' : 'hidden'}`}>
          <div className="relative w-24 h-24 rounded-full overflow-hidden bg-indigo-600 flex items-center justify-center text-white text-4xl font-bold select-none">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              getInitials(fullName)
            )}
          </div>
          <div className="mt-3 text-white font-semibold truncate w-full text-center">{fullName}</div>
          <label
            htmlFor="avatarUpload"
            className="mt-2 cursor-pointer text-sm text-indigo-400 hover:underline"
          >
            {uploading ? 'Đang tải...' : 'Đổi ảnh đại diện'}
          </label>
          <input
            type="file"
            id="avatarUpload"
            accept="image/*"
            onChange={uploadAvatar}
            className="hidden"
            disabled={uploading}
          />
        </div>

        {/* Nút mở/đóng sidebar */}
        <button onClick={() => setOpen(!open)} className="text-white mb-6">
          ☰
        </button>

        {/* Menu */}
        <nav className="space-y-2">
          <button
            onClick={() => router.push('/')}
            className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition ${
              isActive('/') ? 'bg-indigo-600 text-white' : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            {open ? '📊 Dashboard' : '📊'}
          </button>

          <div>
            <button
              onClick={() => setShowAnalysisMenu(!showAnalysisMenu)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition ${
                pathname.startsWith('/analysis') ? 'bg-indigo-600 text-white' : 'text-slate-200 hover:bg-white/10'
              }`}
            >
              {open ? '🧠 Phân tích' : '🧠'}
            </button>

            {open && showAnalysisMenu && (
              <div className="ml-4 mt-1 space-y-1">
                <button
                  onClick={() => router.push('/analysis/market-analysis')}
                  className={`block w-full text-left px-3 py-1 rounded-md text-sm ${
                    isActive('/analysis/market-analysis') ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  • Thị Trường
                </button>
                <button
                  onClick={() => router.push('/analysis/stocks')}
                  className={`block w-full text-left px-3 py-1 rounded-md text-sm ${
                    isActive('/analysis/stocks') ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  • Cổ phiếu
                </button>
                
              </div>
            )}
          </div>

          <button
            onClick={() => router.push('/settings')}
            className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition ${
              isActive('/settings') ? 'bg-indigo-600 text-white' : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            {open ? '⚙️ Cài đặt' : '⚙️'}
          </button>
        </nav>
      </div>

      <div className="mt-8">
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-2 rounded-md text-sm text-red-400 hover:bg-red-600 hover:text-white transition"
        >
          {open ? '🚪 Đăng xuất' : '🚪'}
        </button>
      </div>
    </aside>
  )
}
