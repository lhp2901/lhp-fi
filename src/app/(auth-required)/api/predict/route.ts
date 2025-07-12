import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Supabase init
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:10000'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const symbol = searchParams.get('symbol')

    if (!symbol) {
      return NextResponse.json({ error: '❌ Thiếu mã cổ phiếu (symbol)' }, { status: 400 })
    }

    // 🧠 Lấy dòng mới nhất từ ai_signals
    const { data, error } = await supabase
      .from('ai_signals')
      .select('*')
      .eq('symbol', symbol)
      .order('date', { ascending: false })
      .limit(1)

    if (error || !data || data.length === 0) {
      return NextResponse.json({ error: '⚠️ Không tìm thấy dữ liệu cho mã này.' }, { status: 404 })
    }

    const row = data[0]
    const date = row.date

    const features = {
      close: row.close,
      volume: row.volume,
      ma20: row.ma20,
      rsi: row.rsi,
      bb_upper: row.bb_upper,
      bb_lower: row.bb_lower,
      foreign_buy_value: row.foreign_buy_value,
      foreign_sell_value: row.foreign_sell_value
    }

    // 🚀 Gửi đến AI Flask server
    const res = await fetch(`${AI_SERVER_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(features)
    })

    const aiResult = await res.json()

    if (!res.ok) {
      console.error('❌ Lỗi từ AI server:', aiResult)
      return NextResponse.json({ error: aiResult.error || 'Lỗi từ AI server' }, { status: 500 })
    }

    // 💾 Ghi lại kết quả dự đoán vào Supabase
    const { error: updateError } = await supabase
      .from('ai_signals')
      .update({
        ai_predicted_probability: aiResult.probability,
        ai_recommendation: aiResult.recommendation
      })
      .eq('symbol', symbol)
      .eq('date', date)

    if (updateError) {
      console.error('❌ Lỗi ghi Supabase:', updateError.message)
    }

    return NextResponse.json({
      symbol,
      date,
      probability: aiResult.probability,
      recommendation: aiResult.recommendation
    })

  } catch (err: any) {
    console.error('🔥 Lỗi trong API /predict:', err.message || err)
    return NextResponse.json({ error: 'Lỗi nội bộ server' }, { status: 500 })
  }
}
