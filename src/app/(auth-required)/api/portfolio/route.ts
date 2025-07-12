import { NextRequest, NextResponse } from 'next/server'

const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:10000'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: '❌ Thiếu userId!' }, { status: 400 })
  }

  try {
    console.log(`📡 Gửi yêu cầu đến AI Flask /portfolio cho userId: ${userId}`)

    const res = await fetch(`${AI_SERVER_URL}/portfolio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })

    const text = await res.text()
    let json
    try {
      json = JSON.parse(text)
    } catch (err) {
      console.error('❌ Flask không trả JSON, nội dung:', text)
      return NextResponse.json({ error: '🔥 Flask không trả JSON hợp lệ!' }, { status: 500 })
    }

    if (!res.ok) {
      return NextResponse.json({ error: json.error || 'Lỗi từ AI server' }, { status: 500 })
    }

    return NextResponse.json({ userId, ...json })

  } catch (err: any) {
    console.error('🔥 Lỗi khi gọi AI Flask server:', err.message || err)
    return NextResponse.json({ error: 'Lỗi kết nối đến AI server' }, { status: 500 })
  }
}
