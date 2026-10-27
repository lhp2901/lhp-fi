const API_BASE_URL = (process.env.NEXT_PUBLIC_LHP_API_URL || "http://localhost:10000").replace(/\/+$/, "");

export type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  error?: string;
  timestamp?: string;
  api_version?: string;
  data?: T;
  details?: unknown;
};

export type FootprintHealth = {
  service?: string; status?: string; api_available?: boolean; engine_available?: boolean;
  stream_available?: boolean; stream_running?: boolean; storage_available?: boolean;
  config_valid?: boolean; config_errors?: string[]; stream?: Record<string, any>;
  engine?: Record<string, any>; storage?: Record<string, any>; checked_at?: string;
};
export type FootprintSymbols = {
  configured_symbols?: string[]; engine_symbols?: string[]; count?: number;
  symbol_status?: Record<string, Record<string, any>>;
};
export type FootprintStreamStatus = {
  stream?: Record<string, any>; engine?: Record<string, any>; storage?: Record<string, any>; checked_at?: string;
};
export type FootprintLevel = {
  price: number; price_key?: string; total_volume?: number; buy_volume?: number; sell_volume?: number;
  unknown_volume?: number; trade_count?: number; notional?: number; delta?: number | null; delta_percent?: number | null;
};
export type FootprintResult = {
  success?: boolean; symbol?: string; generated_at?: string;
  summary?: Record<string, any>; poc?: FootprintLevel | null; price_levels?: FootprintLevel[];
};
export type FootprintTrade = {
  symbol?: string; price?: number; volume?: number; quantity?: number; side?: string;
  timestamp?: number; timestamp_ms?: number; datetime?: string; trade_id?: string; notional?: number;
};
export type TradesResult = { success?: boolean; symbol?: string; count?: number; trade_tape_enabled?: boolean; trades?: FootprintTrade[] };
export type CandlesResult = { success?: boolean; symbol?: string; count?: number; interval_seconds?: number; candles?: Array<Record<string, any>> };

export class FootprintApiError extends Error {
  status: number;
  payload?: unknown;
  constructor(message: string, status: number, payload?: unknown) { super(message); this.name = "FootprintApiError"; this.status = status; this.payload = payload; }
}

export async function footprintGet<T>(path: string): Promise<ApiEnvelope<T>> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { method: "GET", cache: "no-store", headers: { Accept: "application/json" } });
  } catch {
    throw new FootprintApiError(`Không kết nối được Python API tại ${API_BASE_URL}. Kiểm tra backend và NEXT_PUBLIC_LHP_API_URL.`, 0);
  }
  const payload = await response.json().catch(() => null) as ApiEnvelope<T> | null;
  if (!response.ok || !payload?.success) {
    throw new FootprintApiError(payload?.error || payload?.message || `Python API trả về HTTP ${response.status}`, response.status, payload);
  }
  return payload;
}

function symbolPath(symbol: string) { return encodeURIComponent(symbol.trim().toUpperCase()); }
export const footprintApi = {
  health: () => footprintGet<FootprintHealth>("/api/footprint/health"),
  symbols: () => footprintGet<FootprintSymbols>("/api/footprint/symbols"),
  streamStatus: () => footprintGet<FootprintStreamStatus>("/api/footprint/stream/status"),
  storageStatus: () => footprintGet<Record<string, any>>("/api/footprint/storage/status"),
  footprint: (symbol: string, sort = "price", descending = false) => footprintGet<FootprintResult>(`/api/footprint/${symbolPath(symbol)}?sort=${sort}&descending=${descending}`),
  trades: (symbol: string, limit = 100) => footprintGet<TradesResult>(`/api/footprint/${symbolPath(symbol)}/trades?limit=${limit}&newest_first=true`),
  candles: (symbol: string, limit = 100) => footprintGet<CandlesResult>(`/api/footprint/${symbolPath(symbol)}/candles?limit=${limit}&newest_first=true`),
};

export const DEFAULT_SYMBOLS = ["FPT", "SSI", "HPG", "VCB", "VND", "DXG", "GEX", "MWG", "CTG", "TCB", "MBB", "STB", "VIC", "VHM", "DGC", "VNM", "HSG", "NVL", "PDR", "VNINDEX", "VN30"];
export function getErrorMessage(error: unknown) { return error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định."; }
export function formatNumber(value: unknown, digits = 0) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: digits }).format(number);
}
export function formatDate(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const date = typeof value === "number" ? new Date(value < 1e12 ? value * 1000 : value) : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "medium" }).format(date);
}


/** Admin endpoints are protected by FOOTPRINT_CONTROL_TOKEN on Flask.
 * Token stays in component memory and is never persisted in localStorage.
 */
export async function footprintAdminRequest<T>(
  path: string,
  options: { token?: string; method?: "GET" | "POST"; body?: Record<string, unknown> } = {},
): Promise<ApiEnvelope<T>> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.token?.trim() ? { "X-Footprint-Token": options.token.trim() } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch {
    throw new FootprintApiError(`Không kết nối được Python API tại ${API_BASE_URL}.`, 0);
  }
  const payload = await response.json().catch(() => null) as ApiEnvelope<T> | null;
  if (!response.ok || !payload?.success) {
    const detail = payload?.details ? ` — ${typeof payload.details === "string" ? payload.details : JSON.stringify(payload.details)}` : "";
    throw new FootprintApiError((payload?.error || payload?.message || `HTTP ${response.status}`) + detail, response.status, payload);
  }
  return payload;
}
