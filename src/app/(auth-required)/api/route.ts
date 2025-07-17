
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    { error: '🚫 Truy cập không hợp lệ: đây là endpoint nội bộ!' },
    { status: 403 }
  )
}

export async function POST() {
  return NextResponse.json(
    { error: '🚫 POST không được phép ở endpoint gốc /api!' },
    { status: 403 }
  )
}