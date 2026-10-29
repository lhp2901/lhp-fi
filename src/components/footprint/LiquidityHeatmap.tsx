'use client'

import type { LiquiditySide } from './liquidityHeatmapConfig'
import { LIQUIDITY_HEATMAP_COLORS } from './liquidityHeatmapConfig'

export type LiquidityHeatmapPoint = {
  timestamp: number
  price: number
  bidLiquidity: number
  askLiquidity: number
  source?: string
}

export type LiquidityCandleTime = {
  timestamp: number
}

type DrawParams = {
  context: CanvasRenderingContext2D
  points: LiquidityHeatmapPoint[]
  candles: LiquidityCandleTime[]
  left: number
  top: number
  chartWidth: number
  chartHeight: number
  step: number
  minPrice: number
  maxPrice: number
  priceToY: (price: number) => number
  intensity: number
  threshold: number
  side: LiquiditySide
}

export function drawLiquidityHeatmap({
  context,
  points,
  candles,
  left,
  top,
  chartWidth,
  chartHeight,
  step,
  minPrice,
  maxPrice,
  priceToY,
  intensity,
  threshold,
  side,
}: DrawParams): number {
  if (!candles.length) return 0
  const firstTs = candles[0].timestamp
  const lastTs = candles[candles.length - 1].timestamp
  const span = Math.max(1, lastTs - firstTs)
  const inView = points.filter((point) => {
    const qty = Math.max(point.bidLiquidity || 0, point.askLiquidity || 0)
    return point.timestamp >= firstTs - span * 0.04 &&
      point.timestamp <= lastTs + span * 0.04 &&
      point.price >= minPrice && point.price <= maxPrice &&
      qty >= threshold
  })
  const maxQty = inView.reduce(
    (maximum, point) => Math.max(maximum, point.bidLiquidity || 0, point.askLiquidity || 0),
    1,
  )

  const priceRows = [...new Set(inView.map((point) => point.price))].sort((a, b) => a - b)
  const diffs = priceRows.slice(1).map((price, index) => price - priceRows[index]).filter((value) => value > 0)
  const tick = diffs.length
    ? diffs.reduce((minimum, value) => Math.min(minimum, value), Number.POSITIVE_INFINITY)
    : (maxPrice - minPrice) / 100
  const pixelStep = Math.abs(priceToY((inView[0]?.price ?? minPrice) + (tick || 1)) - priceToY(inView[0]?.price ?? minPrice))
  const cellHeight = Math.max(2, Math.min(24, pixelStep * 0.9 || chartHeight / 100))

  const alphaFor = (qty: number) => {
    const normalized = Math.max(0, Math.min(1, qty / maxQty))
    return Math.max(0.025, Math.min(0.94, normalized * intensity))
  }

  inView.forEach((point) => {
    let closestIndex = -1
    let closestDistance = Number.POSITIVE_INFINITY
    candles.forEach((candle, index) => {
      const distance = Math.abs(candle.timestamp - point.timestamp)
      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = index
      }
    })
    if (closestIndex < 0) return

    const x = left + step * closestIndex
    const y = priceToY(point.price)
    if (y < top - cellHeight || y > top + chartHeight + cellHeight) return
    const cellWidth = Math.max(1, step - 2)

    if (side !== 'ask' && point.bidLiquidity > 0) {
      const color = LIQUIDITY_HEATMAP_COLORS.bid
      context.fillStyle = `rgba(${color.r},${color.g},${color.b},${alphaFor(point.bidLiquidity)})`
      context.fillRect(x + 1, y - cellHeight / 2, cellWidth, cellHeight)
    }
    if (side !== 'bid' && point.askLiquidity > 0) {
      const color = LIQUIDITY_HEATMAP_COLORS.ask
      context.fillStyle = `rgba(${color.r},${color.g},${color.b},${alphaFor(point.askLiquidity)})`
      context.fillRect(x + 1, y - cellHeight / 2, cellWidth, cellHeight)
    }
  })

  if (!inView.length) {
    context.fillStyle = LIQUIDITY_HEATMAP_COLORS.emptyText
    context.font = '12px sans-serif'
    context.textAlign = 'center'
    context.fillText(
      'Chưa có lịch sử Order Book. Cần collector Market Depth realtime.',
      left + chartWidth / 2,
      top + chartHeight / 2,
    )
  }
  return inView.length
}
