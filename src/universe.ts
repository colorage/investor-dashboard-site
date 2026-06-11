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

export const DEV_SYMBOLS = new Set(["AAPL", "MSFT", "SPY", "VWCE.DE", "PKN.WA"]);
