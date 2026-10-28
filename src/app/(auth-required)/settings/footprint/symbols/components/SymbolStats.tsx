import type { ManagedSymbol } from "../types";
import { streamState } from "../utils";

export function SymbolStats({ symbols }: { symbols: ManagedSymbol[] }) {
  const active = symbols.filter(s => s.enabled !== false);
  const live = symbols.filter(s => streamState(s) === "live");
  const offline = symbols.filter(s => streamState(s) === "offline");
  const cards = [
    ["Tổng số mã", symbols.length, "Trong danh sách quản lý"],
    ["Đang hoạt động", active.length, "Được bật trong hệ thống"],
    ["Đang nhận stream", live.length, "Backend báo kết nối Live"],
    ["Offline", offline.length, "Backend báo ngắt kết nối"],
  ];
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {cards.map(([label, value, note], i) => <div key={String(label)} className="rounded-2xl border border-slate-800 bg-[#101722] p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight ${i === 2 ? "text-emerald-300" : "text-slate-100"}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>)}
  </div>;
}
