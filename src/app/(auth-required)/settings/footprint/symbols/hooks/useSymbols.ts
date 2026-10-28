
"use client";

import { useCallback, useEffect, useState } from "react";

import { normalizeSymbols } from "../utils";
import type { ManagedSymbol, SymbolFormValue } from "../types";

/**
 * API base URL
 *
 * Development:
 *   NEXT_PUBLIC_LHP_AI_SERVER_URL=http://127.0.0.1:10000
 *
 * Production:
 *   NEXT_PUBLIC_LHP_AI_SERVER_URL=https://your-backend-domain.com
 */
const API_BASE = (
  process.env.NEXT_PUBLIC_LHP_AI_SERVER_URL ||
  (process.env.NODE_ENV === "development"
    ? "http://127.0.0.1:10000"
    : "https://lhp-ai-server.onrender.com")
).replace(/\/+$/, "");

type ApiPayload = Record<string, unknown>;

class ApiError extends Error {
  status?: number;
  url?: string;

  constructor(
    message: string,
    options?: {
      status?: number;
      url?: string;
    }
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options?.status;
    this.url = options?.url;
  }
}

/**
 * Chuẩn hóa URL để tránh:
 * - Thiếu dấu /
 * - Thừa dấu / giữa API_BASE và path
 */
function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${API_BASE}${normalizedPath}`;
}

/**
 * Request dùng chung cho GET / POST / PATCH / DELETE.
 *
 * Tách lỗi mạng khỏi lỗi HTTP:
 * - Failed to fetch: trình duyệt không nhận được response.
 * - HTTP 4xx/5xx: backend đã phản hồi nhưng request thất bại.
 */
async function request<T = ApiPayload>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = buildApiUrl(path);

  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(init.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...init.headers,
      },
    });
  } catch (error) {
    console.error("[Footprint Symbols] Network request failed", {
      url,
      method: init.method || "GET",
      error,
    });

    throw new ApiError(
      [
        "Không kết nối được backend.",
        `URL: ${url}`,
        "Hãy kiểm tra API_BASE, trạng thái backend và cấu hình CORS.",
      ].join(" "),
      { url }
    );
  }

  const raw = await response.text();

  let payload: any = {};

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = {
        message: raw,
      };
    }
  }

  if (!response.ok) {
    const message =
      payload?.detail ||
      payload?.error ||
      payload?.message ||
      `Yêu cầu thất bại (HTTP ${response.status})`;

    throw new ApiError(String(message), {
      status: response.status,
      url,
    });
  }

  return payload as T;
}

export function useSymbols(token = "") {
  const [symbols, setSymbols] = useState<ManagedSymbol[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const authHeaders = useCallback((): Record<string, string> => {
    const normalizedToken = token.trim();

    return normalizedToken
      ? {
          "X-Footprint-Token": normalizedToken,
        }
      : {};
  }, [token]);

  /**
   * Tải danh sách mã từ backend.
   */
  const refresh = useCallback(async (): Promise<ManagedSymbol[]> => {
    setLoading(true);
    setError("");

    try {
      const payload = await request("/api/footprint/symbols", {
        method: "GET",
        headers: authHeaders(),
      });

      const normalized = normalizeSymbols(payload);

      setSymbols(normalized);

      return normalized;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Không tải được danh sách mã.";

      setError(message);

      throw err;
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  /**
   * Tải dữ liệu khi hook được mount
   * hoặc token thay đổi.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadSymbols() {
      try {
        const payload = await request("/api/footprint/symbols", {
          method: "GET",
          headers: authHeaders(),
        });

        if (!cancelled) {
          setSymbols(normalizeSymbols(payload));
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Không tải được danh sách mã."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    setLoading(true);
    void loadSymbols();

    return () => {
      cancelled = true;
    };
  }, [authHeaders]);

  /**
   * Hàm dùng chung cho POST / PATCH / DELETE.
   */
  const mutate = useCallback(
    async (
      path: string,
      method: "POST" | "PATCH" | "DELETE",
      body?: unknown
    ): Promise<void> => {
      setBusy(true);
      setError("");

      try {
        await request(path, {
          method,
          headers: authHeaders(),
          ...(body === undefined
            ? {}
            : {
                body: JSON.stringify(body),
              }),
        });

        /**
         * Thao tác ghi đã thành công.
         * Tải lại danh sách để đồng bộ UI.
         *
         * Nếu refresh lỗi, không báo rằng thao tác ghi
         * thất bại vì backend đã xử lý thành công.
         */
        try {
          const payload = await request("/api/footprint/symbols", {
            method: "GET",
            headers: authHeaders(),
          });

          setSymbols(normalizeSymbols(payload));
        } catch (refreshError) {
          console.error(
            "[Footprint Symbols] Mutation succeeded but refresh failed",
            refreshError
          );

          setError(
            "Thao tác đã được gửi thành công nhưng không tải lại được danh sách. Hãy thử làm mới."
          );
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Thao tác thất bại.";

        setError(message);

        throw err;
      } finally {
        setBusy(false);
      }
    },
    [authHeaders]
  );

  /**
   * Thêm mã.
   */
  const add = useCallback(
    (value: SymbolFormValue) => {
      const symbol = value.symbol.trim().toUpperCase();

      if (!symbol) {
        const message = "Vui lòng nhập mã cổ phiếu.";

        setError(message);

        return Promise.reject(new Error(message));
      }

      return mutate("/api/footprint/symbols", "POST", {
        ...value,
        symbol,
      });
    },
    [mutate]
  );

  /**
   * Sửa thông tin hoặc bật/tắt mã.
   */
  const update = useCallback(
    (symbol: string, value: Partial<SymbolFormValue>) => {
      const normalizedSymbol = symbol.trim().toUpperCase();

      if (!normalizedSymbol) {
        const message = "Mã cổ phiếu không hợp lệ.";

        setError(message);

        return Promise.reject(new Error(message));
      }

      return mutate(
        `/api/footprint/symbols/${encodeURIComponent(normalizedSymbol)}`,
        "PATCH",
        value
      );
    },
    [mutate]
  );

  /**
   * Xóa mã.
   */
  const remove = useCallback(
    (symbol: string) => {
      const normalizedSymbol = symbol.trim().toUpperCase();

      if (!normalizedSymbol) {
        const message = "Mã cổ phiếu không hợp lệ.";

        setError(message);

        return Promise.reject(new Error(message));
      }

      return mutate(
        `/api/footprint/symbols/${encodeURIComponent(normalizedSymbol)}`,
        "DELETE"
      );
    },
    [mutate]
  );

  /**
   * Bật / tắt mã.
   *
   * Backend phải hỗ trợ:
   * PATCH /api/footprint/symbols/{symbol}
   *
   * Body:
   * { "enabled": true }
   * hoặc
   * { "enabled": false }
   */
  const setEnabled = useCallback(
    (symbol: string, enabled: boolean) => {
      return update(symbol, { enabled });
    },
    [update]
  );

  return {
    symbols,
    loading,
    error,
    busy,
    refresh,
    add,
    update,
    remove,
    setEnabled,
  };
}

