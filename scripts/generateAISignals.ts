import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { SMA, RSI, BollingerBands } from 'technicalindicators'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
)

async function fetchSymbols() {
  const { data, error } = await supabase
    .from('stock_entries')
    .select('symbol')
    .neq('symbol', null)

  if (error) throw error
  return Array.from(new Set(data.map((d) => d.symbol)))
}

async function fetchDataBySymbol(symbol: string) {
  const { data, error } = await supabase
    .from('stock_entries')
    .select('*')
    .eq('symbol', symbol)
    .order('date', { ascending: true })

  if (error) throw error
  return data || []
}

function calculateIndicators(data: any[]) {
  const closes = data.map((d) => d.close)
  const ma20 = SMA.calculate({ period: 20, values: closes })
  const rsi = RSI.calculate({ period: 14, values: closes })
  const bb = BollingerBands.calculate({ period: 20, values: closes, stdDev: 2 })
  return { ma20, rsi, bb, closes }
}

function labelData(
  data: any[],
  indicators: { ma20: number[]; rsi: number[]; bb: any[]; closes: number[] }
): any[] {
  return data.map((row, i) => {
    const offset = i - (data.length - indicators.ma20.length)
    const future = data[i + 3]
    const gain = future ? (future.close - row.close) / row.close : null

    return {
      ...row,
      ma20: indicators.ma20[offset] ?? null,
      rsi: indicators.rsi[offset] ?? null,
      bb_upper: indicators.bb[offset]?.upper ?? null,
      bb_lower: indicators.bb[offset]?.lower ?? null,
      future_gain_3d: gain,
      label_win: gain !== null && gain > 0.03,
    }
  })
}

async function insertAISignals(data: any[]) {
  for (const row of data) {
    if (row.ma20 === null || row.rsi === null || row.bb_upper === null) continue

    await supabase.from('ai_signals').upsert({
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
      proprietary_buy_value: row.proprietary_buy_value,
      proprietary_sell_value: row.proprietary_sell_value,
      future_gain_3d: row.future_gain_3d,
      label_win: row.label_win,
    })
  }
}

async function run() {
  try {
    console.log('🚀 Đang lấy danh sách symbol...')
    const symbols = await fetchSymbols()

    for (const symbol of symbols) {
      console.log(`🧠 Đang xử lý: ${symbol}`)
      const raw = await fetchDataBySymbol(symbol)
      if (raw.length < 25) {
        console.log(`⚠️ Bỏ qua ${symbol} vì không đủ dữ liệu`)
        continue
      }

      const indicators = calculateIndicators(raw)
      const labeled = labelData(raw, indicators)

      await insertAISignals(labeled)
      console.log(`✅ Done: ${symbol}`)
    }

    console.log('🎯 Đã xử lý toàn bộ symbol.')
  } catch (err) {
    console.error('❌ Lỗi khi generate AI signals:', err)
  }
}

run()
