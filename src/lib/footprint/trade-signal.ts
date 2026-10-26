export type SignalAction = "BUY" | "SELL" | "HOLD";

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
  confidence: "LOW" | "MEDIUM" | "HIGH";
}

export function calculateTradeSignal(
  candle: SignalCandle | undefined,
  profile: FootprintLevel[],
): TradeSignal {
  const hold = (
    reason: string,
    delta = 0,
    deltaPercent = 0,
    poc: number | null = null,
    close = candle?.close ?? 0,
  ): TradeSignal => ({
    action: "HOLD",
    title: "HOLD — TIẾP TỤC QUAN SÁT",
    reason,
    delta,
    deltaPercent,
    poc,
    close,
    confidence: "LOW",
  });

  if (!candle) {
    return hold("Chưa có dữ liệu nến.");
  }

  const levels =
    candle.levels && candle.levels.length > 0
      ? candle.levels
      : profile;

  if (levels.length === 0) {
    return hold(
      "Chưa có dữ liệu Volume Profile để xác nhận tín hiệu.",
    );
  }

  const validLevels = levels.filter(
    (level) =>
      Number.isFinite(level.price) &&
      Number.isFinite(level.bid) &&
      Number.isFinite(level.ask) &&
      level.bid >= 0 &&
      level.ask >= 0,
  );

  if (validLevels.length === 0) {
    return hold("Dữ liệu Bid/Ask không hợp lệ.");
  }

  const totalBid = validLevels.reduce(
    (sum, level) => sum + level.bid,
    0,
  );

  const totalAsk = validLevels.reduce(
    (sum, level) => sum + level.ask,
    0,
  );

  const profileVolume = validLevels.reduce(
    (sum, level) => sum + level.bid + level.ask,
    0,
  );

  if (profileVolume <= 0) {
    return hold("Khối lượng giao dịch chưa đủ để phân tích.");
  }

  // POC: mức giá có tổng khối lượng lớn nhất.
  const pocLevel = validLevels.reduce((max, level) => {
    const volume = level.bid + level.ask;
    const maxVolume = max.bid + max.ask;

    return volume > maxVolume ? level : max;
  });

  const poc = pocLevel.price;

  // Ưu tiên Delta do backend cung cấp nếu có.
  // Nếu không có thì tính từ tổng Ask - tổng Bid.
  const delta =
    Number.isFinite(candle.delta)
      ? candle.delta!
      : totalAsk - totalBid;

  const candleVolume =
    Number.isFinite(candle.volume) && candle.volume > 0
      ? candle.volume
      : profileVolume;

  const deltaPercent =
    candleVolume > 0 ? delta / candleVolume : 0;

  if (
    !Number.isFinite(candle.open) ||
    !Number.isFinite(candle.close) ||
    candle.close <= 0
  ) {
    return hold(
      "Giá nến không hợp lệ.",
      delta,
      deltaPercent,
      poc,
    );
  }

  const bullishCandle = candle.close > candle.open;
  const bearishCandle = candle.close < candle.open;

  const abovePOC = candle.close > poc;
  const belowPOC = candle.close < poc;

  // Các ngưỡng này có thể điều chỉnh theo thị trường và timeframe.
  const strongPositiveDelta = deltaPercent >= 0.15;
  const strongNegativeDelta = deltaPercent <= -0.15;

  if (
    strongPositiveDelta &&
    abovePOC &&
    bullishCandle
  ) {
    return {
      action: "BUY",
      title: "BUY — TÍN HIỆU MUA",
      reason:
        "Delta dương mạnh, giá trên POC và nến tăng xác nhận.",
      delta,
      deltaPercent,
      poc,
      close: candle.close,
      confidence: "HIGH",
    };
  }

  if (
    strongNegativeDelta &&
    belowPOC &&
    bearishCandle
  ) {
    return {
      action: "SELL",
      title: "SELL — TÍN HIỆU BÁN",
      reason:
        "Delta âm mạnh, giá dưới POC và nến giảm xác nhận.",
      delta,
      deltaPercent,
      poc,
      close: candle.close,
      confidence: "HIGH",
    };
  }

  if (
    (strongPositiveDelta && belowPOC) ||
    (strongNegativeDelta && abovePOC)
  ) {
    return hold(
      "Delta và vị trí giá so với POC chưa đồng thuận. Cần quan sát thêm.",
      delta,
      deltaPercent,
      poc,
    );
  }

  return hold(
    "Chưa đủ điều kiện xác nhận xu hướng mua hoặc bán.",
    delta,
    deltaPercent,
    poc,
  );
}