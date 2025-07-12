import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SMA, RSI, BollingerBands } from 'technicalindicators'

// 🔐 Supabase dùng service role để bypass RLS
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const fixNull = (v: any) => (v === null || v === undefined ? 0 : v)

// 📦 Lấy danh sách user_id từ bảng stock_entries
async function getAllUserIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('stock_entries')
    .select('user_id')
    .not('user_id', 'is', null)

  if (error) throw new Error(error.message)
  return Array.from(new Set(data.map((d: any) => d.user_id)))
}

// 🧠 Lấy các mã cổ phiếu của user
async function getSymbolsByUser(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('stock_entries')
    .select('symbol')
    .eq('user_id', userId)
    .neq('symbol', null)

  if (error) throw new Error(error.message)
  return Array.from(new Set(data.map((d: any) => d.symbol)))
}

// 📅 Lấy dữ liệu của 1 mã
async function fetchStockData(userId: string, symbol: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('stock_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('symbol', symbol)
    .order('date', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

// 📈 Tính toán chỉ báo kỹ thuật
function calculateIndicators(data: any[]) {
  const closes = data.map(d => fixNull(d.close))
  return {
    ma20: SMA.calculate({ period: 20, values: closes }),
    rsi: RSI.calculate({ period: 14, values: closes }),
    bb: BollingerBands.calculate({ period: 20, stdDev: 2, values: closes })
  }
}

// ✨ Tạo tín hiệu AI cho từng dòng
function enrichWithSignals(data: any[], indicators: any, userId: string) {
  const { ma20, rsi, bb } = indicators
  const offset = data.length - ma20.length
  const enriched = []

  for (let i = offset; i < data.length - 3; i++) {
    const curr = data[i]
    const future = data[i + 3]
    const gain = (future?.close && curr?.close) ? (future.close - curr.close) / curr.close : null

    enriched.push({
      user_id: userId,
      symbol: curr.symbol,
      date: curr.date,
      close: fixNull(curr.close),
      volume: fixNull(curr.volume),
      ma20: ma20[i - offset],
      rsi: rsi[i - offset],
      bb_upper: bb[i - offset]?.upper ?? 0,
      bb_lower: bb[i - offset]?.lower ?? 0,
      foreign_buy_value: fixNull(curr.foreign_buy_value),
      foreign_sell_value: fixNull(curr.foreign_sell_value),
      future_gain_3d: gain,
      label_win: typeof gain === 'number' ? gain > 0.03 : null
    })
  }

  return enriched
}

// 💾 Ghi dữ liệu vào bảng ai_signals (upsert)
async function insertSignals(data: any[]) {
  if (data.length === 0) return

  const { error } = await supabase.from('ai_signals').upsert(data, {
    onConflict: 'user_id,date,symbol'
  })

  if (error) throw new Error(error.message)
}

export async function POST() {
  try {
    console.log('🚀 Bắt đầu sinh tín hiệu AI...')

    const userIds = await getAllUserIds()
    console.log(`👤 Tổng số user: ${userIds.length}`)

    for (const userId of userIds) {
      console.log(`🎯 Xử lý user: ${userId}`)

      const symbols = await getSymbolsByUser(userId)

      for (const symbol of symbols) {
        console.log(`📈 Xử lý mã: ${symbol}`)

        const rawData = await fetchStockData(userId, symbol)
        if (rawData.length < 30) {
          console.log(`⚠️ Bỏ qua ${symbol}: không đủ dữ liệu (${rawData.length})`)
          continue
        }

        const indicators = calculateIndicators(rawData)
        const enriched = enrichWithSignals(rawData, indicators, userId)
        await insertSignals(enriched)

        console.log(`✅ Ghi ${enriched.length} dòng cho ${symbol}`)
      }
    }

    console.log('🏁 Hoàn tất sinh tín hiệu cho tất cả user.')
    return NextResponse.json({ message: '✅ Sinh tín hiệu AI thành công!' })

  } catch (err: any) {
    console.error('🔥 Lỗi generate-signals:', err.message || err)
    return NextResponse.json({ error: err.message || 'Lỗi không xác định' }, { status: 500 })
  }
}
