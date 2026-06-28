import { renderTable, type SortState } from "./dashboard";
import { renderLineChart } from "./chart";
import {
  attachFilterHandlers,
  DEFAULT_FILTER_STATE,
  renderFilters,
  type FilterState,
} from "./filters";
import { PERIOD_KEYS, type HistorySeries } from "./returns";
import { DEV_SYMBOLS, type Symbol, type SymbolRow } from "./universe";
import { fetchSymbols, isProxyConfigured, type FetchProgress } from "./yahoo";
import { clearCache, getAllCachedQuotes, getCacheAge } from "./cache";
import "./styles.css";

const DEV_MODE = import.meta.env.DEV;

let universe: Symbol[] = [];
let rows: SymbolRow[] = [];
let filterState: FilterState = { ...DEFAULT_FILTER_STATE };
let sortState: SortState = { key: "avgGrowth", dir: "desc" };
let isFetching = false;
let failedSymbols = new Set<string>();
let snapshotUpdatedAt: Date | null = null;
let filtersInitialized = false;
let expandedSymbol: string | null = null;

const statusEl = document.getElementById("status-text")!;
const progressEl = document.getElementById("progress-text")!;
const refreshBtn = document.getElementById("refresh-btn") as HTMLButtonElement;
const filtersEl = document.getElementById("filters")!;
const tableEl = document.getElementById("table-container")!;

function emptyReturns() {
  return Object.fromEntries(PERIOD_KEYS.map((k) => [k, null])) as SymbolRow["returns"];
}

function buildRows(snapshots: Map<string, ReturnSnapshotLike>): SymbolRow[] {
  return universe.map((sym) => {
    const snap = snapshots.get(sym.symbol);
    return {
      ...sym,
      price: snap?.price ?? null,
      returns: snap?.returns ?? emptyReturns(),
      history: snap?.history,
      failed: failedSymbols.has(sym.symbol),
    };
  });
}

interface ReturnSnapshotLike {
  price: number | null;
  returns: SymbolRow["returns"];
  history?: HistorySeries;
}

interface SnapshotFile {
  updatedAt: string;
  failed: string[];
  quotes: Record<string, ReturnSnapshotLike>;
}

async function loadUniverse(): Promise<void> {
  const base = import.meta.env.BASE_URL;
  const response = await fetch(`${base}universe.json`);
  if (!response.ok) throw new Error("Failed to load universe.json");
  const all = (await response.json()) as Symbol[];
  universe = DEV_MODE
    ? all.filter((s) => DEV_SYMBOLS.has(s.symbol))
    : all;
}

async function loadSnapshot(): Promise<Map<string, ReturnSnapshotLike> | null> {
  const base = import.meta.env.BASE_URL;
  const response = await fetch(`${base}snapshot.json`);
  if (!response.ok) return null;
  const data = (await response.json()) as SnapshotFile;
  snapshotUpdatedAt = new Date(data.updatedAt);
  failedSymbols = new Set(data.failed ?? []);
  const map = new Map<string, ReturnSnapshotLike>();
  for (const [symbol, snap] of Object.entries(data.quotes)) {
    map.set(symbol, snap);
  }
  return map;
}

function renderTableOnly(): void {
  tableEl.innerHTML = renderTable(rows, sortState, filterState, expandedSymbol);
  attachTableHandlers();
}

function render(): void {
  if (!filtersInitialized) {
    filtersEl.innerHTML = renderFilters(filterState);
    attachFilterHandlers(
      filtersEl,
      (state) => {
        filterState = state;
        expandedSymbol = null;
        renderTableOnly();
      },
      () => filterState,
    );
    filtersInitialized = true;
  }
  renderTableOnly();
}

