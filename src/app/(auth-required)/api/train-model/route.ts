import { NextResponse } from 'next/server'

const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:10000'

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const skipGenerate = searchParams.get('skipGenerate') === 'true'

    console.log('🚀 [TRAIN MODEL] Bắt đầu gọi Flask để train mô hình...')

    const flaskRes = await fetch(`${AI_SERVER_URL}/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })

    let trainResult: any = {}
    try {
      trainResult = await flaskRes.json()
    } catch (e) {
      console.error('❌ Không parse được JSON từ Flask:', e)
      return NextResponse.json({
        error: 'Flask trả về phản hồi không hợp lệ',
        message: '❌ Train model thất bại!'
      }, { status: 500 })
    }

    if (!flaskRes.ok) {
      console.error('❌ Train thất bại từ Flask:', trainResult?.error || trainResult)
      return NextResponse.json({
        error: trainResult?.error || 'Flask AI train lỗi không rõ',
        message: '❌ Train model thất bại!'
      }, { status: 500 })
    }

    console.log('✅ Train model từ Flask thành công:', trainResult?.message || '[Không có message]')

    let generateLog = '[Bỏ qua generate-signals]'
    if (!skipGenerate) {
      const requestHeaders = new Headers(req.headers)
      const baseUrl =
        requestHeaders.get('origin') ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        'http://localhost:3000'

      const generateUrl = `${baseUrl}/api/generate-signals`
      console.log('🚀 Tiếp tục gọi generate signals tại:', generateUrl)

      const genRes = await fetch(generateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      try {
        const genJson = await genRes.json()

        if (!genRes.ok) {
          console.error('❌ Sinh tín hiệu thất bại:', genJson)
          return NextResponse.json({
            error: genJson?.error || 'Lỗi không rõ khi sinh tín hiệu',
            message: '❌ Sinh tín hiệu thất bại!'
          }, { status: 500 })
        }

        generateLog = genJson?.message || '✅ Đã sinh tín hiệu'
        console.log('✅ Sinh tín hiệu thành công:', generateLog)
      } catch (err) {
        console.error('❌ Lỗi parse JSON từ generate-signals:', err)
        return NextResponse.json({
          error: 'Lỗi phản hồi không hợp lệ từ /generate-signals',
          message: '❌ Sinh tín hiệu thất bại!'
        }, { status: 500 })
      }
    }

    return NextResponse.json({
      message: '✅ Train + (tùy chọn) Generate thành công!',
      train_log: trainResult?.message || '[Train xong]',
      generate_log: generateLog
    })

  } catch (err: any) {
    console.error('🔥 Lỗi hệ thống trong /train-model:', err.message || err)
    return NextResponse.json({
      error: err.message || 'Lỗi hệ thống nội bộ',
      message: '❌ Train + Generate thất bại!'
    }, { status: 500 })
  }
}
