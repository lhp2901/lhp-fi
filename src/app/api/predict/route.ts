// src/app/api/predict/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'child_process'
import * as fs from 'fs'
import path from 'path'

// Supabase config
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const symbol = searchParams.get('symbol')

    if (!symbol) {
      return NextResponse.json({ error: '❌ Thiếu mã cổ phiếu (symbol)' }, { status: 400 })
    }

    // 📥 Lấy dòng dữ liệu mới nhất từ bảng ai_signals
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

    const features = {
      close: row.close,
      volume: row.volume,
      ma20: row.ma20,
      rsi: row.rsi,
      bb_upper: row.bb_upper,
      bb_lower: row.bb_lower,
      foreign_buy_value: row.foreign_buy_value,
      foreign_sell_value: row.foreign_sell_value,
    }

    const modelPath = path.join(process.cwd(), 'scripts', 'model.pkl')
    const scriptPath = path.join(process.cwd(), 'scripts', 'predict.py')

    if (!fs.existsSync(modelPath)) {
      return NextResponse.json({ error: `❌ Không tìm thấy model.pkl tại ${modelPath}` }, { status: 500 })
    }

    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json({ error: `❌ Không tìm thấy predict.py tại ${scriptPath}` }, { status: 500 })
    }

    const result = await new Promise<string>((resolve, reject) => {
      const py = spawn('python', [scriptPath, modelPath, JSON.stringify(features)])
      let output = ''
      let errorOutput = ''

      py.stdout.on('data', (data) => (output += data.toString()))
      py.stderr.on('data', (data) => (errorOutput += data.toString()))

      py.on('close', (code) => {
        if (code !== 0) {
          console.error('❌ Python lỗi:', errorOutput)
          reject(`Python script exited with code ${code}`)
        } else {
          resolve(output)
        }
      })
    })

    const parsed = JSON.parse(result)

    return NextResponse.json({
      symbol,
      date: row.date,
      probability: parsed.probability,
      recommendation: parsed.recommendation
    })

  } catch (err: any) {
    console.error('🔥 Lỗi trong predict API:', err.message || err)
    return NextResponse.json({ error: 'Lỗi nội bộ server' }, { status: 500 })
  }
}
