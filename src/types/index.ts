export type StockRow = {
  symbol: string
  date: string
  open?: number
  close?: number
  high?: number
  low?: number
  volume?: number
  asset_value?: number
  foreign_buy_volume?: number
  foreign_buy_value?: number
  foreign_sell_volume?: number
  foreign_sell_value?: number
  proprietary_buy_value?: number
  proprietary_sell_value?: number
  user_id: string
}

export type VNIndexRow = {
  date: string
  open?: number
  close?: number
  high?: number
  low?: number
  volume?: number
  value?: number
  foreign_buy_value?: number
  foreign_sell_value?: number
  proprietary_buy_value?: number
  proprietary_sell_value?: number
  user_id: string
}

export type VN30Row = {
  date: string
  open?: number
  close?: number
  high?: number
  low?: number
  volume?: number
  value?: number
  foreign_buy_value?: number
  foreign_sell_value?: number
  proprietary_buy_value?: number
  proprietary_sell_value?: number
  user_id: string
}

export type ImportLog = {
  id: string
  imported_at: string
  total_rows: number
  updated_rows: number
  note: string
}
