import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST() {
  try {
    console.log('🧹 Đang xoá toàn bộ ai_signals...')

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    )

    const { error } = await supabase
      .from('ai_signals')
      .delete()
      .not('id', 'is', null)

    if (error) {
      throw new Error(`Lỗi xoá: ${error.message}`)
    }

    console.log('✅ Đã xoá sạch bảng ai_signals!')
    return NextResponse.json({ message: '✅ Đã xoá toàn bộ dữ liệu AI!' })
  } catch (err: any) {
    console.error('🔥 Lỗi khi xoá AI:', err.message || err)
    return NextResponse.json({ error: 'Lỗi khi xoá AI' }, { status: 500 })
  }
}
