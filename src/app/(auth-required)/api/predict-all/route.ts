// 📁 /app/api/predict-all/route.ts

import { NextResponse } from 'next/server'

export async function POST() {
  const serverUrl = process.env.AI_SERVER_URL

  if (!serverUrl) {
    console.error('❌ Thiếu biến môi trường AI_SERVER_URL')
    return NextResponse.json(
      { error: 'Thiếu biến môi trường AI_SERVER_URL' },
      { status: 500 }
    )
  }

  try {
    console.log(`🌐 Gọi đến Flask AI server: ${serverUrl}/predict_all`)

    const res = await fetch(`${serverUrl}/predict_all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    const json = await res.json()

    if (!res.ok) {
      console.error('❌ Lỗi từ server Flask:', json)
      return NextResponse.json(
        { error: json.error || 'Lỗi khi chạy predict_all từ server AI' },
        { status: 500 }
      )
    }

    console.log('✅ [predict_all.py hoàn tất]', new Date().toISOString())

    return NextResponse.json({
      success: true,
      message: json.message || '✅ Đã dự đoán xong toàn bộ',
      result: json
    })
  } catch (error: any) {
    console.error('🔥 Lỗi khi gọi AI server:', error.message || error)
    return NextResponse.json(
      { error: 'Lỗi khi kết nối tới AI server' },
      { status: 500 }
    )
  }
}
