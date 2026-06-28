export const PERIOD_KEYS = [
  "r_1d",
  "r_1w",
  "r_1m",
  "r_3m",
  "r_ytd",
  "r_6m",
  "r_1y",
  "r_3y",
  "r_5y",
  "r_10y",
] as const;

export type PeriodKey = (typeof PERIOD_KEYS)[number];

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  r_1d: "1D",
  r_1w: "1W",
  r_1m: "1M",
  r_3m: "3M",
  r_ytd: "YTD",
  r_6m: "6M",
  r_1y: "1Y",
  r_3y: "3Y",
  r_5y: "5Y",
  r_10y: "10Y",
};

export interface HistorySeries {
  start: number;
  c: number[];
}

export interface ReturnSnapshot {
  price: number | null;
  returns: Record<PeriodKey, number | null>;
  history?: HistorySeries;
}

export interface PricePoint {
  date: Date;
  close: number;
}

const WEEK_MS = 7 * 86400000;

function roundClose(value: number): number {
  if (value === 0) return 0;
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(value))) - 3);
  return Math.round(value / magnitude) * magnitude;
}

export function downsampleWeekly(history: PricePoint[]): HistorySeries | null {
  const series = [...history]
    .filter((p) => Number.isFinite(p.close))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (series.length === 0) return null;

  const start = series[0].date.getTime();
  const end = series[series.length - 1].date.getTime();
  const closes: number[] = [];
  let pointIdx = 0;
  let lastClose = series[0].close;

  for (let weekStart = start; weekStart <= end; weekStart += WEEK_MS) {
    const weekEnd = weekStart + WEEK_MS - 1;
    while (
      pointIdx + 1 < series.length &&
      series[pointIdx + 1].date.getTime() <= weekEnd
    ) {
      pointIdx++;
    }
    if (series[pointIdx].date.getTime() <= weekEnd) {
      lastClose = series[pointIdx].close;
    }
    closes.push(roundClose(lastClose));
  }

  return closes.length > 0 ? { start, c: closes } : null;
}

export function computeSnapshot(
  history: PricePoint[],
  asOf: Date = new Date(),
): ReturnSnapshot {
  const snapshot = computeReturns(history, asOf);
  const weekly = downsampleWeekly(history);
  if (weekly) {
    snapshot.history = weekly;
  }
  return snapshot;
}

function pctReturn(current: number, past: number): number | null {
  if (past === 0) return null;
  return Math.round((current / past - 1) * 100);
}

function closeOnOrBefore(series: PricePoint[], target: Date): number | null {
  if (series.length === 0) return null;
  const ts = target.getTime();
  let result: number | null = null;
  for (const point of series) {
    if (point.date.getTime() <= ts) {
      result = point.close;
    } else {
      break;
    }
  }
  return result;
}

function anchorDates(asOf: Date): Partial<Record<PeriodKey, Date>> {
  const ytdStart = new Date(asOf.getFullYear() - 1, 11, 31);
  const day = (n: number) => new Date(asOf.getTime() - n * 86400000);
  return {
    r_1w: day(7),
    r_1m: day(30),
    r_3m: day(91),
    r_ytd: ytdStart,
    r_6m: day(182),
    r_1y: day(365),
    r_3y: day(365 * 3),
    r_5y: day(365 * 5),
    r_10y: day(365 * 10),
  };
}

export function computeReturns(
  history: PricePoint[],
  asOf: Date = new Date(),
): ReturnSnapshot {
  const emptyReturns = Object.fromEntries(
    PERIOD_KEYS.map((k) => [k, null]),
  ) as Record<PeriodKey, number | null>;

  if (history.length === 0) {
    return { price: null, returns: emptyReturns };
  }

  const series = [...history]
    .filter((p) => Number.isFinite(p.close))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (series.length === 0) {
    return { price: null, returns: emptyReturns };
  }

  const current = closeOnOrBefore(series, asOf);
  if (current === null) {
    return { price: null, returns: emptyReturns };
  }

  const returns = { ...emptyReturns };

  if (series.length >= 2) {
    returns.r_1d = pctReturn(current, series[series.length - 2].close);
  }

  const anchors = anchorDates(asOf);
  for (const key of PERIOD_KEYS) {
    if (key === "r_1d") continue;
    const anchor = anchors[key];
    if (!anchor) continue;
    const past = closeOnOrBefore(series, anchor);
    returns[key] = past !== null ? pctReturn(current, past) : null;
  }

  return {
    price: Math.round(current * 10000) / 10000,
    returns,
  };
}

export function formatReturn(value: number | null): string {
  if (value === null) return "—";
  const rounded = Math.round(value);
  const sign = rounded >= 0 ? "+" : "";
  const absVal = Math.abs(rounded);
  if (absVal >= 1000) {
    if (absVal >= 1_000_000) {
      return `${sign}${Math.round(rounded / 1_000_000)}M%`;
    }
    return `${sign}${Math.round(rounded / 1000)}K%`;
  }
  return `${sign}${rounded}%`;
}

export function returnsHash(
  returns: Record<PeriodKey, number | null>,
  price: number | null,
): string {
  return [String(price), ...PERIOD_KEYS.map((k) => String(returns[k]))].join("|");
}