function attachTableHandlers(): void {
  tableEl.querySelectorAll("th.sortable").forEach((th) => {
    th.addEventListener("click", (event) => {
      event.stopPropagation();
      const key = (th as HTMLElement).dataset.sort as SortState["key"];
      if (sortState.key === key) {
        sortState = { key, dir: sortState.dir === "asc" ? "desc" : "asc" };
      } else {
        sortState = { key, dir: "desc" };
      }
      expandedSymbol = null;
      renderTableOnly();
    });
  });

  tableEl.querySelectorAll("tr.row-main").forEach((tr) => {
    tr.addEventListener("click", () => {
      const symbol = (tr as HTMLElement).dataset.symbol;
      if (!symbol) return;

      if (expandedSymbol === symbol) {
        expandedSymbol = null;
        renderTableOnly();
        return;
      }

      expandedSymbol = symbol;
      renderTableOnly();

      const detailRow = tableEl.querySelector(
        `tr.row-detail[data-symbol="${symbol}"]`,
      );
      if (!detailRow) return;

      const chartWrap = detailRow.querySelector(".chart-wrap") as HTMLElement | null;
      if (!chartWrap) return;

      const row = rows.find((r) => r.symbol === symbol);
      if (!row?.history) {
        chartWrap.innerHTML = '<p class="chart-empty">No chart data</p>';
        return;
      }

      renderLineChart(chartWrap, row.history, {
        symbol: row.symbol,
        name: row.name,
      });
    });
  });
}

function setStatus(text: string): void {
  statusEl.textContent = text;
}

function setProgress(progress: FetchProgress | null): void {
  if (!progress) {
    progressEl.textContent = "";
    return;
  }
  progressEl.textContent = `Chunk ${progress.chunk}/${progress.totalChunks} · ${progress.loaded}/${progress.total} symbols`;
}

function formatSnapshotStatus(failed: number): string {
  const when = snapshotUpdatedAt
    ? snapshotUpdatedAt.toLocaleString()
    : "unknown";
  const failedNote = failed ? ` · ${failed} failed` : "";
  return `Snapshot ${when}${failedNote}`;
}

async function applySnapshots(
  snapshots: Map<string, ReturnSnapshotLike>,
  failed: string[],
  source: "snapshot" | "live" | "cache",
): Promise<void> {
  failedSymbols = new Set(failed);
  rows = buildRows(snapshots);
  const failedNote = failed.length ? ` · ${failed.length} failed` : "";

  if (source === "snapshot" && snapshotUpdatedAt) {
    setStatus(formatSnapshotStatus(failed.length));
  } else if (source === "cache") {
    const cacheAge = await getCacheAge();
    setStatus(
      cacheAge
        ? `Live ${cacheAge.toLocaleString()}${failedNote}`
        : `Loaded ${snapshots.size} symbols${failedNote}`,
    );
  } else {
    setStatus(`Live refresh${failedNote}`);
  }
  render();
}

async function prefetchLive(force = false): Promise<void> {
  if (isFetching || !isProxyConfigured()) return;

  isFetching = true;
  refreshBtn.disabled = true;

  const allSymbols = universe.map((s) => s.symbol);

  try {
    const { snapshots, failed } = await fetchSymbols(allSymbols, {
      force,
      onProgress: async (p) => {
        setProgress(p);
        failedSymbols = new Set(p.failed);
        const cached = await getAllCachedQuotes();
        const snapMap = new Map<string, ReturnSnapshotLike>();
        for (const [sym, quote] of cached) {
          snapMap.set(sym, quote.snapshot);
        }
        rows = buildRows(snapMap);
        renderTableOnly();
      },
    });
    await applySnapshots(snapshots, failed, "live");
  } finally {
    isFetching = false;
    refreshBtn.disabled = false;
    setProgress(null);
  }
}

async function initFromCache(): Promise<boolean> {
  const cached = await getAllCachedQuotes();
  if (cached.size === 0) return false;

  const snapshots = new Map<string, ReturnSnapshotLike>();
  for (const [sym, quote] of cached) {
    snapshots.set(sym, quote.snapshot);
  }
  await applySnapshots(snapshots, [], "cache");
  return true;
}

async function reloadSnapshot(): Promise<void> {
  const snapshots = await loadSnapshot();
  if (!snapshots || snapshots.size === 0) {
    setStatus("No snapshot data — waiting for GitHub Actions build");
    return;
  }
  await applySnapshots(snapshots, [...failedSymbols], "snapshot");
}

async function main(): Promise<void> {
  refreshBtn.addEventListener("click", async () => {
    if (isProxyConfigured()) {
      await clearCache();
      await prefetchLive(true);
      return;
    }
    await reloadSnapshot();
  });

  try {
    await loadUniverse();
    render();

    const snapshot = await loadSnapshot();
    if (snapshot && snapshot.size > 0) {
      await applySnapshots(snapshot, [...failedSymbols], "snapshot");
    } else {
      setStatus("Loading market data…");
    }

    if (isProxyConfigured()) {
      await initFromCache();
      void prefetchLive(false);
    }
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Failed to initialize");
  }
}

void main();
