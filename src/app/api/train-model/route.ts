import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import path from 'path'
import fs from 'fs'

// POST /api/train-model
export async function POST() {
  try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'train_ai_model.py')

    if (!fs.existsSync(scriptPath)) {
      console.error(`❌ Không tìm thấy file train_ai_model.py tại ${scriptPath}`)
      return NextResponse.json(
        {
          error: `Không tìm thấy file train_ai_model.py tại ${scriptPath}`,
          message: '❌ Train model thất bại!',
        },
        { status: 404 }
      )
    }

    console.log('📦 Đang chạy Python script:', scriptPath)

    const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      exec(`python "${scriptPath}"`, { encoding: 'utf-8' }, (error, stdout, stderr) => {
        if (error) {
          console.error('❌ Lỗi khi chạy script:', error.message)
          return resolve({ stdout, stderr }) // Trả về luôn để show stderr, không reject
        }
        resolve({ stdout, stderr })
      })
    })

    console.log('✅ stdout:\n', result.stdout.trim())
    if (result.stderr.trim()) {
      console.warn('⚠️ stderr:\n', result.stderr.trim())
    }

    return NextResponse.json({
      message: '✅ Train model hoàn tất!',
      log: result.stdout.trim(),
      warn: result.stderr.trim() || 'Không có cảnh báo',
    })
  } catch (error: any) {
    console.error('🔥 Lỗi hệ thống:', error.message || error)
    return NextResponse.json(
      {
        error: error.message || 'Lỗi không xác định',
        message: '❌ Train model thất bại!',
      },
      { status: 500 }
    )
  }
}
