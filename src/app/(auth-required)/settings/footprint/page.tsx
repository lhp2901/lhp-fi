"use client";

import { useCallback, useEffect, useState } from "react";
import {
  footprintApi,
  type FootprintHealth,
  type FootprintStreamStatus,
  type FootprintSymbols,
} from "@/lib/footprint-api";

type LoadState = "loading" | "success" | "error";

function formatDate(value?: string) {
  if (!value) return "Chưa có dữ liệu";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

function statusLabel(value?: string | boolean | null) {
  if (value === true) return "Có";
  if (value === false) return "Không";
  if (!value) return "Chưa xác định";
  const normalized = String(value).toUpperCase();
  const labels: Record<string, string> = {
    LIVE: "LIVE",
    READY: "Sẵn sàng",
    DEGRADED: "Có vấn đề",
    CONFIG_ERROR: "Lỗi cấu hình",
    RUNNING: "Đang chạy",
    STOPPED: "Đã dừng",
    CONNECTED: "Đã kết nối",
    UNAVAILABLE: "Không khả dụng",
    AVAILABLE: "Khả dụng",
    ERROR: "Lỗi",
    UNKNOWN: "Chưa xác định",
  };
  return labels[normalized] || String(value);
}

function statusTone(value?: string | boolean | null) {
  const normalized = String(value).toUpperCase();
  if (value === true || ["LIVE", "READY", "RUNNING", "CONNECTED", "AVAILABLE"].includes(normalized)) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (["DEGRADED", "CONFIG_ERROR", "ERROR"].includes(normalized)) {
    return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  }
  if (["STOPPED", "UNAVAILABLE", "UNKNOWN", "FALSE"].includes(normalized) || value === false) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }
  return "border-white/10 bg-white/5 text-slate-300";
}

