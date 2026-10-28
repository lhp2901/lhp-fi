"use client";

import { useEffect, useState } from "react";
import type { ManagedSymbol, SymbolFormValue } from "../types";

export function SymbolFormDialog({ item, onClose, onSubmit, busy }: {
  item?: ManagedSymbol | null; onClose: () => void;
  onSubmit: (value: SymbolFormValue) => Promise<void>; busy: boolean;
}) {
  const [form, setForm] = useState<SymbolFormValue>({ symbol: "", name: "", exchange: "HOSE", category: "Cổ phiếu", enabled: true });
  const [error, setError] = useState("");

  useEffect(() => {
    setForm({ symbol: item?.symbol ?? "", name: String(item?.name ?? ""),
      exchange: String(item?.exchange ?? "HOSE"), category: String(item?.category ?? "Cổ phiếu"),
      enabled: item?.enabled !== false });
  }, [item]);

  const field = (key: keyof SymbolFormValue, value: string | boolean) => setForm(old => ({ ...old, [key]: value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const symbol = form.symbol.trim().toUpperCase();
    if (!/^[A-Z0-9._-]{1,20}$/.test(symbol)) { setError("Mã không hợp lệ. Chỉ dùng chữ in hoa, số, . _ -"); return; }
    try { await onSubmit({ ...form, symbol }); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : "Không lưu được mã."); }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true">
    <form onSubmit={submit} className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#101722] p-5 shadow-2xl">
      <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-white">{item ? "Chỉnh sửa mã" : "Thêm mã chứng khoán"}</h2><p className="text-sm text-slate-400">Cấu hình danh sách mã Footprint.</p></div>
        <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-slate-400 hover:bg-slate-800">✕</button></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-slate-300">Mã chứng khoán<input required disabled={!!item} value={form.symbol} onChange={e => field("symbol", e.target.value.toUpperCase())} placeholder="FPT" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0b111a] px-3 py-2.5 text-white outline-none focus:border-sky-500" /></label>
        <label className="text-sm text-slate-300">Tên hiển thị<input value={form.name} onChange={e => field("name", e.target.value)} placeholder="FPT Corporation" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0b111a] px-3 py-2.5 text-white outline-none focus:border-sky-500" /></label>
        <label className="text-sm text-slate-300">Sàn giao dịch<select value={form.exchange} onChange={e => field("exchange", e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0b111a] px-3 py-2.5 text-white"><option>HOSE</option><option>HNX</option><option>UPCOM</option><option>INDEX</option></select></label>
        <label className="text-sm text-slate-300">Nhóm mã<select value={form.category} onChange={e => field("category", e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0b111a] px-3 py-2.5 text-white"><option>Cổ phiếu</option><option>Ngân hàng</option><option>Chứng khoán</option><option>Bất động sản</option><option>VN30</option><option>Chỉ số</option><option>Khác</option></select></label>
      </div>
      <label className="mt-4 flex items-center gap-3 rounded-xl border border-slate-800 p-3 text-sm text-slate-300"><input type="checkbox" checked={form.enabled} onChange={e => field("enabled", e.target.checked)} className="accent-sky-500" />Cho phép mã hoạt động trong hệ thống</label>
      {error && <p className="mt-3 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300">Hủy</button><button disabled={busy} className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">{busy ? "Đang lưu…" : item ? "Lưu thay đổi" : "Thêm mã"}</button></div>
    </form>
  </div>;
}
