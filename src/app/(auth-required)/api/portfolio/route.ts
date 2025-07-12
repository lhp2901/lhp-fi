// app/api/portfolio/route.ts
import { NextRequest, NextResponse } from 'next/server'

const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:10000'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json(
      { error: '❌ Thiếu userId!' },
      { status: 400 }
    )
  }

  try {
    console.log(`📡 Gửi yêu cầu đến AI Flask /portfolio cho userId: ${userId}`)

    const flaskRes = await fetch(`${AI_SERVER_URL}/portfolio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    })

    const rawText = await flaskRes.text()
    console.log('📥 Phản hồi từ Flask:', rawText)

    let json: any
    try {
      json = JSON.parse(rawText)
    } catch (err) {
      console.error('❌ Flask không trả JSON hợp lệ:', rawText)
      return NextResponse.json(
        { error: '🔥 Flask trả về nội dung không phải JSON' },
        { status: 500 }
      )
    }

    if (!flaskRes.ok) {
      console.error('❌ Flask trả lỗi:', json)
      return NextResponse.json(
        { error: json.error || '❌ Lỗi không rõ từ AI server' },
        { status: 500 }
      )
    }

    return NextResponse.json({ userId, ...json })

  } catch (err: any) {
    console.error('🔥 Lỗi khi gọi AI Flask:', err.message || err)
    return NextResponse.json(
      { error: '❌ Không kết nối được tới AI Flask server' },
      { status: 500 }
    )
  }
}
