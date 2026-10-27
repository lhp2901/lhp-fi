"use client";

import { useCallback, useEffect, useState } from "react";
import { footprintAdminRequest, getErrorMessage, formatDate, formatNumber } from "@/lib/footprint-api";
import { PageHeading, Panel, MetricCard, ErrorNotice, LoadingNotice, RefreshButton, StatusBadge, TableWrap } from "../components/footprint-ui";

type SyncStatus = {
  sync_name?: string;
  state?: Record<string, any>;
  sqlite?: Record<string, any>;
  supabase?: Record<string, any>;
  checked_at?: string;
};
type RunsData = { items?: Array<Record<string, any>>; count?: number; limit?: number };
type RunResult = Record<string, any>;

export default function DataSyncPage() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [runs, setRuns] = useState<RunsData | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [maxBatches, setMaxBatches] = useState("2");

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [s, r] = await Promise.allSettled([
        footprintAdminRequest<SyncStatus>("/api/footprint/sync/status", { token }),
        footprintAdminRequest<RunsData>("/api/footprint/sync/runs?limit=50", { token }),
      ]);
      if (s.status === "fulfilled") setStatus(s.value.data ?? null);
      else setError(getErrorMessage(s.reason));
      if (r.status === "fulfilled") setRuns(r.value.data ?? null);
      else if (s.status === "fulfilled") setError(`Không tải được lịch sử sync: ${getErrorMessage(r.reason)}`);
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setLoading(false); }
  }, [token]);

  const runSync = async (dryRun: boolean) => {
    setRunning(true); setError(""); setResult(null);
    try {
      const r = await footprintAdminRequest<RunResult>("/api/footprint/sync/run", {
        token, method: "POST", body: { dry_run: dryRun, max_batches: Number(maxBatches) || 2 },
      });
      setResult(r.data ?? null);
      await refresh();
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setRunning(false); }
  };

  useEffect(() => { void refresh(); }, [refresh]);
  const state = status?.state ?? {};
  const sqlite = status?.sqlite ?? {};
  const supabase = status?.supabase ?? {};

  return <main className="space-y-6">
    <PageHeading title="Data Sync" description="Theo dõi checkpoint SQLite → Supabase, lịch sử sync và chạy đồng bộ có giới hạn." action={<RefreshButton onClick={() => void refresh()} loading={loading} />} />
    <Panel title="Quyền quản trị" description="Trong production, nhập FOOTPRINT_CONTROL_TOKEN đã cấu hình ở backend. Token chỉ giữ trong bộ nhớ trang, không lưu localStorage.">
      <label className="block text-sm text-slate-300">Admin token (để trống nếu backend development không yêu cầu)
        <input value={token} onChange={e => setToken(e.target.value)} type="password" autoComplete="off" className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400" placeholder="FOOTPRINT_CONTROL_TOKEN" />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-300">Số batch tối đa
          <input type="number" min={1} max={20} value={maxBatches} onChange={e => setMaxBatches(e.target.value)} className="ml-2 w-20 rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-white" />
        </label>
        <button disabled={running} onClick={() => void runSync(true)} className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-200 disabled:opacity-50">{running ? "Đang chạy…" : "Chạy dry-run"}</button>
        <button disabled={running} onClick={() => { if (window.confirm("Chạy đồng bộ THẬT lên Supabase? Thao tác này sẽ ghi dữ liệu.")) void runSync(false); }} className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-200 disabled:opacity-50">Đồng bộ thật</button>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">Mỗi request chạy tối đa 1–20 batch và dùng process lock để tránh chạy đồng thời. Dry-run mặc định không ghi Supabase hoặc cập nhật checkpoint.</p>
    </Panel>
    {error && <ErrorNotice message={error} />}
    {loading && !status ? <LoadingNotice /> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Trạng thái sync" value={String(state.status ?? "CHƯA CÓ STATE")} tone={String(state.status).toUpperCase() === "SUCCESS" ? "good" : ["FAILED", "RETRYING"].includes(String(state.status).toUpperCase()) ? "bad" : "warn"} detail={`Tên tiến trình: ${status?.sync_name ?? "sqlite_to_supabase"}`} />
        <MetricCard label="Checkpoint trade ID" value={formatNumber(state.last_local_trade_id ?? 0)} detail="ID SQLite cuối được ghi nhận" />
        <MetricCard label="SQLite trades DB" value={sqlite.exists ? "Sẵn sàng" : "Không tìm thấy"} tone={sqlite.exists ? "good" : "bad"} detail={`${formatNumber(sqlite.size_bytes)} bytes`} />
        <MetricCard label="Supabase sync" value={supabase.enabled ? "Đã bật" : "Đang tắt"} tone={supabase.enabled && supabase.configured ? "good" : "warn"} detail={`Configured: ${supabase.configured ? "Có" : "Không"}`} />
      </div>
      <Panel title="Chi tiết trạng thái" description={`Cập nhật: ${formatDate(status?.checked_at)}`}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 p-3"><p className="text-xs text-slate-500">Lần sync thành công</p><p className="mt-1 text-sm text-slate-200">{formatDate(state.last_success_at)}</p></div>
          <div className="rounded-xl border border-white/10 p-3"><p className="text-xs text-slate-500">Lần thử gần nhất</p><p className="mt-1 text-sm text-slate-200">{formatDate(state.last_attempt_at)}</p></div>
          <div className="rounded-xl border border-white/10 p-3"><p className="text-xs text-slate-500">Nguồn</p><p className="mt-1 text-sm text-slate-200">{supabase.source ?? "—"}</p></div>
          <div className="rounded-xl border border-white/10 p-3"><p className="text-xs text-slate-500">SQLite path</p><p className="mt-1 break-all text-sm text-slate-200">{sqlite.path ?? "—"}</p></div>
        </div>
        {state.error_message && <p className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-sm text-rose-200">{state.error_message}</p>}
      </Panel>
    </>}
    {result && <Panel title="Kết quả lượt sync"><div className="mb-3 flex items-center gap-2"><StatusBadge value={result.ok ? "SUCCESS" : "FAILED"} /><span className="text-sm text-slate-400">{result.dry_run ? "DRY-RUN — không ghi dữ liệu" : "SYNC THẬT"}</span></div><pre className="max-h-96 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-300">{JSON.stringify(result, null, 2)}</pre></Panel>}
    <Panel title="Lịch sử sync" description="Đọc từ footprint_sync_runs; nếu bảng chưa tồn tại hoặc schema chưa sẵn sàng, backend sẽ báo lỗi.">
      {!runs?.items?.length ? <p className="text-sm text-slate-500">Chưa có lịch sử sync để hiển thị.</p> : <TableWrap><thead className="bg-slate-950/80 text-xs uppercase text-slate-400"><tr><th className="px-3 py-3">Thời gian</th><th className="px-3 py-3">Trạng thái</th><th className="px-3 py-3">Đọc</th><th className="px-3 py-3">Ghi</th><th className="px-3 py-3">Lỗi</th></tr></thead><tbody className="divide-y divide-white/5">{runs.items.map((row, i) => <tr key={String(row.id ?? i)}><td className="whitespace-nowrap px-3 py-3 text-slate-300">{formatDate(row.started_at ?? row.created_at ?? row.finished_at ?? row.updated_at)}</td><td className="px-3 py-3"><StatusBadge value={row.status ?? row.result ?? "UNKNOWN"} /></td><td className="px-3 py-3 text-slate-300">{formatNumber(row.read ?? row.rows_read ?? row.total_read)}</td><td className="px-3 py-3 text-slate-300">{formatNumber(row.upserted ?? row.inserted ?? row.rows_written)}</td><td className="px-3 py-3 text-slate-300">{formatNumber(row.failed ?? row.errors_count)}</td></tr>)}</tbody></TableWrap>}
    </Panel>
  </main>;
}
