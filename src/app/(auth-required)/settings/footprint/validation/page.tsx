"use client";

import { useCallback, useEffect, useState } from "react";
import { footprintAdminRequest, getErrorMessage, formatDate, formatNumber } from "@/lib/footprint-api";
import { PageHeading, Panel, MetricCard, ErrorNotice, LoadingNotice, RefreshButton, StatusBadge, TableWrap } from "../components/footprint-ui";

type ValidationReport = {
  checked_at?: string; sqlite_path?: string; ok?: boolean; table_exists?: boolean;
  rows_scanned?: number; valid?: number; invalid?: number; warning_count?: number;
  min_id?: number | null; max_id?: number | null; total_rows?: number | null;
  issues?: Array<Record<string, any>>; error?: string | null;
};

export default function ValidationPage() {
  const [token, setToken] = useState("");
  const [limit, setLimit] = useState("10000");
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const query = limit === "all" ? "" : `?limit=${encodeURIComponent(limit)}`;
      const r = await footprintAdminRequest<ValidationReport>(`/api/footprint/validation/sqlite${query}`, { token });
      setReport(r.data ?? null);
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setLoading(false); }
  }, [token, limit]);
  useEffect(() => { void refresh(); }, [refresh]);
  return <main className="space-y-6">
    <PageHeading title="Data Validation" description="Kiểm tra read-only dữ liệu SQLite: symbol, price, volume, side, timestamp, ID và trade ID trùng." action={<RefreshButton onClick={() => void refresh()} loading={loading} />} />
    <Panel title="Cấu hình kiểm tra" description="Validator chỉ đọc database, không sửa hoặc xóa giao dịch.">
      <div className="grid gap-3 md:grid-cols-[1fr_220px_auto] md:items-end">
        <label className="block text-sm text-slate-300">Admin token<input value={token} onChange={e => setToken(e.target.value)} type="password" autoComplete="off" className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white" placeholder="FOOTPRINT_CONTROL_TOKEN" /></label>
        <label className="block text-sm text-slate-300">Số dòng kiểm tra<select value={limit} onChange={e => setLimit(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white"><option value="1000">1.000 dòng đầu</option><option value="10000">10.000 dòng đầu</option><option value="50000">50.000 dòng đầu</option><option value="all">Toàn bộ dữ liệu</option></select></label>
        <button onClick={() => void refresh()} disabled={loading} className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 disabled:opacity-50">{loading ? "Đang kiểm tra…" : "Chạy kiểm tra"}</button>
      </div>
    </Panel>
    {error && <ErrorNotice message={error} />}
    {loading && !report ? <LoadingNotice /> : report && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Kết quả" value={report.ok ? "PASS" : "CẦN KIỂM TRA"} tone={report.ok ? "good" : "bad"} detail={formatDate(report.checked_at)} />
        <MetricCard label="Đã quét" value={formatNumber(report.rows_scanned)} detail={`Tổng SQLite: ${formatNumber(report.total_rows)}`} />
        <MetricCard label="Hợp lệ" value={formatNumber(report.valid)} tone="good" />
        <MetricCard label="Không hợp lệ / cảnh báo" value={`${formatNumber(report.invalid)} / ${formatNumber(report.warning_count)}`} tone={Number(report.invalid) > 0 ? "bad" : Number(report.warning_count) > 0 ? "warn" : "good"} />
      </div>
      <Panel title="Thông tin database" description={`Kiểm tra lúc ${formatDate(report.checked_at)}`}>
        <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-white/10 p-3"><p className="text-xs text-slate-500">SQLite path</p><p className="mt-1 break-all text-sm text-slate-200">{report.sqlite_path ?? "—"}</p></div><div className="rounded-xl border border-white/10 p-3"><p className="text-xs text-slate-500">ID range</p><p className="mt-1 text-sm text-slate-200">{report.min_id ?? "—"} → {report.max_id ?? "—"}</p></div></div>
        {report.error && <p className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-sm text-rose-200">{report.error}</p>}
      </Panel>
      <Panel title="Các vấn đề phát hiện" description={`Hiển thị tối đa ${formatNumber(report.issues?.length ?? 0)} vấn đề đầu tiên.`}>
        {!report.issues?.length ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-200">Không có lỗi hoặc cảnh báo trong các dòng đã quét.</div> : <TableWrap><thead className="bg-slate-950/80 text-xs uppercase text-slate-400"><tr><th className="px-3 py-3">Local ID</th><th className="px-3 py-3">Symbol</th><th className="px-3 py-3">Mức độ</th><th className="px-3 py-3">Mã lỗi</th><th className="px-3 py-3">Chi tiết</th></tr></thead><tbody className="divide-y divide-white/5">{report.issues.map((item, i) => { const errors = Array.isArray(item.errors) ? item.errors : []; const warnings = Array.isArray(item.warnings) ? item.warnings : []; return [...errors.map((x: any) => ({...x, severity: "ERROR"})), ...warnings.map((x: any) => ({...x, severity: "WARNING"}))].map((issue: any, j: number) => <tr key={`${i}-${j}`}><td className="px-3 py-3 text-slate-300">{item.local_id ?? "—"}</td><td className="px-3 py-3 text-slate-300">{item.symbol ?? "—"}</td><td className="px-3 py-3"><StatusBadge value={issue.severity} /></td><td className="px-3 py-3 font-mono text-xs text-slate-300">{issue.code ?? "—"}</td><td className="min-w-64 px-3 py-3 text-slate-400">{issue.message ?? "—"}</td></tr>); })}</tbody></TableWrap>}
      </Panel>
    </>}
  </main>;
}
