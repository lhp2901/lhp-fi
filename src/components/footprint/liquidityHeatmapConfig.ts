export const LIQUIDITY_HEATMAP_COLORS = {
  bid: { r: 20, g: 220, b: 190 },
  ask: { r: 255, g: 165, b: 65 },
  emptyText: 'rgba(148,163,184,0.9)',
  background: '#080d14',
} as const

export const LIQUIDITY_HEATMAP_DEFAULTS = {
  intensity: 0.78,
  threshold: 0,
  side: 'both' as const,
  refreshMs: 2500,
  maxHistoryRows: 50000,
} as const

export type LiquiditySide = 'both' | 'bid' | 'ask'
