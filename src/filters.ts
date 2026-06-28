import {
  DEFAULT_FILTER_STATE,
  GROWTH_PERIOD_COUNT,
  GROWTH_PERIODS,
  GROWTH_RANGE_MAX,
  GROWTH_RANGE_MIN,
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
      <label class="filter-label">
        Avg yearly growth:
        <span id="growth-range-value">${state.minGrowth}% – ${state.maxGrowth}%</span>
      </label>
      <div class="dual-range">
        <div class="dual-range-track" id="growth-track"></div>
        <input
          type="range"
          id="min-growth"
          class="dual-range-input"
          min="${GROWTH_RANGE_MIN}"
          max="${GROWTH_RANGE_MAX}"
          step="1"
          value="${state.minGrowth}"
        />
        <input
          type="range"
          id="max-growth"
          class="dual-range-input"
          min="${GROWTH_RANGE_MIN}"
          max="${GROWTH_RANGE_MAX}"
          step="1"
          value="${state.maxGrowth}"
        />
      </div>
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
  const maxGrowthEl = container.querySelector("#max-growth") as HTMLInputElement;
  const growthRangeValueEl = container.querySelector("#growth-range-value");
  const growthTrackEl = container.querySelector("#growth-track") as HTMLElement;
  const periodStartEl = container.querySelector("#period-start") as HTMLInputElement;
  const periodEndEl = container.querySelector("#period-end") as HTMLInputElement;
  const periodRangeValueEl = container.querySelector("#period-range-value");

  function updatePeriodRangeVisual(): void {
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

  function updateGrowthRangeVisual(): void {
    if (!growthTrackEl) return;
    const min = Math.min(Number(minGrowthEl.value), Number(maxGrowthEl.value));
    const max = Math.max(Number(minGrowthEl.value), Number(maxGrowthEl.value));
    const span = GROWTH_RANGE_MAX - GROWTH_RANGE_MIN;
    const left = ((min - GROWTH_RANGE_MIN) / span) * 100;
    const width = ((max - min) / span) * 100;
    growthTrackEl.style.left = `${left}%`;
    growthTrackEl.style.width = `${width}%`;
  }

  function emit(): void {
    let periodStart = Number(periodStartEl.value);
    let periodEnd = Number(periodEndEl.value);
    if (periodStart > periodEnd) {
      [periodStart, periodEnd] = [periodEnd, periodStart];
      periodStartEl.value = String(periodStart);
      periodEndEl.value = String(periodEnd);
    }

    let minGrowth = Number(minGrowthEl.value);
    let maxGrowth = Number(maxGrowthEl.value);
    if (minGrowth > maxGrowth) {
      [minGrowth, maxGrowth] = [maxGrowth, minGrowth];
      minGrowthEl.value = String(minGrowth);
      maxGrowthEl.value = String(maxGrowth);
    }

    updatePeriodRangeVisual();
    updateGrowthRangeVisual();
    if (growthRangeValueEl) {
      growthRangeValueEl.textContent = `${minGrowth}% – ${maxGrowth}%`;
    }
    if (periodRangeValueEl) {
      periodRangeValueEl.textContent = periodRangeLabel(periodStart, periodEnd);
    }
    onChange({
      ...getState(),
      minGrowth,
      maxGrowth,
      periodStart,
      periodEnd,
    });
  }

  minGrowthEl.addEventListener("input", () => {
    if (Number(minGrowthEl.value) > Number(maxGrowthEl.value)) {
      maxGrowthEl.value = minGrowthEl.value;
    }
    emit();
  });

  maxGrowthEl.addEventListener("input", () => {
    if (Number(maxGrowthEl.value) < Number(minGrowthEl.value)) {
      minGrowthEl.value = maxGrowthEl.value;
    }
    emit();
  });

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

  updatePeriodRangeVisual();
  updateGrowthRangeVisual();
}
