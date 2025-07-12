import { NextRequest, NextResponse } from 'next/server'

// Lấy endpoint Flask AI server (local hoặc Render)
const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:10000'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: '❌ Thiếu userId!' }, { status: 400 })
  }

  try {
    // 🔁 Gọi Flask AI server (POST /portfolio)
    const response = await fetch(`${AI_SERVER_URL}/portfolio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })

    const json = await response.json()

    if (!response.ok) {
      console.error('❌ Lỗi từ AI server:', json)
      return NextResponse.json(
        { error: json.error || 'AI server trả về lỗi' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      userId,
      ...json,
    })
  } catch (err: any) {
    console.error('🔥 Lỗi khi gọi AI Flask server:', err.message || err)
    return NextResponse.json({ error: 'Lỗi kết nối đến AI server' }, { status: 500 })
  }
}
