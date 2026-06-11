import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(ROOT, "data");
const OUT_PATH = join(ROOT, "public", "universe.json");

export interface SymbolRecord {
  symbol: string;
  name: string;
  type: "stock" | "etf";
  market: "us" | "eu" | "pl";
  sector?: string;
  exchange?: string;
  vwraHolding?: boolean;
}

const ETF_SYMBOLS: [string, string][] = [
  ["SPY", "SPDR S&P 500 ETF Trust"],
  ["QQQ", "Invesco QQQ Trust"],
  ["VTI", "Vanguard Total Stock Market ETF"],
  ["VOO", "Vanguard S&P 500 ETF"],
  ["IVV", "iShares Core S&P 500 ETF"],
  ["IWM", "iShares Russell 2000 ETF"],
  ["EEM", "iShares MSCI Emerging Markets ETF"],
  ["VEA", "Vanguard FTSE Developed Markets ETF"],
  ["VWO", "Vanguard FTSE Emerging Markets ETF"],
  ["GLD", "SPDR Gold Shares"],
  ["SLV", "iShares Silver Trust"],
  ["TLT", "iShares 20+ Year Treasury Bond ETF"],
  ["IEF", "iShares 7-10 Year Treasury Bond ETF"],
  ["SHY", "iShares 1-3 Year Treasury Bond ETF"],
  ["HYG", "iShares iBoxx High Yield Corporate Bond ETF"],
  ["LQD", "iShares iBoxx Investment Grade Corporate Bond ETF"],
  ["XLK", "Technology Select Sector SPDR Fund"],
  ["XLF", "Financial Select Sector SPDR Fund"],
  ["XLE", "Energy Select Sector SPDR Fund"],
  ["XLV", "Health Care Select Sector SPDR Fund"],
  ["XLI", "Industrial Select Sector SPDR Fund"],
  ["XLY", "Consumer Discretionary Select Sector SPDR Fund"],
  ["XLP", "Consumer Staples Select Sector SPDR Fund"],
  ["XLU", "Utilities Select Sector SPDR Fund"],
  ["XLB", "Materials Select Sector SPDR Fund"],
  ["XLRE", "Real Estate Select Sector SPDR Fund"],
  ["XLC", "Communication Services Select Sector SPDR Fund"],
  ["ARKK", "ARK Innovation ETF"],
  ["SCHD", "Schwab US Dividend Equity ETF"],
  ["VIG", "Vanguard Dividend Appreciation ETF"],
  ["DGRO", "iShares Core Dividend Growth ETF"],
  ["VNQ", "Vanguard Real Estate ETF"],
  ["USO", "United States Oil Fund"],
  ["UNG", "United States Natural Gas Fund"],
  ["BITO", "ProShares Bitcoin Strategy ETF"],
  ["SOXX", "iShares Semiconductor ETF"],
  ["SMH", "VanEck Semiconductor ETF"],
  ["DIA", "SPDR Dow Jones Industrial Average ETF"],
  ["MDY", "SPDR S&P MidCap 400 ETF"],
  ["IJH", "iShares Core S&P Mid-Cap ETF"],
  ["IJR", "iShares Core S&P Small-Cap ETF"],
  ["ACWI", "iShares MSCI ACWI ETF"],
  ["VT", "Vanguard Total World Stock ETF"],
  ["BND", "Vanguard Total Bond Market ETF"],
  ["AGG", "iShares Core U.S. Aggregate Bond ETF"],
];

function normalizeTicker(raw: string): string {
  return raw.trim().replace(/\./g, "-");
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  result.push(current);
  return result;
}

function readCsv(name: string): Record<string, string>[] {
  const path = join(DATA_DIR, name);
  return parseCsv(readFileSync(path, "utf-8"));
}

function loadSp500(): SymbolRecord[] {
  const rows = readCsv("sp500_fallback.csv");
  return rows.map((row) => ({
    symbol: normalizeTicker(row.Symbol),
    name: row.Security.trim(),
    type: "stock" as const,
    market: "us" as const,
    sector: row["GICS Sector"]?.trim() || undefined,
  }));
}

function loadEtfs(): SymbolRecord[] {
  return ETF_SYMBOLS.map(([symbol, name]) => ({
    symbol,
    name,
    type: "etf" as const,
    market: "us" as const,
  }));
}

function loadCsvSymbols(
  filename: string,
  symType: "stock" | "etf",
  market: "us" | "eu" | "pl",
  opts: { withExchange?: boolean; marketFromCsv?: boolean } = {},
): SymbolRecord[] {
  const rows = readCsv(filename);
  return rows.map((row) => {
    const rowMarket =
      opts.marketFromCsv && row.market?.trim()
        ? (row.market.trim() as "us" | "eu" | "pl")
        : market;
    return {
      symbol: row.symbol.trim(),
      name: row.name.trim(),
      type: symType,
      market: rowMarket,
      sector: row.sector?.trim() || undefined,
      exchange: opts.withExchange ? row.exchange?.trim() || undefined : undefined,
    };
  });
}

function loadVwraSymbols(): Set<string> {
  const rows = readCsv("vwra_holdings.csv");
  return new Set(rows.map((r) => r.symbol.trim()));
}

function mergeSymbols(groups: SymbolRecord[]): SymbolRecord[] {
  const seen = new Set<string>();
  const merged: SymbolRecord[] = [];
  for (const sym of groups) {
    if (seen.has(sym.symbol)) continue;
    seen.add(sym.symbol);
    merged.push(sym);
  }
  return merged;
}

function main(): void {
  const vwraSet = loadVwraSymbols();
  const all = mergeSymbols([
    ...loadSp500(),
    ...loadEtfs(),
    ...loadCsvSymbols("ucits_etfs.csv", "etf", "eu", { withExchange: true }),
    ...loadCsvSymbols("extra_us_etfs.csv", "etf", "us"),
    ...loadCsvSymbols("eu_stocks.csv", "stock", "eu"),
    ...loadCsvSymbols("pl_wig20.csv", "stock", "pl"),
    ...loadCsvSymbols("vwra_holdings.csv", "stock", "us", { marketFromCsv: true }),
  ]).map((s) => ({
    ...s,
    vwraHolding: vwraSet.has(s.symbol) ? true : undefined,
  }));

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(all, null, 2));
  console.log(`Wrote ${all.length} symbols to ${OUT_PATH}`);
}

main();
