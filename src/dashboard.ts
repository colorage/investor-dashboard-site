import {
  PERIOD_KEYS,
  PERIOD_LABELS,
  formatReturn,
  type PeriodKey,
} from "./returns";
import {
  SECTIONS,
  type SectionDef,
  type SectionId,
  type SymbolRow,
} from "./universe";

export type SortKey = PeriodKey | "price" | "symbol" | "name" | "sector" | "market" | "exchange";

export interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

function getCellValue(row: SymbolRow, key: SortKey): string | number | null {
  if (key in row.returns) return row.returns[key as PeriodKey];
  if (key === "price") return row.price;
  if (key === "symbol") return row.symbol;
  if (key === "name") return row.name;
  if (key === "sector") return row.sector ?? "";
  if (key === "market") return row.market;
  if (key === "exchange") return row.exchange ?? "";
  return null;
}

export function sortRows(rows: SymbolRow[], sort: SortState): SymbolRow[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    const av = getCellValue(a, sort.key);
    const bv = getCellValue(b, sort.key);
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

export function filterSectionRows(
  rows: SymbolRow[],
  section: SectionDef,
): SymbolRow[] {
  let filtered = rows.filter((r) => section.filter(r) && !r.failed);
  filtered = sortRows(filtered, {
    key: section.defaultSort.key as SortKey,
    dir: section.defaultSort.dir,
  });
  if (section.limit) {
    filtered = filtered.slice(0, section.limit);
  }
  return filtered;
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
  section: SectionDef,
  sort: SortState,
): string {
  let displayRows = sortRows(
    rows.filter((r) => section.filter(r) && !r.failed),
    sort,
  );
  if (section.limit) {
    displayRows = displayRows.slice(0, section.limit);
  }

  const extraHeaders: string[] = [];
  if (section.columns.includes("sector")) extraHeaders.push(th("Sector", "sector", sort));
  if (section.columns.includes("market")) extraHeaders.push(th("Market", "market", sort));
  if (section.columns.includes("exchange")) extraHeaders.push(th("Exchange", "exchange", sort));

  const returnHeaders = PERIOD_KEYS.map((k) =>
    th(PERIOD_LABELS[k], k, sort),
  ).join("");

  const body = displayRows
    .map((row) => {
      const extras: string[] = [];
      if (section.columns.includes("sector")) {
        extras.push(`<td>${escapeHtml(row.sector ?? "—")}</td>`);
      }
      if (section.columns.includes("market")) {
        extras.push(`<td>${escapeHtml(row.market)}</td>`);
      }
      if (section.columns.includes("exchange")) {
        extras.push(`<td>${escapeHtml(row.exchange ?? "—")}</td>`);
      }

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
        ${extras.join("")}
        <td class="price">${price}</td>
        ${returns}
      </tr>`;
    })
    .join("");

  const limited = section.limit
    ? `<p class="section-note">Showing top ${section.limit} by ${PERIOD_LABELS[section.defaultSort.key as PeriodKey] ?? section.defaultSort.key}</p>`
    : `<p class="section-note">${displayRows.length} symbols</p>`;

  return `${limited}
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            ${th("Symbol", "symbol", sort)}
            ${th("Name", "name", sort)}
            ${extraHeaders.join("")}
            ${th("Price", "price", sort)}
            ${returnHeaders}
          </tr>
        </thead>
        <tbody>${body || '<tr><td colspan="20" class="empty">No data yet — fetching quotes…</td></tr>'}</tbody>
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

export function renderTabs(activeId: SectionId): string {
  return SECTIONS.map(
    (s) =>
      `<button type="button" role="tab" class="tab${s.id === activeId ? " active" : ""}" data-section="${s.id}" aria-selected="${s.id === activeId}">${s.label}</button>`,
  ).join("");
}

export { SECTIONS };
