
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  calculateTradeSignal,
  type FootprintLevel,
  type SignalCandle,
  type SignalConfidence,
  type SignalAction,
  type TradeSignal,
} from "@/lib/footprint/trade-signal";

interface Props {
  symbol: string;
  candle?: SignalCandle;
  profile: FootprintLevel[];
}

type ToastType = "success" | "warning" | "error" | "info";

type ToastMessage = {
  id: number;
  message: string;
  type: ToastType;
};

type NotificationPermissionState =
  | "unsupported"
  | "default"
  | "granted"
  | "denied";

type SignalStyle = {
  border: string;
  background: string;
  panel: string;
  text: string;
  badge: string;
  dot: string;
  label: string;
};

const SIGNAL_STYLES: Record<SignalAction, SignalStyle> = {
  BUY: {
    border: "border-emerald-500/40",
    background: "bg-emerald-500/[0.07]",
    panel: "bg-emerald-500/10",
    text: "text-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-400",
    dot: "bg-emerald-400",
    label: "TÍN HIỆU MUA",
  },

  SELL: {
    border: "border-rose-500/40",
    background: "bg-rose-500/[0.07]",
    panel: "bg-rose-500/10",
    text: "text-rose-400",
    badge: "bg-rose-500/15 text-rose-400",
    dot: "bg-rose-400",
    label: "TÍN HIỆU BÁN",
  },

  HOLD: {
    border: "border-amber-500/30",
    background: "bg-slate-900/80",
    panel: "bg-amber-500/[0.07]",
    text: "text-amber-400",
    badge: "bg-amber-500/15 text-amber-400",
    dot: "bg-amber-400",
    label: "THEO DÕI THỊ TRƯỜNG",
  },
};

const TOAST_STYLES: Record<ToastType, string> = {
  success: "border-emerald-500/30 bg-emerald-500/10",
  warning: "border-amber-500/30 bg-amber-500/10",
  error: "border-rose-500/30 bg-rose-500/10",
  info: "border-sky-500/30 bg-sky-500/10",
};

const CONFIDENCE_STYLES: Record<SignalConfidence, string> = {
  LOW: "border-slate-700 bg-slate-800/70 text-slate-300",
  MEDIUM: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  HIGH: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
};

function getNotificationPermission(): NotificationPermissionState {
  if (
    typeof window === "undefined" ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }

  return Notification.permission;
}

function formatNumber(
  value: number | null | undefined,
): string {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "N/A";
  }

  return value.toLocaleString("vi-VN", {
    maximumFractionDigits: 4,
  });
}

function formatDelta(value: number): string {
  if (!Number.isFinite(value)) return "—";

  return (value * 10).toLocaleString("vi-VN", {
    maximumFractionDigits: 0,
  });
}

function formatPercent(
  value: number | null | undefined,
): string {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "N/A";
  }

  return `${(value * 100).toLocaleString("vi-VN", {
    maximumFractionDigits: 2,
  })}%`;
}

function getDeltaColor(value: number): string {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-rose-400";
  return "text-slate-300";
}

function isValidCandle(
  candle: SignalCandle | undefined,
): boolean {
  if (!candle) return false;

  const { open, high, low, close, volume } = candle;

  if (
    !Number.isFinite(open) ||
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    !Number.isFinite(close) ||
    !Number.isFinite(volume)
  ) {
    return false;
  }

  if (
    open <= 0 ||
    high <= 0 ||
    low <= 0 ||
    close <= 0 ||
    volume < 0
  ) {
    return false;
  }

  return (
    high >= low &&
    high >= open &&
    high >= close &&
    low <= open &&
    low <= close
  );
}

function getConfidenceLabel(
  confidence: SignalConfidence,
): string {
  switch (confidence) {
    case "HIGH":
      return "CAO";

    case "MEDIUM":
      return "TRUNG BÌNH";

    default:
      return "THẤP";
  }
}

function getActionLabel(action: SignalAction): string {
  switch (action) {
    case "BUY":
      return "BUY";

    case "SELL":
      return "SELL";

    default:
      return "HOLD";
  }
}

