import { computeSnapshot, type PricePoint, type ReturnSnapshot } from "./returns";
import {
  getAllCachedQuotes,
  getCachedQuote,
  setCachedQuote,
} from "./cache";

const CHUNK_SIZE = 45;
const SLEEP_MS = 1500;
const PROXY_URL = import.meta.env.VITE_YAHOO_PROXY_URL as string | undefined;

export interface FetchProgress {
  chunk: number;
  totalChunks: number;
  loaded: number;
  total: number;
  failed: string[];
}

export type ProgressCallback = (progress: FetchProgress) => void;

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

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function parseChartResponse(data: YahooChartResponse): PricePoint[] {
  const result = data.chart?.result?.[0];
  if (!result?.timestamp?.length) return [];

  const timestamps = result.timestamp;
  const adj =
    result.indicators?.adjclose?.[0]?.adjclose ??
    result.indicators?.quote?.[0]?.close ??
    [];

  const points: PricePoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = adj[i];
    if (close === null || close === undefined || !Number.isFinite(close)) continue;
    points.push({ date: new Date(timestamps[i] * 1000), close });
  }
  return points;
}

async function fetchSymbolHistory(symbol: string): Promise<PricePoint[]> {
  if (!PROXY_URL) {
    throw new Error(
      "VITE_YAHOO_PROXY_URL is not set. Deploy the Cloudflare Worker proxy and set this env var.",
    );
  }

  const url = `${PROXY_URL.replace(/\/$/, "")}/?symbol=${encodeURIComponent(symbol)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${symbol}`);
  }

  const data = (await response.json()) as YahooChartResponse;
  if (data.chart?.error) {
    throw new Error(data.chart.error.description ?? `Yahoo error for ${symbol}`);
  }

  const points = parseChartResponse(data);
  if (points.length === 0) {
    throw new Error(`No price history for ${symbol}`);
  }
  return points;
}

export async function fetchSymbolSnapshot(
  symbol: string,
  force = false,
): Promise<ReturnSnapshot | null> {
  if (!force) {
    const cached = await getCachedQuote(symbol);
    if (cached) return cached.snapshot;
  }

  try {
    const history = await fetchSymbolHistory(symbol);
    const snapshot = computeSnapshot(history);
    await setCachedQuote(symbol, snapshot);
    return snapshot;
  } catch {
    return null;
  }
}

export async function fetchSymbols(
  symbols: string[],
  opts: {
    force?: boolean;
    onProgress?: ProgressCallback;
    prioritySymbols?: string[];
  } = {},
): Promise<{ snapshots: Map<string, ReturnSnapshot>; failed: string[] }> {
  const { force = false, onProgress, prioritySymbols = [] } = opts;
  const snapshots = new Map<string, ReturnSnapshot>();
  const failed: string[] = [];

  if (!force) {
    const cached = await getAllCachedQuotes();
    for (const sym of symbols) {
      const row = cached.get(sym);
      if (row) snapshots.set(sym, row.snapshot);
    }
  }

  const pending = symbols.filter((s) => force || !snapshots.has(s));
  const ordered = [
    ...prioritySymbols.filter((s) => pending.includes(s)),
    ...pending.filter((s) => !prioritySymbols.includes(s)),
  ];

  const chunks = chunkArray(ordered, CHUNK_SIZE);
  let loaded = symbols.length - pending.length;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    await Promise.all(
      chunk.map(async (symbol) => {
        try {
          const history = await fetchSymbolHistory(symbol);
          const snapshot = computeSnapshot(history);
          snapshots.set(symbol, snapshot);
          await setCachedQuote(symbol, snapshot);
        } catch {
          failed.push(symbol);
        }
      }),
    );

    loaded += chunk.length;
    onProgress?.({
      chunk: i + 1,
      totalChunks: chunks.length,
      loaded,
      total: symbols.length,
      failed: [...failed],
    });

    if (i < chunks.length - 1) {
      await sleep(SLEEP_MS);
    }
  }

  return { snapshots, failed };
}

export function isProxyConfigured(): boolean {
  return Boolean(PROXY_URL?.trim());
}
