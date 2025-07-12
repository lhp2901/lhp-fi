// /app/api/predict/route.ts (Next.js 13+ App Router)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 📡 Tạo Supabase client (dùng service key để có quyền ghi)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ⚠️ PHẢI DÙNG service_role để UPDATE
)

const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:10000'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const symbol = searchParams.get('symbol')?.toUpperCase()

    if (!symbol) {
      return NextResponse.json({ error: '❌ Thiếu mã cổ phiếu (symbol)' }, { status: 400 })
    }

    // 🔍 Truy vấn dữ liệu mới nhất cho symbol
    const { data, error } = await supabase
      .from('ai_signals')
      .select('*')
      .eq('symbol', symbol)
      .order('date', { ascending: false })
      .limit(1)

    if (error) {
      console.error('❌ Lỗi Supabase:', error.message)
      return NextResponse.json({ error: '⚠️ Lỗi truy vấn Supabase' }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: '⚠️ Không tìm thấy dữ liệu cho mã này.' }, { status: 404 })
    }

    const row = data[0]
    const date = row.date

    // ✅ Kiểm tra đầy đủ các feature cần thiết
    const requiredFields = [
      'close', 'volume', 'ma20', 'rsi',
      'bb_upper', 'bb_lower',
      'foreign_buy_value', 'foreign_sell_value'
    ]

    for (const field of requiredFields) {
      if (row[field] === null || row[field] === undefined) {
        console.error(`❌ Thiếu trường dữ liệu: ${field}`)
        return NextResponse.json({
          error: `❌ Thiếu trường dữ liệu "${field}" trong Supabase cho mã ${symbol}`
        }, { status: 400 })
      }
    }

    const features = {
      close: Number(row.close),
      volume: Number(row.volume),
      ma20: Number(row.ma20),
      rsi: Number(row.rsi),
      bb_upper: Number(row.bb_upper),
      bb_lower: Number(row.bb_lower),
      foreign_buy_value: Number(row.foreign_buy_value),
      foreign_sell_value: Number(row.foreign_sell_value)
    }

    console.log(`📡 Gửi dữ liệu tới AI server: ${AI_SERVER_URL}/predict`)
    console.log('🧠 Dữ liệu input:', features)

    const res = await fetch(`${AI_SERVER_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(features)
    })

    const aiResult = await res.json()
    console.log('🤖 Phản hồi từ AI:', aiResult)

    if (!res.ok || !aiResult.probability || !aiResult.recommendation) {
      console.error('❌ Lỗi từ AI server:', aiResult)
      return NextResponse.json({ error: aiResult.error || '⚠️ AI không trả kết quả hợp lệ' }, { status: 500 })
    }

    // 📝 Cập nhật lại bảng ai_signals
    const { error: updateError } = await supabase
      .from('ai_signals')
      .update({
        ai_predicted_probability: aiResult.probability,
        ai_recommendation: aiResult.recommendation
      })
      .eq('symbol', symbol)
      .eq('date', date)

    if (updateError) {
      console.error('❌ Không thể ghi kết quả vào Supabase:', updateError.message)
    } else {
      console.log('✅ Ghi kết quả AI thành công.')
    }

    return NextResponse.json({
      symbol,
      date,
      probability: aiResult.probability,
      recommendation: aiResult.recommendation
    })

  } catch (err: any) {
    console.error('🔥 Lỗi server predict:', err.message || err)
    return NextResponse.json({ error: 'Lỗi nội bộ server.' }, { status: 500 })
  }
}
