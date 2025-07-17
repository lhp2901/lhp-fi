import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: Request) {
  const body = await req.json()
  const { tables, userId, note } = body

  if (!userId || !tables || tables.length === 0) {
    return NextResponse.json({ error: 'Thiếu thông tin xoá dữ liệu' }, { status: 400 })
  }

  try {
    for (const table of tables) {
      const { error } = await supabaseAdmin.from(table).delete().not('id', 'is', null)
      if (error) throw new Error(`Lỗi xoá bảng ${table}: ${error.message}`)
    }

    const { error: logError } = await supabaseAdmin.from('delete_logs').insert({
      user_id: userId,
      tables,
      note: note || 'Xoá từ giao diện AI cleanup',
    })

    if (logError) throw new Error(`Lỗi ghi log: ${logError.message}`)

    return NextResponse.json({ message: 'Đã xoá & ghi log thành công' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lỗi không rõ' }, { status: 500 })
  }
}
