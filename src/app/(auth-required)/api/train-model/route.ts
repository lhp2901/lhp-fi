// app/api/train-model/route.ts
import { NextResponse } from 'next/server'

const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:10000'

export async function POST(req: Request) {
  try {
    console.log('🚀 [TRAIN MODEL] Bắt đầu gọi Flask để train mô hình...')

    // 🔁 Gọi Flask /train (có body rỗng nếu cần)
    const flaskRes = await fetch(`${AI_SERVER_URL}/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}) // thêm để tránh lỗi nếu Flask yêu cầu JSON
    })

    let trainResult: any = {}

    try {
      trainResult = await flaskRes.json()
    } catch (e) {
      console.error('❌ Không parse được JSON từ Flask:', e)
      return NextResponse.json({
        error: 'Flask trả về phản hồi không hợp lệ (không phải JSON)',
        message: '❌ Train model thất bại!',
      }, { status: 500 })
    }

    if (!flaskRes.ok) {
      console.error('❌ Train thất bại từ Flask:', trainResult?.error || trainResult)
      return NextResponse.json({
        error: trainResult?.error || 'Flask AI train lỗi không rõ',
        message: '❌ Train model thất bại!',
      }, { status: 500 })
    }

    console.log('✅ Train model từ Flask thành công:', trainResult?.message || '[Không có message]')

    // 🧠 Lấy origin của request để gọi ngược lại API nội bộ
    const requestHeaders = new Headers(req.headers)
    const baseUrl =
      requestHeaders.get('origin') ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      'http://localhost:3000'

    console.log('🚀 Gọi /api/generate-signals tại:', `${baseUrl}/api/generate-signals`)

    const genRes = await fetch(`${baseUrl}/api/generate-signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}) // sửa tại đây nếu muốn truyền thêm stock_code, date,...
    })

    let genJson: any = {}
    try {
      genJson = await genRes.json()
    } catch (e) {
      console.error('❌ Không parse được JSON từ /generate-signals:', e)
      return NextResponse.json({
        error: 'Lỗi từ API /generate-signals: phản hồi không hợp lệ',
        message: '❌ Sinh tín hiệu thất bại!',
      }, { status: 500 })
    }

    if (!genRes.ok) {
      console.error('❌ Sinh tín hiệu thất bại:', genJson)
      return NextResponse.json({
        error: genJson?.error || 'Lỗi không rõ khi sinh tín hiệu',
        message: '❌ Sinh tín hiệu thất bại!',
      }, { status: 500 })
    }

    return NextResponse.json({
      message: '✅ Train + Sinh tín hiệu AI thành công!',
      train_log: trainResult?.message || '✅ Đã train mô hình',
      generate_log: genJson?.message || '✅ Đã sinh tín hiệu',
    })

  } catch (err: any) {
    console.error('🔥 Lỗi hệ thống khi xử lý train-model:', err.message || err)
    return NextResponse.json({
      error: err.message || 'Lỗi hệ thống nội bộ',
      message: '❌ Train + Generate thất bại!',
    }, { status: 500 })
  }
}
