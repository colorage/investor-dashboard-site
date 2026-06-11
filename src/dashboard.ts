import {
  PERIOD_KEYS,
  PERIOD_LABELS,
  formatReturn,
  type PeriodKey,
} from "./returns";
import {
  computeAvgYearlyGrowth,
  passesGrowthFilters,
  type FilterState,
} from "./growth";
import type { SymbolRow } from "./universe";

export type SortKey =
  | PeriodKey
  | "price"
  | "symbol"
  | "name"
  | "sector"
  | "avgGrowth";

export interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

function getCellValue(
  row: SymbolRow,
  key: SortKey,
  filterState: FilterState,
): string | number | null {
  if (key === "avgGrowth") {
    return computeAvgYearlyGrowth(row, filterState.periodStart, filterState.periodEnd);
  }
  if (key in row.returns) return row.returns[key as PeriodKey];
  if (key === "price") return row.price;
  if (key === "symbol") return row.symbol;
  if (key === "name") return row.name;
  if (key === "sector") return row.sector ?? "";
  return null;
}

export function sortRows(
  rows: SymbolRow[],
  sort: SortState,
  filterState: FilterState,
): SymbolRow[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    const av = getCellValue(a, sort.key, filterState);
    const bv = getCellValue(b, sort.key, filterState);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    let cmp = 0;
    if (typeof av === "number" && typeof bv === "number") {
      cmp = av - bv;
    } else {
      cmp = String(av).localeCompare(String(bv));
    }
    return sort.dir === "asc" ? cmp : -cmp;
  });
  return sorted;
}

function returnClass(value: number | null): string {
  if (value === null) return "ret-neutral";
  if (value > 0) return "ret-pos";
  if (value < 0) return "ret-neg";
  return "ret-neutral";
}

function th(label: string, key: SortKey, sort: SortState): string {
  const arrow =
    sort.key === key ? (sort.dir === "asc" ? " ▲" : " ▼") : "";
  return `<th data-sort="${key}" class="sortable">${label}${arrow}</th>`;
}

export function renderTable(
  rows: SymbolRow[],
  sort: SortState,
  filterState: FilterState,
): string {
  const displayRows = sortRows(
    rows.filter((r) => !r.failed && passesGrowthFilters(r, filterState)),
    sort,
    filterState,
  );

  const returnHeaders = PERIOD_KEYS.map((k) =>
    th(PERIOD_LABELS[k], k, sort),
  ).join("");

  const body = displayRows
    .map((row) => {
      const avgGrowth = computeAvgYearlyGrowth(
        row,
        filterState.periodStart,
        filterState.periodEnd,
      );

      const returns = PERIOD_KEYS.map((k) => {
        const val = row.returns[k];
        return `<td class="${returnClass(val)}">${formatReturn(val)}</td>`;
      }).join("");

      const price =
        row.price !== null
          ? row.price.toLocaleString(undefined, { maximumFractionDigits: 4 })
          : "—";

      return `<tr>
        <td class="sym">${escapeHtml(row.symbol)}</td>
        <td class="name">${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.sector ?? "—")}</td>
        <td class="price">${price}</td>
        <td class="${returnClass(avgGrowth)}">${formatReturn(avgGrowth)}</td>
        ${returns}
      </tr>`;
    })
    .join("");

  return `<p class="section-note">${displayRows.length} symbols</p>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            ${th("Symbol", "symbol", sort)}
            ${th("Name", "name", sort)}
            ${th("Sector", "sector", sort)}
            ${th("Price", "price", sort)}
            ${th("Avg Yr Growth", "avgGrowth", sort)}
            ${returnHeaders}
          </tr>
        </thead>
        <tbody>${body || '<tr><td colspan="20" class="empty">No symbols match filters</td></tr>'}</tbody>
      </table>
    </div>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
