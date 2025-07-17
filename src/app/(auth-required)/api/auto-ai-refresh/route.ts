import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST() {
  try {
    console.log('🧹 Đang xoá toàn bộ dữ liệu AI...')

    const tables = [
      'ai_accuracy_logs',
      'ai_market_signals',
      'ai_signals',
      'import_logs',
    ]

    for (const table of tables) {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .not('id', 'is', null)

      if (error) {
        throw new Error(`Lỗi xoá bảng ${table}: ${error.message}`)
      }

      console.log(`✅ Đã xoá bảng ${table}`)
    }

    return NextResponse.json({ message: '✅ Đã xoá toàn bộ dữ liệu AI!' })
  } catch (err: any) {
    console.error('🔥 Lỗi khi xoá dữ liệu AI:', err.message || err)
    return NextResponse.json({ error: 'Lỗi khi xoá AI' }, { status: 500 })
  }
}