function Metric({
  label,
  value,
  color = "text-white",
  description,
}: {
  label: string;
  value: string;
  color?: string;
  description?: string;
}) {
  return (
      <div
        className={`min-w-0 rounded-lg border p-3 ${
          label === "POC"
            ? "border-amber-500/30 bg-amber-500/[0.06]"
            : label === "Giá đóng cửa"
              ? "border-sky-500/30 bg-sky-500/[0.06]"
              : "border-slate-800/90 bg-slate-950/70"
        }`}
      >
      <span className="text-xs font-medium text-slate-500">
        {label}
      </span>

      <div
        className={`mt-2 break-words text-sm font-bold tabular-nums ${color}`}
      >
        {value}
      </div>

      {description && (
        <p className="mt-1 text-[10px] leading-4 text-slate-500">
          {description}
        </p>
      )}
    </div>
  );
}

export default function TradeSignalPanel({
  symbol,
  candle,
  profile,
}: Props) {
  const normalizedSymbol =
    symbol.trim().toUpperCase() || "N/A";

  const [notificationsEnabled, setNotificationsEnabled] =
    useState(false);

  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>("default");

  const [toast, setToast] = useState<ToastMessage | null>(
    null,
  );

  const toastTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const toastIdRef = useRef(0);

  const previousSignalRef = useRef<{
    symbol: string;
    action: SignalAction;
  } | null>(null);

  const previousNotificationEnabledRef = useRef(false);

  /**
   * Tính tín hiệu đồng bộ với dữ liệu đầu vào.
   * Không cần lưu signal vào state riêng.
   */
  const signal = useMemo<TradeSignal>(() => {
    try {
      return calculateTradeSignal(candle, profile);
    } catch (error) {
      console.error(
        `[TradeSignalPanel] Cannot calculate signal for ${normalizedSymbol}:`,
        error,
      );

      return {
        action: "HOLD",
        title: "HOLD — TIẾP TỤC QUAN SÁT",
        reason:
          "Không thể tính tín hiệu. Vui lòng kiểm tra dữ liệu Footprint.",
        delta: 0,
        deltaPercent: 0,
        poc: null,
        close: 0,
        confidence: "LOW",
      };
    }
  }, [candle, profile, normalizedSymbol]);

  const showToast = useCallback(
    (
      message: string,
      type: ToastType = "info",
      duration = 5000,
    ) => {
      if (toastTimerRef.current !== null) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }

      const id = ++toastIdRef.current;

      setToast({
        id,
        message,
        type,
      });

      if (duration > 0) {
        toastTimerRef.current = setTimeout(() => {
          setToast((current) =>
            current?.id === id ? null : current,
          );

          toastTimerRef.current = null;
        }, duration);
      }
    },
    [],
  );

  /**
   * Đọc quyền thông báo khi component được mount.
   */
  useEffect(() => {
    setNotificationPermission(
      getNotificationPermission(),
    );

    return () => {
      if (toastTimerRef.current !== null) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  /**
   * Phát hiện chuyển đổi trạng thái tín hiệu.
   *
   * Không phát thông báo lần đầu tải trang.
   * Không thông báo chuyển đổi khi đổi mã cổ phiếu.
   * Không thông báo lặp nếu hành động không thay đổi.
   */
  useEffect(() => {
    const nextAction = signal.action;
    const previous = previousSignalRef.current;

    if (previous === null) {
      previousSignalRef.current = {
        symbol: normalizedSymbol,
        action: nextAction,
      };

      return;
    }

    if (previous.symbol !== normalizedSymbol) {
      previousSignalRef.current = {
        symbol: normalizedSymbol,
        action: nextAction,
      };

      return;
    }

    if (previous.action === nextAction) {
      return;
    }

    previousSignalRef.current = {
      symbol: normalizedSymbol,
      action: nextAction,
    };

    if (nextAction === "HOLD") {
      showToast(
        `${normalizedSymbol}: Tín hiệu chuyển sang HOLD. Hãy chờ xác nhận tiếp theo.`,
        "warning",
      );

      return;
    }

    const message = [
      `${normalizedSymbol}: ${signal.title}.`,
      signal.reason,
    ]
      .filter(Boolean)
      .join(" ");

    showToast(
      message,
      nextAction === "BUY" ? "success" : "error",
      8000,
    );

    if (
      notificationsEnabled &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        const notification = new Notification(
          `${normalizedSymbol} — ${nextAction}`,
          {
            body: message,
            tag: `footprint-${normalizedSymbol}`,
          },
        );

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (error) {
        console.error(
          "[TradeSignalPanel] Browser notification failed:",
          error,
        );
      }
    }
  }, [
    signal,
    normalizedSymbol,
    notificationsEnabled,
    showToast,
  ]);

  const enableNotifications = useCallback(async () => {
    const permissionState =
      getNotificationPermission();

    if (permissionState === "unsupported") {
      setNotificationPermission("unsupported");

      showToast(
        "Trình duyệt hiện tại không hỗ trợ thông báo hệ thống.",
        "warning",
      );

      return;
    }

    if (permissionState === "denied") {
      setNotificationPermission("denied");
      setNotificationsEnabled(false);

      showToast(
        "Thông báo đang bị chặn. Hãy cấp quyền cho trang web trong cài đặt trình duyệt.",
        "warning",
      );

      return;
    }

    try {
      const permission =
        permissionState === "granted"
          ? "granted"
          : await Notification.requestPermission();

      setNotificationPermission(permission);

      if (permission === "granted") {
        setNotificationsEnabled(true);

        showToast(
          "Đã bật thông báo khi tín hiệu BUY/SELL thay đổi.",
          "success",
        );
      } else {
        setNotificationsEnabled(false);

        showToast(
          "Chưa cấp quyền thông báo. Bạn vẫn có thể xem tín hiệu trên bảng điều khiển.",
          "warning",
        );
      }
    } catch (error) {
      console.error(
        "[TradeSignalPanel] Request notification permission failed:",
        error,
      );

      showToast(
        "Không thể yêu cầu quyền thông báo. Hãy kiểm tra cài đặt trình duyệt.",
        "error",
      );
    }
  }, [showToast]);

  const disableNotifications = useCallback(() => {
    setNotificationsEnabled(false);

    showToast(
      "Đã tắt thông báo hệ thống. Bảng tín hiệu vẫn hoạt động.",
      "info",
    );
  }, [showToast]);

  /**
   * Không phát thông báo chỉ vì bật/tắt quyền thông báo.
   */
  useEffect(() => {
    previousNotificationEnabledRef.current =
      notificationsEnabled;
  }, [notificationsEnabled]);

  const action = signal.action;
  const style = SIGNAL_STYLES[action];

  const hasCandle = isValidCandle(candle);

  const closePrice = Number.isFinite(signal.close)
    ? signal.close
    : null;

  const pocPrice =
    signal.poc !== null &&
    Number.isFinite(signal.poc)
      ? signal.poc
      : null;

  const delta = Number.isFinite(signal.delta)
    ? signal.delta
    : 0;

  const deltaPercent = Number.isFinite(
    signal.deltaPercent,
  )
    ? signal.deltaPercent
    : 0;

  const confidence = signal.confidence;

  const canEnableNotifications =
    notificationPermission !== "unsupported" &&
    notificationPermission !== "denied";

  return (
    <section
      aria-label={`Footprint trading signal ${normalizedSymbol}`}
      className={`relative overflow-hidden rounded-xl border ${style.border} ${style.background} p-4 text-white shadow-lg shadow-black/10 sm:p-5`}
    >
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`}
              aria-hidden="true"
            />

            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Footprint Signal
            </p>
          </div>

          <h2 className="mt-2 text-xl font-extrabold tracking-tight">
            {normalizedSymbol}
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Phân tích Delta · Volume · POC
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-extrabold tracking-wide ${style.badge}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
              aria-hidden="true"
            />

            {getActionLabel(action)}
          </span>

          <button
            type="button"
            disabled={!notificationsEnabled && !canEnableNotifications}
            onClick={
              notificationsEnabled
                ? disableNotifications
                : enableNotifications
            }
            aria-pressed={notificationsEnabled}
            className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            {notificationsEnabled
              ? "✓ Tắt thông báo"
              : "♧ Bật thông báo"}
          </button>

          {notificationPermission === "denied" && (
            <span className="max-w-44 text-right text-[10px] text-amber-400">
              Quyền thông báo đang bị chặn trong trình duyệt.
            </span>
          )}

          {notificationPermission === "unsupported" && (
            <span className="max-w-44 text-right text-[10px] text-slate-500">
              Trình duyệt không hỗ trợ thông báo.
            </span>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className={`mb-4 flex items-start justify-between gap-3 rounded-lg border p-3 text-xs leading-5 text-slate-200 ${TOAST_STYLES[toast.type]}`}
        >
          <span className="min-w-0 break-words">
            {toast.message}
          </span>

          <button
            type="button"
            onClick={() => {
              if (toastTimerRef.current !== null) {
                clearTimeout(toastTimerRef.current);
                toastTimerRef.current = null;
              }

              setToast(null);
            }}
            aria-label="Đóng thông báo"
            className="shrink-0 rounded px-1 text-slate-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            ×
          </button>
        </div>
      )}

      {/* Main signal */}
      <div
        className={`rounded-xl border border-white/5 ${style.panel} p-4 sm:p-5`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {style.label}
          </span>

          <span
            className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${
              hasCandle
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                : "border-amber-500/20 bg-amber-500/10 text-amber-400"
            }`}
          >
            {hasCandle
              ? "DỮ LIỆU NẾN HỢP LỆ"
              : "DỮ LIỆU NẾN CHƯA HỢP LỆ"}
          </span>
        </div>

        <h3
          className={`mt-3 break-words text-2xl font-black tracking-tight sm:text-3xl ${style.text}`}
        >
          {signal.title || action}
        </h3>

        <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-slate-300">
          {signal.reason ||
            "Chưa có đủ thông tin để giải thích tín hiệu."}
        </p>

        {/* Confidence */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
          <span className="text-xs text-slate-500">
            Độ tin cậy nội bộ:
          </span>

          <span
            className={`rounded-md border px-2 py-1 text-[10px] font-bold ${CONFIDENCE_STYLES[confidence]}`}
          >
            {getConfidenceLabel(confidence)}
          </span>

          <span className="text-[10px] text-slate-500">
            ({confidence})
          </span>
        </div>
      </div>

      {/* Metrics */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric
          label="Delta"
          value={formatDelta(signal.delta)}
          color={getDeltaColor(signal.delta)}
          description="Chênh lệch khối lượng Ask - Bid"
        />

        <Metric
          label="Delta %"
          value={formatPercent(signal.deltaPercent)}
          color={getDeltaColor(deltaPercent)}
          description="Delta chia cho tổng khối lượng"
        />

        <Metric
          label="POC"
          value={
            pocPrice !== null
              ? formatNumber(pocPrice)
              : "N/A"
          }
          color="text-amber-300"
          description="Mức giá có khối lượng lớn nhất"
        />

        <Metric
          label="Giá đóng cửa"
          value={
            closePrice !== null
              ? formatNumber(closePrice)
              : "N/A"
          }
          color="text-sky-300"
          description="Giá đóng cửa của nến được phân tích"
        />
      </div>

      {/* Footer */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-3">
        <span className="text-[10px] text-slate-500">
          Mã: {normalizedSymbol}
        </span>

        <span className="text-[10px] text-slate-500">
          Thông báo hệ thống:{" "}
          <span
            className={
              notificationsEnabled
                ? "font-bold text-emerald-400"
                : "text-slate-400"
            }
          >
            {notificationsEnabled ? "ĐANG BẬT" : "ĐANG TẮT"}
          </span>
        </span>
      </div>

      <p className="mt-3 text-[10px] leading-5 text-slate-500">
        Tín hiệu được tính từ dữ liệu Footprint hiện có, không bảo đảm
        kết quả giao dịch. Độ tin cậy là điểm đánh giá theo quy tắc,
        không phải xác suất thắng. Cần xác nhận dữ liệu, xu hướng,
        thanh khoản và quản trị rủi ro trước khi ra quyết định.
      </p>
    </section>
  );
}

