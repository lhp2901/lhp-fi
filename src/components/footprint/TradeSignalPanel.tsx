
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
  referencePrice?: number | null;
}

export default function TradeSignalPanel({
  symbol,
  candle,
  profile,
  referencePrice,
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

    // Chỉ thông báo khi tín hiệu chuyển trạng thái.
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

    try {
      if (Notification.permission === "granted") {
        setNotificationsEnabled(true);
        setToast("Thông báo BUY/SELL đang bật.");
        return;
      }

      if (Notification.permission === "denied") {
        setNotificationsEnabled(false);
        setToast(
          "Trình duyệt đã chặn thông báo. Hãy cấp quyền thông báo trong cài đặt trình duyệt.",
        );
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission === "granted") {
        setNotificationsEnabled(true);
        setToast("Đã bật thông báo BUY/SELL.");
      } else {
        setNotificationsEnabled(false);
        setToast(
          "Chưa bật được thông báo. Hãy kiểm tra quyền thông báo của trình duyệt.",
        );
      }
    } catch {
      setNotificationsEnabled(false);
      setToast("Không thể bật thông báo trên trình duyệt này.");
    }
  }

  const colors = {
    BUY: {
      border: "border-emerald-500/50",
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      badge: "bg-emerald-500/20",
    },
    SELL: {
      border: "border-red-500/50",
      bg: "bg-red-500/10",
      text: "text-red-400",
      badge: "bg-red-500/20",
    },
    HOLD: {
      border: "border-amber-500/50",
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      badge: "bg-amber-500/20",
    },
  } as const;

  const style = colors[signal.action];

  const deltaColor =
    signal.delta > 0
      ? "text-emerald-400"
      : signal.delta < 0
        ? "text-red-400"
        : "text-slate-300";

  const deltaPercentColor =
    signal.deltaPercent > 0
      ? "text-emerald-400"
      : signal.deltaPercent < 0
        ? "text-red-400"
        : "text-slate-300";

  const closeColor =
    referencePrice != null &&
    Number.isFinite(referencePrice) &&
    referencePrice > 0
      ? signal.close > referencePrice
        ? "text-emerald-400"
        : signal.close < referencePrice
          ? "text-red-400"
          : "text-amber-400"
      : "text-amber-400";

  return (
    <section
      className={`relative rounded-xl border ${style.border} ${style.bg} p-4 text-white`}
    >
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200"
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
          className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
            notificationsEnabled
              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400"
              : "border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
          }`}
        >
          {notificationsEnabled
            ? "✓ ĐÃ BẬT THÔNG BÁO"
            : "🔔 BẬT THÔNG BÁO"}
        </button>
      </div>

      <div className={`rounded-lg ${style.badge} p-4`}>
        <div className={`text-xl font-extrabold ${style.text}`}>
          {signal.title}
        </div>

        <p className="mt-2 text-sm leading-6 text-slate-200">
          {signal.reason}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric
          label="Delta"
          value={formatSigned(signal.delta)}
          color={deltaColor}
        />

        <Metric
          label="Delta %"
          value={formatPercent(signal.deltaPercent)}
          color={deltaPercentColor}
        />

        <Metric
          label="POC"
          value={
            signal.poc !== null
              ? formatPrice(signal.poc)
              : "N/A"
          }
          color="text-amber-400"
        />

        <Metric
          label="Giá đóng cửa"
          value={formatPrice(signal.close)}
          color={closeColor}
          sub={
            referencePrice != null &&
            Number.isFinite(referencePrice) &&
            referencePrice > 0
              ? `Tham chiếu: ${formatPrice(referencePrice)}`
              : "Chưa có giá tham chiếu"
          }
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
  sub,
}: {
  label: string;
  value: string;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-700 bg-slate-950/80 p-3">
      <div className="text-xs font-medium text-slate-400">
        {label}
      </div>

      <div
        className={`mt-1 break-words text-sm font-extrabold tabular-nums ${color}`}
      >
        {value}
      </div>

      {sub && (
        <div className="mt-1 text-[10px] text-slate-500">
          {sub}
        </div>
      )}
    </div>
  );
}

function formatNumber(value: number) {
  return Number.isFinite(value)
    ? value.toLocaleString("vi-VN", {
        maximumFractionDigits: 4,
      })
    : "N/A";
}

function formatSigned(value: number) {
  if (!Number.isFinite(value)) return "N/A";

  const scaledValue = value * 10;

  return `${scaledValue > 0 ? "+" : ""}${scaledValue.toLocaleString(
    "vi-VN",
    {
      maximumFractionDigits: 0,
    },
  )}`;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "N/A";

  const percent = value * 100;

  return `${percent > 0 ? "+" : ""}${percent.toLocaleString(
    "vi-VN",
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    },
  )}%`;
}

function formatPrice(value: number) {
  if (!Number.isFinite(value)) return "N/A";

  return value.toLocaleString("vi-VN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

