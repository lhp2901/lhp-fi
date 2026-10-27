/**
 * lib/footprint/trade-signal.ts
 *
 * Footprint trading signal engine.
 *
 * Mục tiêu:
 * - Validate dữ liệu đầu vào.
 * - Tính toán Bid/Ask Delta và Delta %.
 * - Xác định Point of Control (POC).
 * - Đánh giá cấu trúc nến, lực mua/bán và vị trí giá so với POC.
 * - Phát hiện tín hiệu chưa đồng thuận.
 * - Trả về BUY / SELL / HOLD cùng mức độ tin cậy.
 *
 * Lưu ý:
 * - Đây là bộ lọc tín hiệu theo quy tắc, không phải mô hình dự báo.
 * - Confidence là điểm đánh giá nội bộ, không phải xác suất thắng.
 */

export type SignalAction = "BUY" | "SELL" | "HOLD";

export type SignalConfidence = "LOW" | "MEDIUM" | "HIGH";

export interface FootprintLevel {
  price: number;
  bid: number;
  ask: number;
  volume: number;
  delta: number;
}

export interface SignalCandle {
  time?: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  delta?: number;
  bidVolume?: number;
  askVolume?: number;
  levels?: FootprintLevel[];
}

export interface TradeSignal {
  action: SignalAction;
  title: string;
  reason: string;
  delta: number;
  deltaPercent: number;
  poc: number | null;
  close: number;
  confidence: SignalConfidence;
}

/**
 * Các ngưỡng dưới đây là tham số khởi đầu.
 * Cần kiểm chứng bằng dữ liệu lịch sử trước khi sử dụng thực tế.
 *
 * deltaPercent được biểu diễn dưới dạng tỷ lệ:
 * 0.15 tương đương 15%.
 */
export interface TradeSignalConfig {
  strongDeltaThreshold: number;
  moderateDeltaThreshold: number;
  minimumProfileVolume: number;
  minimumPrice: number;
  minimumConfidenceForEntry: number;
}

export const DEFAULT_TRADE_SIGNAL_CONFIG: Readonly<TradeSignalConfig> = {
  strongDeltaThreshold: 0.15,
  moderateDeltaThreshold: 0.05,
  minimumProfileVolume: 0,
  minimumPrice: 0,
  minimumConfidenceForEntry: 60,
};

interface NormalizedLevel {
  price: number;
  bid: number;
  ask: number;
  volume: number;
  delta: number;
}

interface ProfileAnalysis {
  levels: NormalizedLevel[];
  totalBid: number;
  totalAsk: number;
  totalVolume: number;
  profileDelta: number;
  poc: number | null;
}

interface SignalMetrics {
  delta: number;
  deltaPercent: number;
  poc: number | null;
  close: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "N/A";
  }

  return value.toLocaleString("vi-VN", {
    maximumFractionDigits: 4,
  });
}

function formatPercent(value: number): string {
  return `${(value * 100).toLocaleString("vi-VN", {
    maximumFractionDigits: 2,
  })}%`;
}

function makeHold(
  reason: string,
  metrics: Partial<SignalMetrics> = {},
): TradeSignal {
  return {
    action: "HOLD",
    title: "HOLD — TIẾP TỤC QUAN SÁT",
    reason,
    delta: metrics.delta ?? 0,
    deltaPercent: metrics.deltaPercent ?? 0,
    poc: metrics.poc ?? null,
    close: metrics.close ?? 0,
    confidence: "LOW",
  };
}

function normalizeLevel(
  level: FootprintLevel,
): NormalizedLevel | null {
  if (
    !level ||
    !isFiniteNumber(level.price) ||
    level.price <= 0 ||
    !isFiniteNumber(level.bid) ||
    !isFiniteNumber(level.ask) ||
    level.bid < 0 ||
    level.ask < 0
  ) {
    return null;
  }

  const volume = level.bid + level.ask;

  if (!Number.isFinite(volume)) {
    return null;
  }

  return {
    price: level.price,
    bid: level.bid,
    ask: level.ask,
    volume,
    // Tính lại Delta từ Bid/Ask để đảm bảo nhất quán.
    delta: level.ask - level.bid,
  };
}

function analyzeProfile(
  sourceLevels: FootprintLevel[],
): ProfileAnalysis | null {
  if (!Array.isArray(sourceLevels) || sourceLevels.length === 0) {
    return null;
  }

  const levels = sourceLevels
    .map(normalizeLevel)
    .filter(
      (level): level is NormalizedLevel => level !== null,
    );

  if (levels.length === 0) {
    return null;
  }

  const totalBid = levels.reduce(
    (sum, level) => sum + level.bid,
    0,
  );

  const totalAsk = levels.reduce(
    (sum, level) => sum + level.ask,
    0,
  );

  const totalVolume = totalBid + totalAsk;

  if (
    !Number.isFinite(totalBid) ||
    !Number.isFinite(totalAsk) ||
    !Number.isFinite(totalVolume) ||
    totalVolume <= 0
  ) {
    return null;
  }

  // Nếu có nhiều mức giá cùng khối lượng lớn nhất,
  // chọn mức giá đầu tiên theo thứ tự giá tăng dần.
  const sortedLevels = [...levels].sort(
    (a, b) => a.price - b.price,
  );

  let pocLevel = sortedLevels[0];

  for (const level of sortedLevels) {
    if (level.volume > pocLevel.volume) {
      pocLevel = level;
    }
  }

  return {
    levels,
    totalBid,
    totalAsk,
    totalVolume,
    profileDelta: totalAsk - totalBid,
    poc: pocLevel.price,
  };
}

