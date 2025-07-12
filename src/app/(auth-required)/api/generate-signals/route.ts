import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SMA, RSI, BollingerBands } from 'technicalindicators'

// 🔐 Supabase với quyền ghi cao
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // cần quyền service-role để vượt qua RLS
)

const fixNull = (v: any) => (v === null || v === undefined ? 0 : v)

async function getAllUserIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('stock_entries')
    .select('user_id')
    .not('user_id', 'is', null)

  if (error) throw error

  const uniqueIds = Array.from(new Set(data.map((d: any) => d.user_id)))
  return uniqueIds
}

async function fetchSymbolsForUser(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('stock_entries')
    .select('symbol')
    .eq('user_id', userId)
    .neq('symbol', null)

  if (error) throw error
  return Array.from(new Set(data.map((d: any) => d.symbol)))
}

async function fetchDataForSymbol(symbol: string, userId: string) {
  const { data, error } = await supabase
    .from('stock_entries')
    .select('*')
    .eq('symbol', symbol)
    .eq('user_id', userId)
    .order('date', { ascending: true })

  if (error) throw error
  return data || []
}

function calculateIndicators(data: any[]) {
  const closes = data.map((d) => fixNull(d.close))
  return {
    ma20: SMA.calculate({ period: 20, values: closes }),
    rsi: RSI.calculate({ period: 14, values: closes }),
    bb: BollingerBands.calculate({ period: 20, stdDev: 2, values: closes }),
  }
}

function enrichData(data: any[], indicators: any, userId: string) {
  const { ma20, rsi, bb } = indicators
  const startIdx = data.length - ma20.length
  const rows = []

  for (let i = startIdx; i < data.length; i++) {
    const row = data[i]
    const future = data[i + 3]

    const gain = (future?.close && row?.close)
      ? (future.close - row.close) / row.close
      : null

    const label = typeof gain === 'number' ? gain > 0.03 : null

    rows.push({
      user_id: userId,
      symbol: row.symbol,
      date: row.date,
      close: fixNull(row.close),
      volume: fixNull(row.volume),
      ma20: ma20[i - startIdx],
      rsi: rsi[i - startIdx],
      bb_upper: bb[i - startIdx]?.upper ?? 0,
      bb_lower: bb[i - startIdx]?.lower ?? 0,
      foreign_buy_value: fixNull(row.foreign_buy_value),
      foreign_sell_value: fixNull(row.foreign_sell_value),
      future_gain_3d: gain,
      label_win: label,
    })
  }

  return rows
}

async function insertAISignals(rows: any[]) {
  let successCount = 0
  for (const row of rows) {
    const { error } = await supabase.from('ai_signals').upsert(
      {
        user_id: row.user_id,
        symbol: row.symbol,
        date: row.date,
        close: row.close,
        volume: row.volume,
        ma20: row.ma20,
        rsi: row.rsi,
        bb_upper: row.bb_upper,
        bb_lower: row.bb_lower,
        foreign_buy_value: row.foreign_buy_value,
        foreign_sell_value: row.foreign_sell_value,
        future_gain_3d: row.future_gain_3d,
        label_win: row.label_win,
      },
      { onConflict: 'user_id,date,symbol' }
    )

    if (!error) successCount++
    else console.error(`❌ Lỗi insert ${row.symbol} (${row.user_id}) ngày ${row.date}:`, error.message)
  }

  console.log(`✅ Ghi thành công ${successCount}/${rows.length} dòng.`)
}

export async function POST() {
  try {
    console.log('🚀 Bắt đầu sinh tín hiệu AI...')

    const userIds = await getAllUserIds()
    console.log(`👤 Tổng số user cần xử lý: ${userIds.length}`)

    for (const userId of userIds) {
      console.log(`\n🎯 User: ${userId}`)
      const symbols = await fetchSymbolsForUser(userId)

      for (const symbol of symbols) {
        console.log(`📈 Đang xử lý ${symbol}...`)
        const raw = await fetchDataForSymbol(symbol, userId)

        if (raw.length < 30) {
          console.log(`⚠️ Bỏ qua ${symbol} vì không đủ dữ liệu (${raw.length})`)
          continue
        }

        const indicators = calculateIndicators(raw)
        const enriched = enrichData(raw, indicators, userId)
        await insertAISignals(enriched)
        console.log(`✅ Done ${symbol}: ${enriched.length} dòng.`)
      }
    }

    console.log('\n🏁 HOÀN TẤT! Đã sinh tín hiệu cho tất cả user.')
    return NextResponse.json({ message: '✅ AI signals generated for all users.' })
  } catch (error: any) {
    console.error('❌ Lỗi trong generate-signals.ts:', error)
    return NextResponse.json({ error: error.message || 'Lỗi không xác định' }, { status: 500 })
  }
}
