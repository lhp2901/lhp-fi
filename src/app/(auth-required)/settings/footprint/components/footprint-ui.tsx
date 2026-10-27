"use client";
import type { ReactNode } from "react";

export function PageHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <header className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">FOOTPRINT ADMIN</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p></div>{action}</header>;
}
export function Panel({ title, description, children, action }: { title: string; description?: string; children: ReactNode; action?: ReactNode }) {
  return <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-sm sm:p-5"><div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold text-slate-100">{title}</h3>{description && <p className="mt-1 text-sm text-slate-400">{description}</p>}</div>{action}</div>{children}</section>;
}
export function StatusBadge({ value }: { value: unknown }) {
  const text = value === true ? "Có" : value === false ? "Không" : value == null || value === "" ? "Chưa xác định" : String(value).replaceAll("_", " ");
  const norm = String(value).toUpperCase();
  const tone = value === true || ["LIVE", "READY", "RUNNING", "CONNECTED", "AVAILABLE", "SUCCESS"].includes(norm) ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : ["ERROR", "DEGRADED", "CONFIG_ERROR", "FAILED", "UNAVAILABLE"].includes(norm) || value === false ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : "border-amber-500/30 bg-amber-500/10 text-amber-200";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>{text}</span>;
}
export function MetricCard({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail?: string; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const accent = tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-rose-300" : tone === "warn" ? "text-amber-200" : "text-white";
  return <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:p-5"><p className="text-sm text-slate-400">{label}</p><p className={`mt-3 break-words text-2xl font-semibold tracking-tight ${accent}`}>{value}</p>{detail && <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>}</div>;
}
export function ErrorNotice({ message }: { message: string }) { return <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm leading-6 text-rose-200"><strong className="block">Không tải được dữ liệu</strong><span>{message}</span></div>; }
export function LoadingNotice() { return <div className="rounded-xl border border-white/10 bg-slate-900/50 p-5 text-sm text-slate-400">Đang tải dữ liệu từ Python backend…</div>; }
export function EmptyNotice({ children }: { children: ReactNode }) { return <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm leading-6 text-slate-500">{children}</div>; }
export function RefreshButton({ onClick, loading }: { onClick: () => void; loading?: boolean }) { return <button type="button" onClick={onClick} disabled={loading} className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-wait disabled:opacity-50">{loading ? "Đang tải…" : "Làm mới"}</button>; }
export function TableWrap({ children }: { children: ReactNode }) { return <div className="overflow-x-auto rounded-xl border border-white/10"><table className="min-w-full divide-y divide-white/10 text-left text-sm">{children}</table></div>; }
export function UnsupportedFeature({ title, detail }: { title: string; detail: string }) { return <Panel title={title} description="Chưa có endpoint tương ứng trong routes.py hiện tại"><div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-6 text-amber-100"><strong className="block">Chưa kết nối API — chế độ an toàn</strong>{detail}<p className="mt-2 text-amber-200/70">Không có nút thao tác giả. Cần bổ sung endpoint Flask và xác thực/phân quyền trước khi kết nối.</p></div></Panel>; }