function getValidCandle(
  candle: SignalCandle,
): boolean {
  const prices = [
    candle.open,
    candle.high,
    candle.low,
    candle.close,
  ];

  if (!prices.every(isPositiveNumber)) {
    return false;
  }

  if (
    candle.high < candle.low ||
    candle.high < candle.open ||
    candle.high < candle.close ||
    candle.low > candle.open ||
    candle.low > candle.close
  ) {
    return false;
  }

  if (!isFiniteNumber(candle.volume) || candle.volume < 0) {
    return false;
  }

  return true;
}

function getConfidence(
  score: number,
): SignalConfidence {
  if (score >= 80) return "HIGH";
  if (score >= 60) return "MEDIUM";
  return "LOW";
}

function buildSignal(params: {
  action: "BUY" | "SELL";
  reason: string;
  metrics: SignalMetrics;
  score: number;
}): TradeSignal {
  const confidence = getConfidence(params.score);

  return {
    action: params.action,
    title:
      params.action === "BUY"
        ? "BUY — TÍN HIỆU MUA"
        : "SELL — TÍN HIỆU BÁN",
    reason: params.reason,
    delta: params.metrics.delta,
    deltaPercent: params.metrics.deltaPercent,
    poc: params.metrics.poc,
    close: params.metrics.close,
    confidence,
  };
}

/**
 * Tính tín hiệu Footprint.
 *
 * @param candle Nến đang phân tích.
 * @param profile Volume Profile bên ngoài, dùng khi candle.levels không có.
 * @param config Tham số điều chỉnh tín hiệu.
 */
