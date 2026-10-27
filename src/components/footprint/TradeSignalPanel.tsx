"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

type SignalAction = TradeSignal["action"];

const SIGNAL_COLORS: Record<
  SignalAction,
  {
    border: string;
    background: string;
    text: string;
    badge: string;
  }
> = {
  BUY: {
    border: "border-emerald-500/50",
    background: "bg-emerald-500/10",
    text: "text-emerald-400",
    badge: "bg-emerald-500/20",
  },
  SELL: {
    border: "border-red-500/50",
    background: "bg-red-500/10",
    text: "text-red-400",
    badge: "bg-red-500/20",
  },
  HOLD: {
    border: "border-amber-500/50",
    background: "bg-amber-500/10",
    text: "text-amber-400",
    badge: "bg-amber-500/20",
  },
};

function isValidNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatNumber(value: number): string {
  if (!isValidNumber(value)) return "N/A";

  return value.toLocaleString("vi-VN", {
    maximumFractionDigits: 4,
  });
}

/**
 * Chỉ thay đổi cách hiển thị:
 * 110 -> +1.100
 * -110 -> -1.100
 *
 * Không sử dụng giá trị đã nhân 10 để tính tín hiệu.
 */
function formatSigned(value: number): string {
  if (!isValidNumber(value)) return "N/A";

  const scaledValue = value * 10;

  const formatted = Math.abs(scaledValue).toLocaleString("vi-VN", {
    maximumFractionDigits: 0,
  });

  if (scaledValue > 0) return `+${formatted}`;
  if (scaledValue < 0) return `-${formatted}`;

  return "0";
}

