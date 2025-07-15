import { NextResponse } from "next/server"

export async function POST() {
  const aiServerUrl = process.env.AI_SERVER_URL

  if (!aiServerUrl) {
    console.error("❌ Chưa cấu hình biến môi trường AI_SERVER_URL")
    return NextResponse.json(
      { error: "Chưa cấu hình AI_SERVER_URL" },
      { status: 500 }
    )
  }

  try {
    const response = await fetch(`${aiServerUrl}/run_daily`, {
      method: "POST",
    })

    const contentType = response.headers.get("content-type")

    if (contentType && contentType.includes("application/json")) {
      const json = await response.json()
      return NextResponse.json(json)
    } else {
      const text = await response.text()
      console.error("❌ AI server trả về không phải JSON:\n", text)
      return NextResponse.json(
        {
          error: "AI server trả về không phải JSON",
          hint: "Kiểm tra server Flask có route /run_daily không",
          raw: text,
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("❌ Không kết nối được AI server:", error?.message || error)
    return NextResponse.json(
      {
        error: "Không thể kết nối tới AI server",
        details: error?.message || String(error),
        suggestion: "Kiểm tra server Flask đã chạy đúng port và route /run_daily",
      },
      { status: 500 }
    )
  }
}
