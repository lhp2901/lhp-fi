"use client";

import {
useCallback,
useEffect,
useMemo,
useState,
} from "react";

import {
footprintApi,
DEFAULT_SYMBOLS,
getErrorMessage,
formatDate,
formatNumber,
type TradesResult,
} from "@/lib/footprint-api";

import {
PageHeading,
Panel,
ErrorNotice,
LoadingNotice,
RefreshButton,
StatusBadge,
} from "../components/footprint-ui";

const TABLE_PAGE_SIZES = [25, 50, 100];

const TABLE_MAX_HEIGHT = "600px";

export default function TradesPage() {
const [symbol, setSymbol] = useState("FPT");
const [symbols, setSymbols] = useState<string[]>(DEFAULT_SYMBOLS);

const [result, setResult] = useState<TradesResult | null>(null);
const [error, setError] = useState("");
const [loading, setLoading] = useState(true);

// Giới hạn số giao dịch lấy từ Backend.
const [limit, setLimit] = useState("100");

// Phân trang riêng ở Frontend.
const [pageSize, setPageSize] = useState(25);
const [currentPage, setCurrentPage] = useState(1);

const refresh = useCallback(async () => {
setLoading(true);
setError("");


try {
  const [tradesResponse, symbolsResponse] = await Promise.all([
    footprintApi.trades(symbol, Number(limit)),
    footprintApi.symbols(),
  ]);

  setResult(tradesResponse.data ?? null);

  const availableSymbols =
    symbolsResponse.data?.engine_symbols ??
    symbolsResponse.data?.configured_symbols;

  if (availableSymbols?.length) {
    setSymbols(availableSymbols);

    if (!availableSymbols.includes(symbol)) {
      setSymbol(availableSymbols[0]);
    }
  }
} catch (e) {
  setError(getErrorMessage(e));
  setResult(null);
} finally {
  setLoading(false);
}


}, [symbol, limit]);

useEffect(() => {
void refresh();
}, [refresh]);

// Trở về trang đầu khi thay đổi bộ lọc.
useEffect(() => {
setCurrentPage(1);
}, [symbol, limit, pageSize]);

const trades = useMemo(() => {
return result?.trades ?? [];
}, [result]);

const totalTrades = trades.length;

const totalPages = Math.max(
1,
Math.ceil(totalTrades / pageSize),
);

// Đảm bảo trang hiện tại luôn hợp lệ nếu số dữ liệu giảm.
useEffect(() => {
setCurrentPage((page) => Math.min(page, totalPages));
}, [totalPages]);

const startIndex =
totalTrades === 0 ? 0 : (currentPage - 1) * pageSize;

const endIndex = Math.min(
startIndex + pageSize,
totalTrades,
);

const visibleTrades = useMemo(() => {
return trades.slice(startIndex, endIndex);
}, [trades, startIndex, endIndex]);

const goToPreviousPage = () => {
setCurrentPage((page) => Math.max(1, page - 1));
};

const goToNextPage = () => {
setCurrentPage((page) => Math.min(totalPages, page + 1));
};

const selectSymbol = (nextSymbol: string) => {
setSymbol(nextSymbol);
setCurrentPage(1);
};

const selectLimit = (nextLimit: string) => {
setLimit(nextLimit);
setCurrentPage(1);
};

return ( <main className="min-w-0 space-y-6">
<PageHeading
title="Trades"
description="Trade tape của Footprint Engine. Dữ liệu hiển thị là số giao dịch Backend trả về, không mặc định là toàn bộ lịch sử SQLite."
action={
<RefreshButton
onClick={() => void refresh()}
loading={loading}
/>
}
/>


  {error && <ErrorNotice message={error} />}

  {/* Bộ lọc */}
  <Panel
    title="Bộ lọc giao dịch"
    description="Chọn mã chứng khoán và số bản ghi yêu cầu từ Backend."
  >
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <label className="block text-sm text-slate-400">
        Mã chứng khoán

        <select
          value={symbol}
          onChange={(event) => selectSymbol(event.target.value)}
          className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-sky-500 sm:w-48"
        >
          {Array.from(new Set([symbol, ...symbols])).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm text-slate-400">
        Số bản ghi từ Backend

        <select
          value={limit}
          onChange={(event) => selectLimit(event.target.value)}
          className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-sky-500 sm:w-48"
        >
          <option value="50">50 giao dịch</option>
          <option value="100">100 giao dịch</option>
          <option value="250">250 giao dịch</option>
          <option value="500">500 giao dịch</option>
        </select>
      </label>

      <label className="block text-sm text-slate-400">
        Số dòng mỗi trang

        <select
          value={pageSize}
          onChange={(event) => setPageSize(Number(event.target.value))}
          className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-sky-500 sm:w-44"
        >
          {TABLE_PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size} dòng
            </option>
          ))}
        </select>
      </label>
    </div>
  </Panel>

  {loading && !result ? (
    <LoadingNotice />
  ) : (
    <Panel
      title={`Giao dịch ${result?.symbol ?? symbol}`}
      description={`Backend trả về ${formatNumber(totalTrades)} giao dịch · Trade tape: ${
        result?.trade_tape_enabled === false
          ? "đang tắt"
          : "theo trạng thái Backend"
      }`}
    >
      {/* Trạng thái và thống kê */}
      <div className="mb-4 flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge
            value={
              result?.trade_tape_enabled === false
                ? "UNAVAILABLE"
                : "AVAILABLE"
            }
          />

          <span className="text-sm text-slate-400">
            {totalTrades > 0
              ? `Đang xem ${formatNumber(startIndex + 1)}–${formatNumber(endIndex)} / ${formatNumber(totalTrades)}`
              : "Không có giao dịch"}
          </span>
        </div>

        <span className="text-xs text-slate-500">
          Trang {currentPage} / {totalPages}
        </span>
      </div>

      {/* Vùng bảng có cuộn dọc và ngang */}
      <div
        className="overflow-auto rounded-xl border border-white/10"
        style={{
          maxHeight: TABLE_MAX_HEIGHT,
        }}
      >
        <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-900">
            <tr>
              {[
                "Thời gian",
                "Mã",
                "Giá",
                "Khối lượng",
                "Side",
                "Trade ID",
                "Giá trị",
              ].map((heading) => (
                <th
                  key={heading}
                  className="whitespace-nowrap border-b border-white/10 bg-slate-900 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-white/5">
            {visibleTrades.map((trade, index) => (
              <tr
                key={
                  trade.trade_id ??
                  `${trade.timestamp_ms}-${startIndex + index}`
                }
                className="transition-colors hover:bg-white/[0.035]"
              >
                <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                  {formatDate(
                    trade.datetime ??
                      trade.timestamp_ms ??
                      trade.timestamp,
                  )}
                </td>

                <td className="whitespace-nowrap px-4 py-3 font-semibold text-white">
                  {trade.symbol ?? result?.symbol ?? symbol}
                </td>

                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-200">
                  {formatNumber(trade.price, 3)}
                </td>

                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-200">
                  {formatNumber(
                    trade.volume ?? trade.quantity,
                    2,
                  )}
                </td>

                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={
                      trade.side === "BUY"
                        ? "inline-flex rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-300"
                        : trade.side === "SELL"
                          ? "inline-flex rounded-md bg-rose-500/10 px-2 py-1 text-xs font-semibold text-rose-300"
                          : "inline-flex rounded-md bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-200"
                    }
                  >
                    {trade.side ?? "UNKNOWN"}
                  </span>
                </td>

                <td
                  className="max-w-48 truncate px-4 py-3 text-slate-500"
                  title={trade.trade_id ?? ""}
                >
                  {trade.trade_id ?? "—"}
                </td>

                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-200">
                  {formatNumber(trade.notional, 2)}
                </td>
              </tr>
            ))}

            {!visibleTrades.length && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center"
                >
                  <div className="text-sm font-medium text-slate-300">
                    Không có giao dịch để hiển thị
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    Có thể Stream chưa nhận dữ liệu hoặc Trade Tape
                    đang tắt.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Thanh phân trang */}
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-400">
          {totalTrades > 0 ? (
            <>
              Hiển thị{" "}
              <span className="font-medium text-white">
                {formatNumber(startIndex + 1)}–{formatNumber(endIndex)}
              </span>{" "}
              trong{" "}
              <span className="font-medium text-white">
                {formatNumber(totalTrades)}
              </span>{" "}
              giao dịch.
            </>
          ) : (
            "Chưa có dữ liệu giao dịch."
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1 || totalTrades === 0}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Về trang đầu"
          >
            « Đầu
          </button>

          <button
            type="button"
            onClick={goToPreviousPage}
            disabled={currentPage <= 1 || totalTrades === 0}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Trước
          </button>

          <span className="min-w-24 px-2 text-center text-sm font-medium text-white">
            {currentPage} / {totalPages}
          </span>

          <button
            type="button"
            onClick={goToNextPage}
            disabled={
              currentPage >= totalPages || totalTrades === 0
            }
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Sau →
          </button>

          <button
            type="button"
            onClick={() => setCurrentPage(totalPages)}
            disabled={
              currentPage >= totalPages || totalTrades === 0
            }
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Đến trang cuối"
          >
            Cuối »
          </button>
        </div>
      </div>
    </Panel>
  )}
</main>


);
}
