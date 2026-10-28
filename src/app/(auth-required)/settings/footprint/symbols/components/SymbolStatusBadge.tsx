import type { StreamStatus } from "../types";

const styles: Record<string, string> = {
  live: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  connecting: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  offline: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  unknown: "border-slate-500/30 bg-slate-500/10 text-slate-400",
};

export function Badge({ children, tone = "unknown" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone] || styles.unknown}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${tone === "live" ? "bg-emerald-400" : tone === "connecting" ? "bg-amber-300" : "bg-slate-500"}`} />
    {children}
  </span>;
}

export function StreamBadge({ status }: { status: StreamStatus }) {
  const labels = { live: "Live", connecting: "Đang kết nối", offline: "Offline", unknown: "Chưa rõ" };
  return <Badge tone={status}>{labels[status]}</Badge>;
}
