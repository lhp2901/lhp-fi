"use client";

import { useMemo, useState } from "react";
import { useSymbols } from "./hooks/useSymbols";
import { SymbolStats } from "./components/SymbolStats";
import { SymbolTable } from "./components/SymbolTable";
import { SymbolFormDialog } from "./components/SymbolFormDialog";
import type { ManagedSymbol, SymbolFormValue } from "./types";

export default function SymbolsManagementPage() {
  const [token, setToken] = useState("");
  const { symbols, loading, error, busy, refresh, add, update, remove, setEnabled } = useSymbols(token);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedSymbol | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => symbols.filter(row => {
    const term = search.trim().toLowerCase();
    const matches = !term || row.symbol.toLowerCase().includes(term) || String(row.name ?? "").toLowerCase().includes(term);
    const state = filter === "all" || (filter === "active" ? row.enabled !== false : row.enabled === false);
    return matches && state;
  }), [symbols, search, filter]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const shown = filtered.slice((page - 1) * pageSize, page * pageSize);

  async function save(value: SymbolFormValue) {
    if (editing) await update(editing.symbol, value);
    else await add(value);
  }
  async function toggle(row: ManagedSymbol) {
    if (!confirm(`${row.enabled === false ? "Bật" : "Tắt"} mã ${row.symbol}?`)) return;
    await setEnabled(row.symbol, row.enabled === false);
  }
  async function deleteRow(row: ManagedSymbol) {
    if (!confirm(`Xóa mã ${row.symbol} khỏi danh sách quản lý? Thao tác này không nhất thiết xóa dữ liệu lịch sử.`)) return;
    await remove(row.symbol);
  }

  return <main className="min-h-screen bg-[#080d14] p-4 text-slate-200 sm:p-6 lg:p-8">
    <div className="mx-auto max-w-[1600px] space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-400"><span className="h-2 w-2 rounded-full bg-sky-400" />LHP-FI / Footprint / Settings</div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Quản lý mã chứng khoán</h1>
          <p className="mt-1 text-sm text-slate-400">Danh sách mã, trạng thái hoạt động và kết nối dữ liệu Footprint.</p>
          <p className="mt-2 text-xs text-amber-300/80">Mã thêm tại đây hiện lưu trong RAM backend; restart backend sẽ làm mất thay đổi runtime.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="FOOTPRINT_CONTROL_TOKEN (nếu bật)" aria-label="Token quản lý Footprint" className="rounded-xl border border-slate-700 bg-[#0b111a] px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500" />
          <button onClick={() => void refresh()} disabled={loading || busy} className="rounded-xl border border-slate-700 bg-[#101722] px-4 py-2.5 text-sm text-slate-300 hover:border-slate-500 disabled:opacity-50">↻ Làm mới</button>
          <button onClick={() => { setEditing(null); setFormOpen(true); }} className="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400">＋ Thêm mã</button></div>
      </header>

      <SymbolStats symbols={symbols} />

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#101722]">
        <div className="flex flex-col gap-3 border-b border-slate-800 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="font-semibold text-white">Danh sách mã</h2><p className="mt-1 text-xs text-slate-500">Nguồn dữ liệu: API Footprint backend</p></div>
          <div className="flex flex-col gap-2 sm:flex-row"><input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm mã hoặc tên công ty…" className="w-full rounded-xl border border-slate-700 bg-[#0b111a] px-3 py-2 text-sm text-white outline-none focus:border-sky-500 sm:w-64" />
            <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} className="rounded-xl border border-slate-700 bg-[#0b111a] px-3 py-2 text-sm text-slate-200"><option value="all">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="inactive">Đã tắt</option></select></div>
        </div>
        {error && <div className="m-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}
        {loading ? <div className="p-14 text-center text-sm text-slate-500">Đang tải danh sách mã…</div> :
          <SymbolTable rows={shown} busy={busy} onEdit={row => { setEditing(row); setFormOpen(true); }} onToggle={row => void toggle(row)} onDelete={row => void deleteRow(row)} />}
        <footer className="flex flex-col gap-3 border-t border-slate-800 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>{filtered.length ? `Hiển thị ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} / ${filtered.length} mã` : "0 mã"}</span>
          <div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-lg border border-slate-700 px-3 py-1.5 disabled:opacity-30">Trước</button><span>Trang {page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="rounded-lg border border-slate-700 px-3 py-1.5 disabled:opacity-30">Sau</button></div></footer>
      </section>
    </div>
    {formOpen && <SymbolFormDialog item={editing} busy={busy} onClose={() => setFormOpen(false)} onSubmit={save} />}
  </main>;
}
