import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SMA, RSI, BollingerBands } from 'technicalindicators'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

const fixNull = (v: any) => (v === null || v === undefined ? 0 : v)

function calculateIndicators(data: any[]) {
  const closes = data.map((d) => fixNull(d.close))

  return {
    ma20: SMA.calculate({ period: 20, values: closes }),
    rsi: RSI.calculate({ period: 14, values: closes }),
    bb: BollingerBands.calculate({ period: 20, stdDev: 2, values: closes })
  }
}

function prepareInputRow(todayRow: any, indicators: any) {
  const { ma20, rsi, bb } = indicators

  if (!ma20.length || !rsi.length || !bb.length) return null

  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + 1)

  return {
    user_id: todayRow.user_id,
    symbol: todayRow.symbol,
    date: nextDate.toISOString().split('T')[0],
    close: fixNull(todayRow.close),
    volume: fixNull(todayRow.volume),
    ma20: ma20.at(-1),
    rsi: rsi.at(-1),
    bb_upper: bb.at(-1)?.upper ?? 0,
    bb_lower: bb.at(-1)?.lower ?? 0,
    foreign_buy_value: fixNull(todayRow.foreign_buy_value),
    foreign_sell_value: fixNull(todayRow.foreign_sell_value)
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log('🧠 [generate-ai-input-today] Bắt đầu...')

    const body = await req.json()
    const userId = body.userId

    if (!userId) {
      return NextResponse.json({ error: '❌ Thiếu userId!' }, { status: 400 })
    }

    const { data: symbols, error: symbolError } = await supabase
      .from('stock_entries')
      .select('symbol')
      .eq('user_id', userId)
      .neq('symbol', null)

    if (symbolError || !symbols) throw new Error('Không lấy được danh sách mã')

    const uniqueSymbols = [...new Set(symbols.map(s => s.symbol))]
    let inserted = 0

    for (const symbol of uniqueSymbols) {
      const { data: rows, error: rowErr } = await supabase
        .from('stock_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('symbol', symbol)
        .order('date', { ascending: true })

      if (rowErr || !rows || rows.length < 25) {
        console.warn(`⚠️ Bỏ qua ${symbol} (thiếu dữ liệu hoặc lỗi)`)
        continue
      }

      const todayRow = rows.at(-1)
      const indicators = calculateIndicators(rows)
      const preparedRow = prepareInputRow(todayRow, indicators)

      if (!preparedRow) {
        console.warn(`⚠️ Không thể tạo input cho ${symbol} (chỉ báo thiếu)`)
        continue
      }

      const { error: upsertError } = await supabase
        .from('ai_signals')
        .upsert([preparedRow], { onConflict: 'date,symbol,user_id' })

      if (upsertError) {
        console.error(`❌ Lỗi ghi ${symbol}:`, upsertError.message)
      } else {
        inserted++
      }
    }

    console.log(`✅ Ghi dữ liệu AI input cho ${inserted}/${uniqueSymbols.length} mã hôm nay`)
    return NextResponse.json({ message: `✅ Đã cập nhật ${inserted} mã cho user ${userId}` })

  } catch (error: any) {
    console.error('❌ Lỗi generate-ai-input-today:', error)
    return NextResponse.json({ error: error.message || 'Lỗi không xác định' }, { status: 500 })
  }
}
