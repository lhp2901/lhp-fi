"use client";

import { useEffect, useRef, useState } from "react";

import {
  calculateTradeSignal,
  type FootprintLevel,
  type SignalCandle,
  type TradeSignal,
} from "@/lib/footprint/trade-signal";

interface Props {
  symbol: string;
  candle?: SignalCandle;
  profile: FootprintLevel[];
}

export default function TradeSignalPanel({
  symbol,
  candle,
  profile,
}: Props) {
  const [notificationsEnabled, setNotificationsEnabled] =
    useState(false);

  const [toast, setToast] = useState<string | null>(null);

  const previousSignal = useRef<string | null>(null);
  const [signal, setSignal] = useState<TradeSignal>(() =>
    calculateTradeSignal(candle, profile),
  );

  useEffect(() => {
    const nextSignal = calculateTradeSignal(candle, profile);

    setSignal(nextSignal);

    // Chỉ thông báo khi tín hiệu chuyển sang BUY hoặc SELL.
    const signalKey = `${symbol}:${nextSignal.action}`;

    if (previousSignal.current === null) {
      previousSignal.current = signalKey;
      return;
    }

    if (previousSignal.current === signalKey) {
      return;
    }

    previousSignal.current = signalKey;

    if (nextSignal.action === "HOLD") {
      setToast(null);
      return;
    }

    const message =
      `${symbol}: ${nextSignal.title}. ` +
      `${nextSignal.reason}`;

    setToast(message);

    if (
      notificationsEnabled &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      new Notification(`${symbol} — ${nextSignal.action}`, {
        body: message,
      });
    }

    const timeout = window.setTimeout(() => {
      setToast(null);
    }, 8000);

    return () => window.clearTimeout(timeout);
  }, [symbol, candle, profile, notificationsEnabled]);

  async function enableNotifications() {
    if (
      typeof window === "undefined" ||
      !("Notification" in window)
    ) {
      setToast("Trình duyệt không hỗ trợ thông báo.");
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      setNotificationsEnabled(true);
      setToast("Đã bật thông báo BUY/SELL.");
    } else {
      setNotificationsEnabled(false);
      setToast(
        "Thông báo bị từ chối. Hãy kiểm tra quyền thông báo của trình duyệt.",
      );
    }
  }

  const colors = {
    BUY: {
      border: "border-emerald-500/40",
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      badge: "bg-emerald-500/20",
    },
    SELL: {
      border: "border-red-500/40",
      bg: "bg-red-500/10",
      text: "text-red-400",
      badge: "bg-red-500/20",
    },
    HOLD: {
      border: "border-amber-500/40",
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      badge: "bg-amber-500/20",
    },
  } as const;

  const style = colors[signal.action];

  return (
    <section
      className={`relative rounded-xl border ${style.border} ${style.bg} p-4 text-white`}
    >
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm"
        >
          {toast}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
            Footprint signal
          </p>

          <h2 className="mt-1 text-lg font-bold">
            {symbol}
          </h2>
        </div>

        <button
          type="button"
          onClick={enableNotifications}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold hover:bg-slate-800"
        >
          {notificationsEnabled
            ? "✓ Đã bật thông báo"
            : "Bật thông báo"}
        </button>
      </div>

      <div className={`rounded-lg ${style.badge} p-4`}>
        <div className={`text-xl font-extrabold ${style.text}`}>
          {signal.title}
        </div>

        <p className="mt-2 text-sm leading-6 text-slate-300">
          {signal.reason}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric
          label="Delta"
          value={formatNumber(signal.delta)}
          color={
            signal.delta > 0
              ? "text-emerald-400"
              : signal.delta < 0
                ? "text-red-400"
                : "text-slate-300"
          }
        />

        <Metric
          label="Delta %"
          value={`${(signal.deltaPercent * 100).toFixed(1)}%`}
          color={
            signal.deltaPercent > 0
              ? "text-emerald-400"
              : signal.deltaPercent < 0
                ? "text-red-400"
                : "text-slate-300"
          }
        />

        <Metric
          label="POC"
          value={
            signal.poc !== null
              ? formatNumber(signal.poc)
              : "N/A"
          }
        />

        <Metric
          label="Giá đóng cửa"
          value={formatNumber(signal.close)}
        />
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Tín hiệu được tính từ dữ liệu đang có. Đây không phải
        khuyến nghị đầu tư; cần kiểm tra chất lượng dữ liệu và
        xác nhận thêm trước khi giao dịch.
      </p>
    </section>
  );
}

function Metric({
  label,
  value,
  color = "text-white",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 break-words text-sm font-bold ${color}`}>
        {value}
      </div>
    </div>
  );
}

function formatNumber(value: number) {
  return Number.isFinite(value)
    ? value.toLocaleString("en-US", {
        maximumFractionDigits: 4,
      })
    : "N/A";
}