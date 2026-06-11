import type { PeriodKey } from "./returns";

export interface Symbol {
  symbol: string;
  name: string;
  type: "stock" | "etf";
  market: "us" | "eu" | "pl";
  sector?: string;
  exchange?: string;
  vwraHolding?: boolean;
}

export interface SymbolRow extends Symbol {
  price: number | null;
  returns: Record<PeriodKey, number | null>;
  failed?: boolean;
}

export type SectionId =
  | "all"
  | "stocks"
  | "etfs"
  | "ucits"
  | "poland"
  | "eu"
  | "vwra"
  | "top1d"
  | "bottom1d";

export interface SectionDef {
  id: SectionId;
  label: string;
  filter: (row: SymbolRow) => boolean;
  defaultSort: { key: PeriodKey | "price" | "symbol" | "name"; dir: "asc" | "desc" };
  limit?: number;
  columns: Array<"sector" | "market" | "exchange">;
}

export const SECTIONS: SectionDef[] = [
  {
    id: "all",
    label: "All symbols",
    filter: () => true,
    defaultSort: { key: "r_1y", dir: "desc" },
    columns: ["sector"],
  },
  {
    id: "stocks",
    label: "Stocks",
    filter: (r) => r.type === "stock",
    defaultSort: { key: "r_ytd", dir: "desc" },
    columns: ["sector"],
  },
  {
    id: "etfs",
    label: "ETFs",
    filter: (r) => r.type === "etf",
    defaultSort: { key: "r_1y", dir: "desc" },
    columns: ["market"],
  },
  {
    id: "ucits",
    label: "UCITS ETFs",
    filter: (r) => r.type === "etf" && r.market === "eu",
    defaultSort: { key: "r_1y", dir: "desc" },
    columns: ["exchange"],
  },
  {
    id: "poland",
    label: "Poland WIG20",
    filter: (r) => r.market === "pl",
    defaultSort: { key: "r_ytd", dir: "desc" },
    columns: ["sector"],
  },
  {
    id: "eu",
    label: "EU stocks",
    filter: (r) => r.type === "stock" && r.market === "eu",
    defaultSort: { key: "r_ytd", dir: "desc" },
    columns: ["sector"],
  },
  {
    id: "vwra",
    label: "VWRA holdings",
    filter: (r) => r.vwraHolding === true,
    defaultSort: { key: "r_1y", dir: "desc" },
    columns: ["market", "sector"],
  },
  {
    id: "top1d",
    label: "Top 1D movers",
    filter: (r) => r.type === "stock" && r.returns.r_1d !== null,
    defaultSort: { key: "r_1d", dir: "desc" },
    limit: 25,
    columns: [],
  },
  {
    id: "bottom1d",
    label: "Bottom 1D movers",
    filter: (r) => r.type === "stock" && r.returns.r_1d !== null,
    defaultSort: { key: "r_1d", dir: "asc" },
    limit: 25,
    columns: [],
  },
];

export function symbolsForSection(
  universe: Symbol[],
  sectionId: SectionId,
): Symbol[] {
  const section = SECTIONS.find((s) => s.id === sectionId);
  if (!section) return universe;
  const placeholder = (s: Symbol): SymbolRow => ({
    ...s,
    price: null,
    returns: {
      r_1d: null,
      r_1w: null,
      r_1m: null,
      r_3m: null,
      r_ytd: null,
      r_6m: null,
      r_1y: null,
      r_3y: null,
      r_5y: null,
      r_10y: null,
    },
  });
  return universe.filter((s) => section.filter(placeholder(s)));
}

export const DEV_SYMBOLS = new Set(["AAPL", "MSFT", "SPY", "VWCE.DE", "PKN.WA"]);
