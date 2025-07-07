import { supabase } from '@/lib/supabase'

const calculateIndicators = (data: any[]) => {
  return data.map((item, i) => {
    const slice = data.slice(Math.max(0, i - 19), i + 1)
    const closes = slice.map(d => d.close)
    const ma20 = closes.reduce((a, b) => a + b, 0) / closes.length
    const stdDev = Math.sqrt(closes.map(x => (x - ma20) ** 2).reduce((a, b) => a + b, 0) / closes.length)
    const upperBB = ma20 + 2 * stdDev
    const lowerBB = ma20 - 2 * stdDev

    const rsi = i >= 14 ? (() => {
      const gains = data.slice(i - 13, i + 1).map((d, j) => {
        const diff = j === 0 ? 0 : d.close - data[i - 13 + j - 1].close
        return diff > 0 ? diff : 0
      })
      const losses = data.slice(i - 13, i + 1).map((d, j) => {
        const diff = j === 0 ? 0 : data[i - 13 + j - 1].close - d.close
        return diff > 0 ? diff : 0
      })
      const avgGain = gains.reduce((a, b) => a + b, 0) / 14
      const avgLoss = losses.reduce((a, b) => a + b, 0) / 14
      const rs = avgGain / (avgLoss || 1)
      return 100 - 100 / (1 + rs)
    })() : null

    return { ...item, ma20, upperBB, lowerBB, rsi }
  })
}

const generateSignals = async () => {
  const { data: symbols } = await supabase
    .from('stock_entries')
    .select('symbol')
    .neq('symbol', null)

  const uniqueSymbols = Array.from(new Set(symbols?.map(s => s.symbol)))

  for (const symbol of uniqueSymbols) {
    const { data: rows } = await supabase
      .from('stock_entries')
      .select('*')
      .eq('symbol', symbol)
      .order('date', { ascending: true })

    if (!rows || rows.length < 25) continue

    const enriched = calculateIndicators(rows)

    for (let i = 0; i < enriched.length - 3; i++) {
      const row = enriched[i]
      const futureClose = enriched[i + 3].close
      const futureGain = ((futureClose - row.close) / row.close) * 100
      const labelWin = futureGain > 3

      await supabase.from('ai_signals').insert({
        symbol,
        date: row.date,
        close: row.close,
        volume: row.volume,
        ma20: row.ma20,
        rsi: row.rsi,
        bb_upper: row.upperBB,
        bb_lower: row.lowerBB,
        foreign_buy_value: row.foreign_buy_value,
        foreign_sell_value: row.foreign_sell_value,
        proprietary_buy_value: row.proprietary_buy_value,
        proprietary_sell_value: row.proprietary_sell_value,
        future_gain_3d: futureGain,
        label_win: labelWin
      })
    }
  }

  console.log('✅ Đã sinh dữ liệu AI vào bảng ai_signals.')
}

generateSignals()
