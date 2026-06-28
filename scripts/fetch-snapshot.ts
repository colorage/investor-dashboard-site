import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeSnapshot, type PricePoint, type ReturnSnapshot } from "../src/returns";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UNIVERSE_PATH = join(ROOT, "public", "universe.json");
const OUT_PATH = join(ROOT, "public", "snapshot.json");

const CHUNK_SIZE = 45;
const SLEEP_MS = 1500;
const YAHOO_CHART = "https://query2.finance.yahoo.com/v8/finance/chart";

const DEV_SYMBOLS = new Set(["AAPL", "MSFT", "SPY", "VWCE.DE", "PKN.WA"]);
const devMode = process.argv.includes("--dev");

interface SymbolRecord {
  symbol: string;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{ close?: (number | null)[] }>;
        adjclose?: Array<{ adjclose?: (number | null)[] }>;
      };
    }>;
    error?: { description?: string };
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function parseChart(data: YahooChartResponse): PricePoint[] {
  const result = data.chart?.result?.[0];
  if (!result?.timestamp?.length) return [];
  const closes =
    result.indicators?.adjclose?.[0]?.adjclose ??
    result.indicators?.quote?.[0]?.close ??
    [];
  const points: PricePoint[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const close = closes[i];
    if (close == null || !Number.isFinite(close)) continue;
    points.push({ date: new Date(result.timestamp[i] * 1000), close });
  }
  return points;
}

async function fetchSymbol(symbol: string): Promise<ReturnSnapshot> {
  const url = `${YAHOO_CHART}/${encodeURIComponent(symbol)}?interval=1d&range=10y`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; invester-dashboard/1.0; +https://github.com/colorage/investor-dashboard-site)",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as YahooChartResponse;
  if (data.chart?.error) {
    throw new Error(data.chart.error.description ?? "Yahoo error");
  }
  const history = parseChart(data);
  if (history.length === 0) throw new Error("No history");
  return computeSnapshot(history);
}

async function main(): Promise<void> {
  const universe = JSON.parse(readFileSync(UNIVERSE_PATH, "utf-8")) as SymbolRecord[];
  const symbols = devMode
    ? universe.filter((s) => DEV_SYMBOLS.has(s.symbol)).map((s) => s.symbol)
    : universe.map((s) => s.symbol);

  console.log(`Fetching ${symbols.length} symbols${devMode ? " (dev)" : ""}…`);

  const quotes: Record<string, ReturnSnapshot> = {};
  const failed: string[] = [];
  const chunks = chunk(symbols, CHUNK_SIZE);

  for (let i = 0; i < chunks.length; i++) {
    const batch = chunks[i];
    console.log(`Chunk ${i + 1}/${chunks.length} (${batch.length} symbols)`);
    await Promise.all(
      batch.map(async (symbol) => {
        try {
          quotes[symbol] = await fetchSymbol(symbol);
        } catch (e) {
          failed.push(symbol);
          console.warn(`  failed ${symbol}:`, e instanceof Error ? e.message : e);
        }
      }),
    );
    if (i < chunks.length - 1) await sleep(SLEEP_MS);
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    failed,
    quotes,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(payload));
  console.log(`Wrote ${Object.keys(quotes).length} quotes to ${OUT_PATH} (${failed.length} failed)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