function StatusBadge({ value }: { value?: string | boolean | null }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(value)}`}>
      {statusLabel(value)}
    </span>
  );
}

function MetricCard({
  title,
  value,
  detail,
  status,
}: {
  title: string;
  value: string;
  detail: string;
  status?: string | boolean | null;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-400">{title}</p>
        {status !== undefined && <StatusBadge value={status} />}
      </div>
      <p className="mt-4 break-words text-2xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-white/5 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-sm text-slate-400">{label}</span>
      <div className="text-sm text-slate-200 sm:text-right">{value}</div>
    </div>
  );
}

export default function FootprintOverviewPage() {
  const [health, setHealth] = useState<FootprintHealth | null>(null);
  const [symbols, setSymbols] = useState<FootprintSymbols | null>(null);
  const [stream, setStream] = useState<FootprintStreamStatus | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage(null);
    const results = await Promise.allSettled([
      footprintApi.health(),
      footprintApi.symbols(),
      footprintApi.streamStatus(),
    ]);

    const healthResult = results[0];
    const symbolsResult = results[1];
    const streamResult = results[2];

    if (healthResult.status === "fulfilled") {
      setHealth(healthResult.value.data ?? null);
    } else {
      setHealth(null);
    }
    if (symbolsResult.status === "fulfilled") {
      setSymbols(symbolsResult.value.data ?? null);
    } else {
      setSymbols(null);
    }
    if (streamResult.status === "fulfilled") {
      setStream(streamResult.value.data ?? null);
    } else {
      setStream(null);
    }

    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length === results.length) {
      const first = failures[0];
      setErrorMessage(first.status === "rejected" ? first.reason?.message || "Không thể tải dữ liệu Footprint." : null);
      setLoadState("error");
    } else {
      if (failures.length > 0) {
        setErrorMessage(`${failures.length} trong 3 API không phản hồi thành công. Một số thông tin có thể chưa hiển thị.`);
      }
      setLoadState("success");
    }
    setLastChecked(new Date().toISOString());
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const streamData = stream?.stream ?? health?.stream ?? {};
  const storageData = stream?.storage ?? health?.storage ?? {};
  const engineData = stream?.engine ?? health?.engine ?? {};
  const serviceStatus = health?.status;
  const streamRunning = health?.stream_running ?? (streamData.running === true);
  const storageAvailable = health?.storage_available ?? (storageData.available === true);
  const symbolCount = symbols?.count ?? symbols?.engine_symbols?.length;
  const configErrors = health?.config_errors ?? [];

  return (
    <main className="min-h-full space-y-6 bg-slate-950 p-4 text-slate-100 sm:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            <span className="h-2 w-2 rounded-full bg-cyan-400" /> LHP-FI / Settings / Footprint
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Footprint Control Center</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Theo dõi Python API, DNSE stream, Footprint Engine và trạng thái lưu trữ từ backend.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-slate-500">Tự làm mới mỗi 15 giây</span>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loadState === "loading"}
            className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20 disabled:cursor-wait disabled:opacity-50"
          >
            {loadState === "loading" ? "Đang kiểm tra…" : "Làm mới dữ liệu"}
          </button>
        </div>
      </header>

      {errorMessage && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${loadState === "error" ? "border-rose-500/30 bg-rose-500/10 text-rose-200" : "border-amber-500/30 bg-amber-500/10 text-amber-100"}`}>
          <p className="font-semibold">{loadState === "error" ? "Không kết nối được Footprint API" : "Một phần dữ liệu chưa tải được"}</p>
          <p className="mt-1 break-words">{errorMessage}</p>
          <p className="mt-2 text-xs opacity-80">API mặc định: http://localhost:10000. Có thể đổi bằng biến môi trường NEXT_PUBLIC_LHP_API_URL.</p>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Footprint API"
          value={health?.api_available ? "Đang phản hồi" : loadState === "loading" ? "Đang kiểm tra…" : "Chưa xác nhận"}
          detail={health?.service || "GET /api/footprint/health"}
          status={health?.api_available}
        />
        <MetricCard
          title="DNSE Stream"
          value={statusLabel(streamRunning)}
          detail={String(streamData.connection_state || streamData.status || "Trạng thái từ stream/status")}
          status={streamRunning}
        />
        <MetricCard
          title="Footprint Engine"
          value={health?.engine_available ? "Khả dụng" : engineData.status ? statusLabel(String(engineData.status)) : "Chưa xác nhận"}
          detail="Trạng thái do Python backend trả về"
          status={health?.engine_available}
        />
        <MetricCard
          title="SQLite Storage"
          value={statusLabel(storageAvailable)}
          detail={String(storageData.backend || "SQLite") + (storageData.persistent === true ? " · lưu trữ bền vững" : "")}
          status={storageAvailable}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Trạng thái hệ thống</h2>
              <p className="mt-1 text-sm text-slate-400">Thông tin lấy trực tiếp từ các endpoint Footprint hiện có.</p>
            </div>
            <StatusBadge value={serviceStatus} />
          </div>
          <div className="mt-4">
            <DetailRow label="Trạng thái dịch vụ" value={<StatusBadge value={serviceStatus} />} />
            <DetailRow label="Cấu hình Footprint" value={<StatusBadge value={health?.config_valid} />} />
            <DetailRow label="DNSE stream khả dụng" value={<StatusBadge value={health?.stream_available} />} />
            <DetailRow label="Stream đang chạy" value={<StatusBadge value={health?.stream_running} />} />
            <DetailRow label="Engine khả dụng" value={<StatusBadge value={health?.engine_available} />} />
            <DetailRow label="SQLite khả dụng" value={<StatusBadge value={health?.storage_available} />} />
            <DetailRow label="Kiểm tra backend lúc" value={formatDate(health?.checked_at)} />
            <DetailRow label="Frontend kiểm tra lúc" value={formatDate(lastChecked || undefined)} />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Mã chứng khoán</h2>
          <p className="mt-1 text-sm text-slate-400">Danh sách cấu hình và mã đã đăng ký trong Engine.</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/5 bg-slate-950/70 p-4">
              <p className="text-xs text-slate-500">Tổng mã trong Engine</p>
              <p className="mt-2 text-3xl font-semibold text-white">{symbolCount ?? "—"}</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-slate-950/70 p-4">
              <p className="text-xs text-slate-500">Mã cấu hình</p>
              <p className="mt-2 text-3xl font-semibold text-white">{symbols?.configured_symbols?.length ?? "—"}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(symbols?.engine_symbols ?? []).slice(0, 24).map((symbol) => (
              <span key={symbol} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-200">{symbol}</span>
            ))}
            {symbols && (symbols.engine_symbols ?? []).length === 0 && (
              <p className="text-sm text-slate-500">Backend chưa trả về mã nào đã đăng ký.</p>
            )}
            {!symbols && <p className="text-sm text-slate-500">Chưa tải được danh sách mã.</p>}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Cấu hình cần chú ý</h2>
          <p className="mt-1 text-sm text-slate-400">Các lỗi cấu hình được backend trả về, không suy đoán từ frontend.</p>
          {configErrors.length ? (
            <ul className="mt-4 space-y-2">
              {configErrors.map((item, index) => <li key={`${item}-${index}`} className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm text-amber-100">{item}</li>)}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl border border-white/5 bg-slate-950/60 p-4 text-sm text-slate-300">
              {health?.config_valid === true ? "Backend báo cấu hình hợp lệ tại lần kiểm tra gần nhất." : "Chưa có thông tin xác nhận cấu hình hoặc API chưa trả dữ liệu."}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Thông tin tích hợp</h2>
          <p className="mt-1 text-sm text-slate-400">Các endpoint chỉ đọc đang được dashboard sử dụng.</p>
          <div className="mt-4">
            <DetailRow label="Health check" value={<code className="text-cyan-200">GET /api/footprint/health</code>} />
            <DetailRow label="Danh sách mã" value={<code className="text-cyan-200">GET /api/footprint/symbols</code>} />
            <DetailRow label="Stream status" value={<code className="text-cyan-200">GET /api/footprint/stream/status</code>} />
            <DetailRow label="API base URL" value={<code className="break-all text-cyan-200">{process.env.NEXT_PUBLIC_LHP_API_URL || "http://localhost:10000"}</code>} />
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">Dashboard hiện chỉ gọi GET để đọc trạng thái. Chưa tự khởi động/dừng stream và chưa ghi/xóa dữ liệu.</p>
        </div>
      </section>
    </main>
  );
}
