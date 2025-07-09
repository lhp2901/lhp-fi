// Ghép chuỗi điều kiện class
export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(' ')
}

// Định dạng số tiền: 17200 → "17.200"
export function formatNumber(value: number): string {
  return value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

// Chuỗi → số: "17.200" → 17200
export function parseNumber(input: string): number {
  return parseFloat(input.replace(/,/g, '').replace(/\./g, '')) || 0
}

// Định dạng phần trăm: 0.134 → "+13.40%"
export function formatPercent(value: number): string {
  const percent = (value * 100).toFixed(2)
  return `${value >= 0 ? '+' : ''}${percent}%`
}

// Định dạng ngày: Date → 09/07/2025
export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, '0')}/${d.getFullYear()}`
}

// Định dạng mã: trim + viết hoa
export function toUpperCaseTrim(input: string): string {
  return input.trim().toUpperCase()
}

// Tính phí giao dịch
export function calculateFee(quantity: number, price: number, rate: number): number {
  return quantity * price * rate
}

// Lợi nhuận tuyệt đối: lãi/lỗ = (giá hiện tại - mua) * SL
export function calculatePnL(buyPrice: number, currentPrice: number, quantity: number): number {
  return (currentPrice - buyPrice) * quantity
}

// Lợi nhuận theo %
export function calculatePnLPercentage(buyPrice: number, currentPrice: number): number {
  if (buyPrice === 0) return 0
  return (currentPrice - buyPrice) / buyPrice
}

// Tách chuỗi tags: "dài hạn, tăng trưởng" → ["dài hạn", "tăng trưởng"]
export function splitTags(input: string): string[] {
  return input
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

// Gợi ý emoji cảm xúc tài chính
export const emotionPresets = [
  '🤓 Gồng lãi',
  '😣 Gồng lỗ',
  '🎬 Xong phim',
  '💰 Tiền đẻ tiền',
  '😵 Mua đỉnh',
  '🦈 Theo cá mập',
  '🌟 Tự tin nắm giữ',
  '❌ Cắt lỗ không run tay',
  '🛐 Cầu nguyện mỗi phiên',
  '🤡 Tự tin quá đà',
  '🎢 Tàu lượn cảm xúc',
]