function formatPercent(value: number): string {
  if (!isValidNumber(value)) return "N/A";

  const percent = value * 100;
  const formatted = Math.abs(percent).toLocaleString("vi-VN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  if (percent > 0) return `+${formatted}%`;
  if (percent < 0) return `-${formatted}%`;

  return "0,0%";
}

function formatPrice(value: number): string {
  if (!isValidNumber(value)) return "N/A";

  return value.toLocaleString("vi-VN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function getValueColor(value: number): string {
  if (!isValidNumber(value)) return "text-slate-400";

  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-red-400";

  return "text-slate-300";
}

function isValidReferencePrice(
  value: number | null | undefined,
): value is number {
  return (
    value != null &&
    Number.isFinite(value) &&
    value > 0
  );
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

  const previousSignal = useRef<{
    symbol: string;
    action: SignalAction;
  } | null>(null);

  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const [signal, setSignal] = useState<TradeSignal>(() =>
    calculateTradeSignal(candle, profile),
  );

  const showToast = useCallback((message: string) => {
    setToast(message);

    if (toastTimeout.current !== null) {
      clearTimeout(toastTimeout.current);
    }

    toastTimeout.current = setTimeout(() => {
      setToast(null);
      toastTimeout.current = null;
    }, 8000);
  }, []);

  // Đồng bộ quyền thông báo khi người dùng quay lại trang.
  useEffect(() => {
    function syncNotificationPermission() {
      if (
        typeof window !== "undefined" &&
        "Notification" in window
      ) {
        setNotificationsEnabled(
          Notification.permission === "granted",
        );
      } else {
        setNotificationsEnabled(false);
      }
    }

    syncNotificationPermission();

    window.addEventListener("focus", syncNotificationPermission);

    return () => {
      window.removeEventListener(
        "focus",
        syncNotificationPermission,
      );
    };
  }, []);

  // Dọn bộ đếm thời gian khi component bị tháo.
  useEffect(() => {
    return () => {
      if (toastTimeout.current !== null) {
        clearTimeout(toastTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    const nextSignal = calculateTradeSignal(candle, profile);

    setSignal(nextSignal);

    const previous = previousSignal.current;

    // Lần đầu tải dữ liệu chỉ ghi nhận trạng thái,
    // không phát thông báo BUY/SELL ngay lập tức.
    if (previous === null) {
      previousSignal.current = {
        symbol,
        action: nextSignal.action,
      };

      return;
    }

    // Đổi mã cổ phiếu: ghi nhận trạng thái mới,
    // không coi đó là một tín hiệu chuyển trạng thái.
    if (previous.symbol !== symbol) {
      previousSignal.current = {
        symbol,
        action: nextSignal.action,
      };

      setToast(null);
      return;
    }

    // Chỉ thông báo khi trạng thái BUY/SELL thay đổi.
    if (previous.action === nextSignal.action) {
      return;
    }

    previousSignal.current = {
      symbol,
      action: nextSignal.action,
    };

    // Khi tín hiệu chuyển về HOLD, không phát cảnh báo giao dịch.
    if (nextSignal.action === "HOLD") {
      setToast(null);
      return;
    }

    const message =
      `${symbol}: ${nextSignal.title}. ${nextSignal.reason}`;

    showToast(message);

    if (
      notificationsEnabled &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification(
          `${symbol} — ${nextSignal.action}`,
          {
            body: message,
          },
        );
      } catch {
        // Không để lỗi Notification làm gián đoạn giao diện.
      }
    }
  }, [
    symbol,
    candle,
    profile,
    notificationsEnabled,
    showToast,
  ]);

  async function enableNotifications() {
    if (
      typeof window === "undefined" ||
      !("Notification" in window)
    ) {
      showToast("Trình duyệt này không hỗ trợ thông báo.");
      return;
    }

    try {
      if (Notification.permission === "granted") {
        setNotificationsEnabled(true);
        showToast("Thông báo BUY/SELL đang bật.");
        return;
      }

      if (Notification.permission === "denied") {
        setNotificationsEnabled(false);

        showToast(
          "Thông báo đang bị chặn. Hãy cấp quyền trong cài đặt trình duyệt.",
        );

        return;
      }

      const permission = await Notification.requestPermission();

      const enabled = permission === "granted";

      setNotificationsEnabled(enabled);

      showToast(
        enabled
          ? "Đã bật thông báo BUY/SELL."
          : "Chưa bật được thông báo. Hãy kiểm tra quyền trình duyệt.",
      );
    } catch {
      setNotificationsEnabled(false);

      showToast(
        "Không thể bật thông báo trên trình duyệt này.",
      );
    }
  }

  const style = SIGNAL_COLORS[signal.action];

  const deltaColor = getValueColor(signal.delta);

  const deltaPercentColor = getValueColor(signal.deltaPercent);

  const hasReferencePrice =
    isValidReferencePrice(referencePrice);

  const closeColor = hasReferencePrice
    ? signal.close > referencePrice
      ? "text-emerald-400"
      : signal.close < referencePrice
        ? "text-red-400"
        : "text-amber-400"
    : "text-amber-400";

  const referenceSub = hasReferencePrice
    ? `Tham chiếu: ${formatPrice(referencePrice)}`
    : "Chưa có giá tham chiếu";

  return (
    <section
      aria-label={`Tín hiệu Footprint ${symbol}`}
      className={`relative min-w-0 rounded-xl border ${style.border} ${style.background} p-4 text-white`}
    >
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm leading-6 text-slate-100"
        >
          {toast}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Footprint Signal
          </p>

          <h2 className="mt-1 text-lg font-bold text-white">
            {symbol}
          </h2>
        </div>

        <button
          type="button"
          onClick={enableNotifications}
          aria-pressed={notificationsEnabled}
          className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 ${
            notificationsEnabled
              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
              : "border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
          }`}
        >
          {notificationsEnabled
            ? "✓ ĐÃ BẬT THÔNG BÁO"
            : "🔔 BẬT THÔNG BÁO"}
        </button>
      </div>

      <div className={`rounded-lg ${style.badge} p-4`}>
        <div
          className={`text-xl font-extrabold ${style.text}`}
        >
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
          sub="Hiển thị ×10"
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
          sub={referenceSub}
        />
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-400">
        Tín hiệu được tính từ dữ liệu hiện có. Đây không phải
        khuyến nghị đầu tư. Cần xác nhận dữ liệu và quản trị rủi
        ro trước khi giao dịch.
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
      <div className="text-xs font-semibold text-slate-400">
        {label}
      </div>

      <div
        className={`mt-1 break-words text-sm font-extrabold tabular-nums ${color}`}
      >
        {value}
      </div>

      {sub && (
        <div className="mt-1 break-words text-[10px] leading-4 text-slate-400">
          {sub}
        </div>
      )}
    </div>
  );
}

