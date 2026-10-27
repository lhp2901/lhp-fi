"use client";

import { useCallback, useEffect, useState } from "react";
import { footprintAdminRequest, getErrorMessage, formatDate, formatNumber } from "@/lib/footprint-api";
import { PageHeading, Panel, MetricCard, ErrorNotice, LoadingNotice, RefreshButton, StatusBadge } from "../components/footprint-ui";

type RetentionData = { inspection?: Record<string, any>; plan?: Record<string, any>; [key: string]: any };

export default function RetentionPage() {
  const [token, setToken] = useState("");
  const [days, setDays] = useState("90");
  const [symbols, setSymbols] = useState("");
  const [data, setData] = useState<RetentionData | null>(null);
  const [preview, setPreview] = useState<Record<string, any> | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const query = () => `?days=${encodeURIComponent(days)}${symbols.trim() ? `&symbols=${encodeURIComponent(symbols.trim())}` : ""}`;

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [i, p] = await Promise.all([
        footprintAdminRequest<RetentionData>(`/api/footprint/retention/inspect${query()}`, { token }),
        footprintAdminRequest<Record<string, any>>(`/api/footprint/retention/preview${query()}`, { token }),
      ]);
      setData(i.data ?? null); setPreview(p.data ?? null);
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setLoading(false); }
  // query values are captured from the current form values; the callback is refreshed on every relevant change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, days, symbols]);

  const execute = async () => {
    if (confirmText !== "XOA DU LIEU FOOTPRINT") { setError("Nhập đúng cụm XOA DU LIEU FOOTPRINT để xác nhận."); return; }
    if (!window.confirm("CẢNH BÁO: Thao tác sẽ xóa vĩnh viễn các trade cũ khỏi SQLite local. Đã xem preview và hiểu rủi ro?")) return;
    setExecuting(true); setError("");
    try {
      const r = await footprintAdminRequest<Record<string, any>>("/api/footprint/retention/execute", {
        token, method: "POST", body: { days: Number(days), symbols, confirm: confirmText },
      });
      setPreview(r.data ?? null); setConfirmText(""); await refresh();
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setExecuting(false); }
  };

  useEffect(() => { void refresh(); }, [refresh]);
  const info = data?.inspection ?? {};
  const plan = preview?.plan ?? data?.plan ?? preview ?? {};
  return <main className="space-y-6">
    <PageHeading title="Retention" description="Kiểm tra thời gian lưu và xem trước dữ liệu SQLite sẽ bị ảnh hưởng. Supabase không bị xóa bởi module retention này." action={<RefreshButton onClick={() => void refresh()} loading={loading} />} />
    <Panel title="Chính sách lưu trữ" description="Preview luôn chạy ở chế độ chỉ đọc. Xóa thật chỉ được phép sau khi backup thành công và xác nhận rõ ràng.">
      <div className="grid gap-3 md:grid-cols-3 md:items-end">
        <label className="block text-sm text-slate-300">Admin token<input value={token} onChange={e => setToken(e.target.value)} type="password" autoComplete="off" className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white" placeholder="FOOTPRINT_CONTROL_TOKEN" /></label>
        <label className="block text-sm text-slate-300">Giữ dữ liệu (ngày)<input type="number" min={1} max={3650} value={days} onChange={e => setDays(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white" /></label>
        <label className="block text-sm text-slate-300">Lọc symbol (tùy chọn)<input value={symbols} onChange={e => setSymbols(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white" placeholder="FPT,HPG,SSI" /></label>
      </div>
      <div className="mt-4 flex flex-wrap gap-3"><button disabled={loading || executing} onClick={() => void refresh()} className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-200 disabled:opacity-50">Tạo preview</button><StatusBadge value="DRY RUN — KHÔNG XÓA" /></div>
    </Panel>
    {error && <ErrorNotice message={error} />}
    {loading && !data ? <LoadingNotice /> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Bảng SQLite" value={info.exists ? "Tồn tại" : "Không có"} tone={info.exists ? "good" : "bad"} detail={info.table_name ?? "footprint_trades"} />
        <MetricCard label="Tổng giao dịch" value={formatNumber(info.row_count ?? plan.total_rows)} />
        <MetricCard label="Dự kiến xóa" value={formatNumber(plan.rows_to_delete)} tone={Number(plan.rows_to_delete) > 0 ? "warn" : "good"} detail="Chỉ local SQLite" />
        <MetricCard label="Dự kiến giữ lại" value={formatNumber(plan.rows_to_keep)} detail={`${days} ngày retention`} />
      </div>
      <Panel title="Thông tin lưu trữ">
        <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-white/10 p-3"><p className="text-xs text-slate-500">Giao dịch cũ nhất</p><p className="mt-1 text-sm text-slate-200">{formatDate(info.oldest_time)}</p></div><div className="rounded-xl border border-white/10 p-3"><p className="text-xs text-slate-500">Giao dịch mới nhất</p><p className="mt-1 text-sm text-slate-200">{formatDate(info.newest_time)}</p></div><div className="rounded-xl border border-white/10 p-3"><p className="text-xs text-slate-500">Kích thước DB</p><p className="mt-1 text-sm text-slate-200">{formatNumber(info.database_size_bytes)} bytes</p></div><div className="rounded-xl border border-white/10 p-3"><p className="text-xs text-slate-500">Cutoff UTC</p><p className="mt-1 text-sm text-slate-200">{formatDate(plan.cutoff_time)}</p></div></div>
      </Panel>
      <Panel title="Xóa dữ liệu cũ — thao tác nguy hiểm" description="Không chạy xóa nếu chưa kiểm tra kỹ số lượng dự kiến và đảm bảo còn đủ dung lượng cho bản backup.">
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm leading-6 text-rose-100"><strong className="block">Backup bắt buộc</strong>Backend luôn tạo SQLite backup trước khi xóa. Nếu backup thất bại, thao tác sẽ dừng. Xóa chỉ áp dụng trên SQLite local, không xóa Supabase.</div>
        <label className="mt-4 block text-sm text-slate-300">Nhập chính xác <code className="text-rose-200">XOA DU LIEU FOOTPRINT</code> để mở khóa
          <input value={confirmText} onChange={e => setConfirmText(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white" placeholder="XOA DU LIEU FOOTPRINT" />
        </label>
        <button disabled={executing || loading || confirmText !== "XOA DU LIEU FOOTPRINT" || Number(plan.rows_to_delete) <= 0} onClick={() => void execute()} className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 disabled:cursor-not-allowed disabled:opacity-40">{executing ? "Đang backup và dọn dữ liệu…" : "Backup và xóa dữ liệu cũ"}</button>
      </Panel>
    </>}
  </main>;
}
