import type { PeriodKey } from "./returns";
import type { SymbolRow } from "./universe";

export const GROWTH_PERIODS = [
  { key: "r_3m" as const, label: "3M", annualize: (v: number) => v * 4 },
  { key: "r_6m" as const, label: "6M", annualize: (v: number) => v * 2 },
  { key: "r_1y" as const, label: "1Y", annualize: (v: number) => v },
  { key: "r_3y" as const, label: "3Y", annualize: (v: number) => v / 3 },
  { key: "r_5y" as const, label: "5Y", annualize: (v: number) => v / 5 },
  { key: "r_10y" as const, label: "10Y", annualize: (v: number) => v / 10 },
] as const;

export type GrowthPeriodKey = (typeof GROWTH_PERIODS)[number]["key"];

export const GROWTH_PERIOD_COUNT = GROWTH_PERIODS.length;

export interface FilterState {
  minGrowth: number;
  periodStart: number;
  periodEnd: number;
  positiveOnly: boolean;
}

export const DEFAULT_FILTER_STATE: FilterState = {
  minGrowth: 0,
  periodStart: 0,
  periodEnd: GROWTH_PERIOD_COUNT - 1,
  positiveOnly: false,
};

function periodsInRange(rangeStart: number, rangeEnd: number) {
  const start = Math.min(rangeStart, rangeEnd);
  const end = Math.max(rangeStart, rangeEnd);
  return GROWTH_PERIODS.slice(start, end + 1);
}

export function computeAvgYearlyGrowth(
  row: SymbolRow,
  rangeStart: number,
  rangeEnd: number,
): number | null {
  const values: number[] = [];
  for (const period of periodsInRange(rangeStart, rangeEnd)) {
    const raw = row.returns[period.key as PeriodKey];
    if (raw !== null) {
      values.push(period.annualize(raw));
    }
  }
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 100) / 100;
}

export function passesPositiveGrowth(
  row: SymbolRow,
  rangeStart: number,
  rangeEnd: number,
): boolean {
  for (const period of periodsInRange(rangeStart, rangeEnd)) {
    const raw = row.returns[period.key as PeriodKey];
    if (raw !== null && raw <= 0) return false;
  }
  return true;
}

export function passesGrowthFilters(row: SymbolRow, state: FilterState): boolean {
  const avg = computeAvgYearlyGrowth(row, state.periodStart, state.periodEnd);
  if (avg === null || avg < state.minGrowth) return false;
  if (state.positiveOnly && !passesPositiveGrowth(row, state.periodStart, state.periodEnd)) {
    return false;
  }
  return true;
}

export function periodRangeLabel(rangeStart: number, rangeEnd: number): string {
  const start = Math.min(rangeStart, rangeEnd);
  const end = Math.max(rangeStart, rangeEnd);
  return `${GROWTH_PERIODS[start].label} – ${GROWTH_PERIODS[end].label}`;
}
