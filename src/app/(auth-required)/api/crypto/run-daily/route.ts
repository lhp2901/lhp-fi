import { NextResponse } from 'next/server'

const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:10000'
const FLASK_ENDPOINT = `${AI_SERVER_URL}/bybit/run_daily`

export async function POST() {
  console.log('📡 Gửi yêu cầu sinh tín hiệu AI đến Flask:', FLASK_ENDPOINT)

  try {
    const res = await fetch(FLASK_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
    })

    const contentType = res.headers.get('content-type') || ''
    const rawText = await res.text()

    let data: Record<string, any> = {}

    if (contentType.includes('application/json')) {
      try {
        data = JSON.parse(rawText)
      } catch (err) {
        console.error('❌ JSON lỗi từ Flask:', rawText)
        return NextResponse.json({ error: '🔥 JSON từ Flask lỗi định dạng!' }, { status: 502 })
      }
    } else {
      console.warn('⚠️ Flask không trả về JSON:', rawText)
      return NextResponse.json(
        {
          error: '⚠️ Flask không trả về JSON hợp lệ',
          stdout: '',
          stderr: rawText,
        },
        { status: 502 }
      )
    }

    // Flask trả lỗi
    if (!res.ok || data?.error) {
      console.error(`❌ Flask trả lỗi [${res.status}]:`, data)
      return NextResponse.json(
        {
          error: data?.error || 'Lỗi không xác định từ Flask',
          stdout: data?.stdout || '',
          stderr: data?.stderr || '',
        },
        { status: res.status }
      )
    }

    // ✅ Thành công
    console.log('✅ Flask trả về:', data)
    return NextResponse.json(
      {
        message: data?.message || '✅ Đã chạy AI thành công!',
        stdout: data?.stdout || '',
        stderr: data?.stderr || '',
      },
      { status: 200 }
    )
  } catch (err: any) {
    console.error(`🔥 Lỗi kết nối tới Flask:`, err.message || err)
    return NextResponse.json(
      {
        error: '🛑 Không thể kết nối đến Flask AI server',
        stdout: '',
        stderr: err?.message || String(err),
      },
      { status: 500 }
    )
  }
}
