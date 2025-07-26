import { NextRequest, NextResponse } from 'next/server'

const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:10000'
const FLASK_API_ENDPOINT = `${AI_SERVER_URL}/bybit/bybit_to_supabase`

export async function POST(req: NextRequest) {
  console.log('📡 Gửi yêu cầu tới Flask API:', FLASK_API_ENDPOINT)

  try {
    const res = await fetch(FLASK_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ trigger: 'sync' }),
      // ❌ KHÔNG dùng signal để tránh timeout!
    })

    const contentType = res.headers.get('content-type') || ''
    const rawText = await res.text()

    let data: Record<string, any> = {}

    if (contentType.includes('application/json')) {
      try {
        data = JSON.parse(rawText)
      } catch (err) {
        console.error('❌ Flask trả về JSON lỗi:', rawText)
        return NextResponse.json({ error: '🔥 JSON từ Flask bị lỗi định dạng!' }, { status: 502 })
      }
    } else {
      console.warn('⚠️ Flask không trả về JSON:', rawText)
      return NextResponse.json({ error: '🔥 Flask không trả về JSON đúng định dạng!' }, { status: 502 })
    }

    if (!res.ok) {
      console.error(`❌ Flask trả lỗi [${res.status}]:`, data)
      return NextResponse.json({ error: data?.error || 'Lỗi từ Flask server' }, { status: res.status })
    }

    console.log('✅ Flask phản hồi thành công:', data)

    return NextResponse.json({
      message: data?.message || '✅ Đồng bộ thành công!',
      logs: data?.logs || [],
    })

  } catch (err: any) {
    console.error(`🔥 Lỗi kết nối đến Flask server:`, err.message || err)
    return NextResponse.json(
      { error: 'Lỗi kết nối đến Flask server!' },
      { status: 500 }
    )
  }
}
