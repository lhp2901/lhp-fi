import type { ManagedSymbol, StreamStatus } from "./types";

export const DEFAULT_SYMBOLS = [
  "FPT", "SSI", "HPG", "VCB", "VND", "DXG", "GEX", "MWG", "CTG", "TCB",
  "MBB", "STB", "VIC", "VHM", "DGC", "VNM", "HSG", "NVL", "PDR", "VNINDEX", "VN30",
];

export function normalizeSymbols(input: unknown): ManagedSymbol[] {
  const root = input && typeof input === "object" ? input as any : {};
  const payload = root.data && typeof root.data === "object" ? root.data : root;
  const candidate = Array.isArray(input) ? input :
    (["symbols", "managed_symbols", "items", "results", "engine_symbols"].map(k => payload[k]).find(Array.isArray) ?? []);
  const normalized = candidate.map((item: unknown) => {
    if (typeof item === "string") return { symbol: item.trim().toUpperCase(), enabled: true };
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const symbol = String(row.symbol ?? row.ticker ?? row.code ?? "").trim().toUpperCase();
    return symbol ? { ...row, symbol, name: String(row.name ?? row.company_name ?? ""),
      enabled: row.enabled !== false && row.active !== false } as ManagedSymbol : null;
  }).filter(Boolean) as ManagedSymbol[];
  const seen = new Set<string>();
  return normalized.filter(row => !seen.has(row.symbol) && !!seen.add(row.symbol));
}

export function streamState(row: ManagedSymbol): StreamStatus {
  const raw = String(row.stream_status ?? row.stream ?? row.connection_status ?? "").toLowerCase();
  if (["live", "connected", "running", "online"].includes(raw)) return "live";
  if (["connecting", "starting"].includes(raw)) return "connecting";
  if (["offline", "disconnected", "stopped"].includes(raw)) return "offline";
  return "unknown";
}

export function formatLastUpdate(value: unknown) {
  if (value == null || value === "") return "Chưa cập nhật";
  const date = typeof value === "number" ? new Date(value < 1e12 ? value * 1000 : value) : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}
