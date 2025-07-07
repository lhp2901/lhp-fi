// src/app/api/symbols/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
)

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('stock_entries')
      .select('symbol')
      .neq('symbol', null)

    if (error) throw error

    const uniqueSymbols = Array.from(new Set(data.map(d => d.symbol)))
    return NextResponse.json({ symbols: uniqueSymbols })
  } catch (err: any) {
    console.error('❌ Lỗi khi lấy symbols:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