export function calculateTradeSignal(
  candle: SignalCandle | undefined,
  profile: FootprintLevel[],
  config: Partial<TradeSignalConfig> = {},
): TradeSignal {
  const settings: TradeSignalConfig = {
    ...DEFAULT_TRADE_SIGNAL_CONFIG,
    ...config,
  };

  if (!candle) {
    return makeHold("Chưa có dữ liệu nến để phân tích.");
  }

  if (!getValidCandle(candle)) {
    return makeHold(
      "Dữ liệu OHLC hoặc Volume không hợp lệ. Không phát tín hiệu giao dịch.",
      {
        close: isFiniteNumber(candle.close) ? candle.close : 0,
      },
    );
  }

  const sourceLevels =
    Array.isArray(candle.levels) && candle.levels.length > 0
      ? candle.levels
      : profile;

  if (!Array.isArray(sourceLevels) || sourceLevels.length === 0) {
    return makeHold(
      "Chưa có dữ liệu Footprint để xác định POC và xác nhận lực mua/bán.",
      { close: candle.close },
    );
  }

  const analysis = analyzeProfile(sourceLevels);

  if (!analysis) {
    return makeHold(
      "Dữ liệu Bid/Ask không hợp lệ hoặc tổng khối lượng bằng 0.",
      { close: candle.close },
    );
  }

  if (analysis.totalVolume <= settings.minimumProfileVolume) {
    return makeHold(
      "Khối lượng Profile chưa đạt ngưỡng tối thiểu.",
      {
        delta: analysis.profileDelta,
        poc: analysis.poc,
        close: candle.close,
      },
    );
  }

  /**
   * Chỉ sử dụng Delta do backend cung cấp khi đó là số hữu hạn.
   * Nếu không, tính Delta từ tổng Ask - Bid của Profile.
   */
  const delta = isFiniteNumber(candle.delta)
    ? candle.delta
    : analysis.profileDelta;

  /**
   * Ưu tiên Volume của nến nếu lớn hơn 0.
   * Nếu không có Volume hợp lệ, dùng tổng Bid + Ask của Profile.
   */
  const candleVolume =
    isPositiveNumber(candle.volume)
      ? candle.volume
      : analysis.totalVolume;

  const deltaPercent =
    candleVolume > 0 ? delta / candleVolume : 0;

  const metrics: SignalMetrics = {
    delta,
    deltaPercent,
    poc: analysis.poc,
    close: candle.close,
  };

  if (
    !Number.isFinite(delta) ||
    !Number.isFinite(deltaPercent)
  ) {
    return makeHold(
      "Không thể tính Delta hoặc Delta %. Kiểm tra đơn vị dữ liệu đầu vào.",
      metrics,
    );
  }

  if (analysis.poc === null) {
    return makeHold(
      "Không xác định được POC từ Volume Profile.",
      metrics,
    );
  }

  const bullishCandle = candle.close > candle.open;
  const bearishCandle = candle.close < candle.open;
  const neutralCandle = candle.close === candle.open;

  const abovePOC = candle.close > analysis.poc;
  const belowPOC = candle.close < analysis.poc;
  const atPOC = candle.close === analysis.poc;

  const strongPositiveDelta =
    deltaPercent >= settings.strongDeltaThreshold;

  const strongNegativeDelta =
    deltaPercent <= -settings.strongDeltaThreshold;

  const moderatePositiveDelta =
    deltaPercent >= settings.moderateDeltaThreshold;

  const moderateNegativeDelta =
    deltaPercent <= -settings.moderateDeltaThreshold;

  /**
   * Điểm đánh giá nội bộ:
   * - Delta: tối đa 35 điểm.
   * - Hướng nến: tối đa 20 điểm.
   * - Vị trí giá so với POC: tối đa 20 điểm.
   * - Xác nhận Delta và cấu trúc giá: tối đa 25 điểm.
   *
   * Đây là điểm heuristic, không phải xác suất thắng.
   */
  const calculateScore = (
    direction: "BUY" | "SELL",
  ): number => {
    const matchingDelta =
      direction === "BUY"
        ? deltaPercent > 0
        : deltaPercent < 0;

    const strongDelta =
      direction === "BUY"
        ? strongPositiveDelta
        : strongNegativeDelta;

    const matchingCandle =
      direction === "BUY"
        ? bullishCandle
        : bearishCandle;

    const matchingPOC =
      direction === "BUY" ? abovePOC : belowPOC;

    let score = 0;

    if (matchingDelta) {
      score += strongDelta ? 35 : 20;
    }

    if (matchingCandle) {
      score += 20;
    }

    if (matchingPOC) {
      score += 20;
    }

    if (matchingDelta && matchingCandle) {
      score += 10;
    }

    if (matchingDelta && matchingPOC) {
      score += 10;
    }

    if (strongDelta && matchingCandle && matchingPOC) {
      score += 5;
    }

    return clamp(score, 0, 100);
  };

  const buyScore = calculateScore("BUY");
  const sellScore = calculateScore("SELL");

  /**
   * Điều kiện vào tín hiệu nghiêm ngặt:
   * Delta đủ mạnh, nến xác nhận cùng chiều,
   * giá đóng cửa nằm đúng phía POC.
   */
  const buyConfirmed =
    strongPositiveDelta &&
    bullishCandle &&
    abovePOC;

  const sellConfirmed =
    strongNegativeDelta &&
    bearishCandle &&
    belowPOC;

  if (
    buyConfirmed &&
    buyScore >= settings.minimumConfidenceForEntry
  ) {
    return buildSignal({
      action: "BUY",
      score: buyScore,
      metrics,
      reason:
        `Delta dương ${formatPercent(deltaPercent)}, ` +
        `nến tăng và giá đóng cửa ${formatPrice(candle.close)} ` +
        `nằm trên POC ${formatPrice(analysis.poc)}. ` +
        "Các điều kiện định lượng cơ bản đang đồng thuận.",
    });
  }

  if (
    sellConfirmed &&
    sellScore >= settings.minimumConfidenceForEntry
  ) {
    return buildSignal({
      action: "SELL",
      score: sellScore,
      metrics,
      reason:
        `Delta âm ${formatPercent(deltaPercent)}, ` +
        `nến giảm và giá đóng cửa ${formatPrice(candle.close)} ` +
        `nằm dưới POC ${formatPrice(analysis.poc)}. ` +
        "Các điều kiện định lượng cơ bản đang đồng thuận.",
    });
  }

  /**
   * Delta mạnh nhưng giá và nến không đồng thuận:
   * không cố ép thành BUY hoặc SELL.
   */
  if (
    (strongPositiveDelta && (!bullishCandle || !abovePOC)) ||
    (strongNegativeDelta && (!bearishCandle || !belowPOC))
  ) {
    return makeHold(
      "Delta mạnh nhưng cấu trúc nến hoặc vị trí giá so với POC chưa xác nhận. Có thể đang xuất hiện hấp thụ lệnh hoặc giằng co; cần quan sát thêm.",
      metrics,
    );
  }

  if (atPOC) {
    return makeHold(
      `Giá đóng cửa đang tại POC ${formatPrice(analysis.poc)}. Chưa có đủ xác nhận để xác định bên mua hoặc bên bán chiếm ưu thế.`,
      metrics,
    );
  }

  if (neutralCandle) {
    return makeHold(
      "Nến không có hướng tăng/giảm rõ ràng. Chờ thêm xác nhận từ giá và Delta.",
      metrics,
    );
  }

  if (moderatePositiveDelta || moderateNegativeDelta) {
    return makeHold(
      `Delta ${formatPercent(deltaPercent)} cho thấy có độ lệch mua/bán, nhưng chưa đạt ngưỡng xác nhận. Tiếp tục quan sát.`,
      metrics,
    );
  }

  return makeHold(
    "Chưa đủ điều kiện xác nhận BUY hoặc SELL. Cần kết hợp thêm cấu trúc giá, thanh khoản và các nến tiếp theo.",
    metrics,
  );
}
