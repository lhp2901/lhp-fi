'use client'

import React from 'react'
import type { LiquiditySide } from './liquidityHeatmapConfig'

type Props = {
  intensity: number
  threshold: number
  side: LiquiditySide
  status: string
  onIntensityChange: (value: number) => void
  onThresholdChange: (value: number) => void
  onSideChange: (value: LiquiditySide) => void
}

export default function LiquidityHeatmapToolbar({
  intensity,
  threshold,
  side,
  status,
  onIntensityChange,
  onThresholdChange,
  onSideChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-[#080d14] px-2 py-1.5">
      <label className="flex items-center gap-2 text-[11px] text-slate-300">
        Intensity
        <input
          aria-label="Heatmap intensity"
          type="range"
          min="0.15"
          max="1"
          step="0.05"
          value={intensity}
          onChange={(event) => onIntensityChange(Number(event.target.value))}
          className="w-20 accent-cyan-400"
        />
        <span className="w-8 text-right tabular-nums">{Math.round(intensity * 100)}%</span>
      </label>

      <label className="flex items-center gap-1 text-[11px] text-slate-300">
        Min qty
        <input
          aria-label="Minimum liquidity threshold"
          type="number"
          min="0"
          step="100"
          value={threshold}
          onChange={(event) => onThresholdChange(Math.max(0, Number(event.target.value) || 0))}
          className="w-20 rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-slate-100"
        />
      </label>

      <select
        aria-label="Liquidity side"
        value={side}
        onChange={(event) => onSideChange(event.target.value as LiquiditySide)}
        className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100"
      >
        <option value="both">Bid + Ask</option>
        <option value="bid">Bid only</option>
        <option value="ask">Ask only</option>
      </select>

      <span className="max-w-48 truncate text-[10px] text-slate-500" title={status}>
        {status}
      </span>
    </div>
  )
}
