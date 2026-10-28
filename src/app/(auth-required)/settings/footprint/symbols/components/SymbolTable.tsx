"use client";

import type { ManagedSymbol } from "../types";
import { formatLastUpdate, streamState } from "../utils";
import { Badge, StreamBadge } from "./SymbolStatusBadge";

export function SymbolTable({ rows, onEdit, onToggle, onDelete, busy }: {
  rows: ManagedSymbol[]; onEdit: (row: ManagedSymbol) => void;
  onToggle: (row: ManagedSymbol) => void; onDelete: (row: ManagedSymbol) => void; busy: boolean;
}) {
  return <div className="overflow-x-auto">
    <table className="w-full min-w-[850px] text-left text-sm">
      <thead className="border-b border-slate-800 bg-[#0c121b] text-xs uppercase tracking-wider text-slate-500"><tr>
        {["Mã / Tên", "Sàn", "Nhóm", "Stream", "Trạng thái", "Cập nhật lần cuối", "Thao tác"].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
      </tr></thead>
      <tbody className="divide-y divide-slate-800/80">
        {rows.map(row => <tr key={row.symbol} className="transition hover:bg-slate-800/30">
          <td className="px-4 py-4"><div className="font-semibold text-white">{row.symbol}</div><div className="mt-0.5 max-w-48 truncate text-xs text-slate-500">{row.name || "Chưa khai báo tên"}</div></td>
          <td className="px-4 py-4 text-slate-300">{String(row.exchange || "—")}</td><td className="px-4 py-4 text-slate-300">{String(row.category || "—")}</td>
          <td className="px-4 py-4"><StreamBadge status={streamState(row)} /></td>
          <td className="px-4 py-4"><Badge tone={row.enabled === false ? "offline" : "live"}>{row.enabled === false ? "Đã tắt" : "Hoạt động"}</Badge></td>
          <td className="px-4 py-4 text-xs text-slate-400">{formatLastUpdate(row.last_update)}</td>
          <td className="px-4 py-4"><div className="flex items-center gap-2"><button disabled={busy} onClick={() => onEdit(row)} className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:border-sky-500 hover:text-sky-300">Sửa</button><button disabled={busy} onClick={() => onToggle(row)} className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white">{row.enabled === false ? "Bật" : "Tắt"}</button><button disabled={busy} onClick={() => onDelete(row)} className="rounded-lg border border-rose-500/20 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10">Xóa</button></div></td>
        </tr>)}
        {!rows.length && <tr><td colSpan={7} className="px-4 py-14 text-center text-slate-500">Không tìm thấy mã phù hợp.</td></tr>}
      </tbody>
    </table>
  </div>;
}
