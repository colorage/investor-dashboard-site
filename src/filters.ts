import {
  DEFAULT_FILTER_STATE,
  GROWTH_PERIOD_COUNT,
  GROWTH_PERIODS,
  periodRangeLabel,
  type FilterState,
} from "./growth";

export type { FilterState };
export { DEFAULT_FILTER_STATE };

export function renderFilters(state: FilterState): string {
  const rangeLabel = periodRangeLabel(state.periodStart, state.periodEnd);
  const periodLabels = GROWTH_PERIODS.map((p) => p.label).join(", ");

  return `
    <div class="filter-row">
      <label class="filter-label" for="min-growth">
        Min avg yearly growth: <span id="min-growth-value">${state.minGrowth}%</span>
      </label>
      <input
        type="range"
        id="min-growth"
        class="filter-slider"
        min="20"
        max="200"
        step="1"
        value="${state.minGrowth}"
      />
    </div>
    <div class="filter-row">
      <label class="filter-label">
        Period range: <span id="period-range-value">${rangeLabel}</span>
      </label>
      <div class="dual-range" data-period-count="${GROWTH_PERIOD_COUNT}">
        <div class="dual-range-track"></div>
        <input
          type="range"
          id="period-start"
          class="dual-range-input"
          min="0"
          max="${GROWTH_PERIOD_COUNT - 1}"
          step="1"
          value="${state.periodStart}"
        />
        <input
          type="range"
          id="period-end"
          class="dual-range-input"
          min="0"
          max="${GROWTH_PERIOD_COUNT - 1}"
          step="1"
          value="${state.periodEnd}"
        />
      </div>
      <div class="period-ticks" aria-hidden="true">
        ${GROWTH_PERIODS.map((p) => `<span>${p.label}</span>`).join("")}
      </div>
      <p class="filter-hint">Averages: ${periodLabels} (annualized)</p>
    </div>`;
}

export function attachFilterHandlers(
  container: HTMLElement,
  onChange: (state: FilterState) => void,
  getState: () => FilterState,
): void {
  const minGrowthEl = container.querySelector("#min-growth") as HTMLInputElement;
  const minGrowthValueEl = container.querySelector("#min-growth-value");
  const periodStartEl = container.querySelector("#period-start") as HTMLInputElement;
  const periodEndEl = container.querySelector("#period-end") as HTMLInputElement;
  const periodRangeValueEl = container.querySelector("#period-range-value");

  function updateDualRangeVisual(): void {
    const start = Math.min(Number(periodStartEl.value), Number(periodEndEl.value));
    const end = Math.max(Number(periodStartEl.value), Number(periodEndEl.value));
    const track = container.querySelector(".dual-range-track") as HTMLElement;
    if (!track) return;
    const max = GROWTH_PERIOD_COUNT - 1;
    const left = (start / max) * 100;
    const width = ((end - start) / max) * 100;
    track.style.left = `${left}%`;
    track.style.width = `${width}%`;
  }

  function emit(): void {
    let periodStart = Number(periodStartEl.value);
    let periodEnd = Number(periodEndEl.value);
    if (periodStart > periodEnd) {
      [periodStart, periodEnd] = [periodEnd, periodStart];
      periodStartEl.value = String(periodStart);
      periodEndEl.value = String(periodEnd);
    }
    updateDualRangeVisual();
    if (minGrowthValueEl) {
      minGrowthValueEl.textContent = `${minGrowthEl.value}%`;
    }
    if (periodRangeValueEl) {
      periodRangeValueEl.textContent = periodRangeLabel(periodStart, periodEnd);
    }
    onChange({
      ...getState(),
      minGrowth: Number(minGrowthEl.value),
      periodStart,
      periodEnd,
    });
  }

  minGrowthEl.addEventListener("input", emit);

  periodStartEl.addEventListener("input", () => {
    if (Number(periodStartEl.value) > Number(periodEndEl.value)) {
      periodEndEl.value = periodStartEl.value;
    }
    emit();
  });

  periodEndEl.addEventListener("input", () => {
    if (Number(periodEndEl.value) < Number(periodStartEl.value)) {
      periodStartEl.value = periodEndEl.value;
    }
    emit();
  });

  updateDualRangeVisual();
}
