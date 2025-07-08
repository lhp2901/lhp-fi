// 📁 /app/api/predict-all/route.ts

import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'

// ⚙️ Cấu hình thời gian timeout (ms) và giới hạn output (byte)
const TIMEOUT_MS = 15000
const MAX_OUTPUT_LENGTH = 1_000_000

export async function POST() {
  try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'predict_all.py')

    if (!fs.existsSync(scriptPath)) {
      console.error('❌ Không tìm thấy script:', scriptPath)
      return NextResponse.json({ error: 'Thiếu script predict_all.py' }, { status: 500 })
    }

    const py = spawn('python', [scriptPath], {
      env: { ...process.env }, // 🔐 Cho phép truyền env nếu cần
    })

    py.stdout.setEncoding('utf8')
    py.stderr.setEncoding('utf8')

    let stdout = ''
    let stderr = ''

    py.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    py.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    return await new Promise<Response>((resolve) => {
      const timeout = setTimeout(() => {
        py.kill()
        console.error('⏱️ predict_all.py vượt quá thời gian giới hạn')
        resolve(NextResponse.json({ error: 'Timeout khi dự đoán' }, { status: 500 }))
      }, TIMEOUT_MS)

      py.on('close', (code) => {
        clearTimeout(timeout)

        if (code !== 0) {
          console.error(`❌ predict_all.py thoát với mã ${code}`)
          console.error(`📄 STDERR: ${stderr}`)
          resolve(NextResponse.json({ error: 'Lỗi khi chạy script dự đoán' }, { status: 500 }))
          return
        }

        if (stdout.length > MAX_OUTPUT_LENGTH) {
          console.error('🚨 Output quá lớn, có thể gây lỗi hoặc bị tấn công log')
          resolve(NextResponse.json({ error: 'Output vượt quá giới hạn' }, { status: 500 }))
          return
        }

        try {
          const result = JSON.parse(stdout)
          console.log(`✅ [predict_all.py hoàn tất] ${new Date().toISOString()}`)
          resolve(NextResponse.json({ success: true, result }))
        } catch (e) {
          console.error('❌ Không parse được JSON từ stdout:', stdout)
          resolve(NextResponse.json({ error: 'Không đọc được kết quả JSON' }, { status: 500 }))
        }
      })
    })
  } catch (err: any) {
    console.error('🔥 Lỗi hệ thống khi POST /predict-all:', err.message || err)
    return NextResponse.json({ error: 'Lỗi hệ thống nội bộ' }, { status: 500 })
  }
}
