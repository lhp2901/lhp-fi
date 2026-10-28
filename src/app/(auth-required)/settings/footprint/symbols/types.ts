export type SymbolStatus = "active" | "inactive" | "unknown";
export type StreamStatus = "live" | "connecting" | "offline" | "unknown";

export interface ManagedSymbol {
  symbol: string;
  name?: string;
  exchange?: string;
  category?: string;
  enabled?: boolean;
  status?: string;
  stream_status?: string;
  last_update?: string | number | null;
  volume?: number;
  [key: string]: unknown;
}

export interface SymbolFormValue {
  symbol: string;
  name: string;
  exchange: string;
  category: string;
  enabled: boolean;
}
