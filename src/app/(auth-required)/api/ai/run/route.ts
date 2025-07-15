import { NextResponse } from "next/server"

export async function POST() {
  const aiServerUrl = process.env.AI_SERVER_URL

  if (!aiServerUrl) {
    console.error("❌ Thiếu AI_SERVER_URL trong biến môi trường")
    return NextResponse.json({ error: "Chưa cấu hình AI_SERVER_URL" }, { status: 500 })
  }

  try {
    const res = await fetch(`${aiServerUrl}/run_daily`, {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    })

    const contentType = res.headers.get("content-type") || ""

    if (contentType.includes("application/json")) {
      try {
        const json = await res.json()
        return NextResponse.json(json, { status: res.status })
      } catch (err) {
        const fallbackText = await res.text()
        return NextResponse.json({
          error: "Lỗi parse JSON từ AI server",
          raw: fallbackText,
        }, { status: 500 })
      }
    } else {
      const raw = await res.text()
      return NextResponse.json({
        error: "AI server không trả về JSON hợp lệ",
        raw,
      }, { status: 500 })
    }

  } catch (error: any) {
    return NextResponse.json({
      error: "Không thể gọi AI server hoặc gặp lỗi",
      details: error?.message || String(error),
    }, { status: 500 })
  }
}
