// 📁 /app/api/portfolio/route.ts

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
)

const MAX_OUTPUT_SIZE = 1_000_000
const TIMEOUT_MS = 10000

// 🔁 Lấy ngày hợp lệ (ưu tiên hôm nay, fallback về hôm qua)
async function getValidDate(): Promise<string> {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
  const { data: todayData } = await supabase
    .from('ai_signals')
    .select('date')
    .eq('date', today)
    .not('ai_predicted_probability', 'is', null)

  if (todayData?.length) return today

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const fallback = yesterday.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
  console.warn(`📆 Fallback sang ngày: ${fallback}`)
  return fallback
}

function nextDay(dateStr: string): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export async function GET() {
  try {
    const sourceDate = await getValidDate()
    const predictedDate = nextDay(sourceDate)

    console.log(`📅 Truy vấn danh mục AI cho ngày: ${predictedDate} (từ dữ liệu ${sourceDate})`)

    const { data, error } = await supabase
      .from('ai_signals')
      .select('symbol, ai_predicted_probability, ai_recommendation')
      .eq('date', sourceDate)
      .not('ai_predicted_probability', 'is', null)

    if (error) {
      console.error('❌ Lỗi truy vấn Supabase:', error.message)
      return NextResponse.json({ error: 'Lỗi truy vấn dữ liệu AI' }, { status: 500 })
    }

    if (!data || data.length === 0) {
      console.warn(`⚠️ Không có dữ liệu AI cho ngày ${sourceDate}`)
      return NextResponse.json({ portfolio: [], date: predictedDate, source_date: sourceDate })
    }

    let candidates = data.filter((d) => d.ai_recommendation === 'BUY')

    if (candidates.length === 0) {
      const fallback = [...data]
        .sort((a, b) => b.ai_predicted_probability - a.ai_predicted_probability)
        .slice(0, 3)
        .map((item) => ({ ...item, ai_recommendation: 'WATCH' }))
      console.warn('🟡 Không có mã BUY – fallback WATCH:', fallback.map(f => f.symbol))
      candidates = fallback
    } else {
      console.log(`✅ Có ${candidates.length} mã BUY.`)
    }

    const scriptPath = path.join(process.cwd(), 'scripts', 'portfolio_optimizer.py')
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json({ error: '❌ Không tìm thấy script portfolio_optimizer.py' }, { status: 500 })
    }

    const py = spawn('python', [scriptPath])
    py.stdout.setEncoding('utf8')
    py.stderr.setEncoding('utf8')

    let output = ''
    let errorOutput = ''

    py.stdout.on('data', (chunk) => (output += chunk.toString()))
    py.stderr.on('data', (chunk) => (errorOutput += chunk.toString()))
    py.stdin.write(JSON.stringify(candidates))
    py.stdin.end()

    return await new Promise<Response>((resolve) => {
      const timeout = setTimeout(() => {
        py.kill()
        console.error('⏱️ Quá thời gian tối ưu danh mục')
        resolve(NextResponse.json({ error: 'Timeout tối ưu danh mục' }, { status: 500 }))
      }, TIMEOUT_MS)

      py.on('close', (code) => {
        clearTimeout(timeout)

        if (code !== 0) {
          console.error(`❌ Lỗi script Python (code ${code}):`, errorOutput)
          return resolve(NextResponse.json({ error: 'Lỗi khi tối ưu danh mục' }, { status: 500 }))
        }

        if (output.length > MAX_OUTPUT_SIZE) {
          console.error('⚠️ Output từ Python quá lớn')
          return resolve(NextResponse.json({ error: 'Output vượt quá giới hạn' }, { status: 500 }))
        }

        try {
          const portfolio = JSON.parse(output)
          console.log('📦 Danh mục tối ưu:', portfolio)

          return resolve(NextResponse.json({
            portfolio,
            date: predictedDate,
            source_date: sourceDate
          }))
        } catch (e) {
          console.error('❌ Lỗi parse JSON từ Python:', output)
          return resolve(NextResponse.json({ error: 'Không đọc được kết quả tối ưu' }, { status: 500 }))
        }
      })
    })

  } catch (err: any) {
    console.error('🔥 Lỗi hệ thống portfolio:', err.message || err)
    return NextResponse.json({ error: 'Lỗi hệ thống nội bộ' }, { status: 500 })
  }
}
