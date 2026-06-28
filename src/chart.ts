import type { HistorySeries } from "./returns";

const WEEK_MS = 7 * 86400000;

export type ChartRange = "1M" | "6M" | "1Y" | "5Y" | "ALL";

const RANGE_DAYS: Record<Exclude<ChartRange, "ALL">, number> = {
  "1M": 30,
  "6M": 182,
  "1Y": 365,
  "5Y": 365 * 5,
};

export interface ChartOptions {
  symbol: string;
  name: string;
}

interface ChartPoint {
  date: Date;
  close: number;
}

function expandSeries(series: HistorySeries): ChartPoint[] {
  return series.c.map((close, index) => ({
    date: new Date(series.start + index * WEEK_MS),
    close,
  }));
}

function sliceByRange(points: ChartPoint[], range: ChartRange): ChartPoint[] {
  if (range === "ALL" || points.length === 0) return points;
  const cutoff = Date.now() - RANGE_DAYS[range] * 86400000;
  const sliced = points.filter((point) => point.date.getTime() >= cutoff);
  return sliced.length > 1 ? sliced : points.slice(-2);
}

function formatPrice(value: number): string {
  if (value >= 1000) return Math.round(value).toLocaleString();
  if (value >= 100) return value.toFixed(1);
  if (value >= 10) return value.toFixed(2);
  return value.toFixed(3);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function renderLineChart(
  container: HTMLElement,
  series: HistorySeries,
  opts: ChartOptions,
  initialRange: ChartRange = "1Y",
): void {
  const allPoints = expandSeries(series);
  let activeRange = initialRange;

  container.innerHTML = "";
  container.classList.add("chart-panel");

  const header = document.createElement("div");
  header.className = "chart-header";
  header.innerHTML = `
    <div class="chart-title">
      <strong>${escapeHtml(opts.symbol)}</strong>
      <span>${escapeHtml(opts.name)}</span>
    </div>
    <div class="chart-toolbar" role="toolbar" aria-label="Chart range"></div>
  `;
  container.appendChild(header);

  const toolbar = header.querySelector(".chart-toolbar") as HTMLElement;
  const ranges: ChartRange[] = ["1M", "6M", "1Y", "5Y", "ALL"];

  const chartArea = document.createElement("div");
  chartArea.className = "chart-area";
  container.appendChild(chartArea);

  const tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";
  tooltip.hidden = true;
  chartArea.appendChild(tooltip);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "chart-svg");
  svg.setAttribute("viewBox", "0 0 800 260");
  svg.setAttribute("preserveAspectRatio", "none");
  chartArea.appendChild(svg);

  const meta = document.createElement("div");
  meta.className = "chart-meta";
  container.appendChild(meta);

  function draw(range: ChartRange): void {
    activeRange = range;
    const points = sliceByRange(allPoints, range);
    if (points.length < 2) {
      svg.innerHTML = "";
      meta.textContent = "Not enough data for this range";
      return;
    }

    const width = 800;
    const height = 260;
    const pad = { top: 16, right: 16, bottom: 28, left: 56 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    const closes = points.map((point) => point.close);
    const minClose = Math.min(...closes);
    const maxClose = Math.max(...closes);
    const span = maxClose - minClose || maxClose * 0.02 || 1;
    const yMin = minClose - span * 0.08;
    const yMax = maxClose + span * 0.08;

    const xAt = (index: number) =>
      pad.left + (index / (points.length - 1)) * plotW;
    const yAt = (value: number) =>
      pad.top + (1 - (value - yMin) / (yMax - yMin)) * plotH;

    const linePath = points
      .map((point, index) => {
        const cmd = index === 0 ? "M" : "L";
        return `${cmd} ${xAt(index).toFixed(2)} ${yAt(point.close).toFixed(2)}`;
      })
      .join(" ");

    const areaPath = `${linePath} L ${xAt(points.length - 1).toFixed(2)} ${(pad.top + plotH).toFixed(2)} L ${xAt(0).toFixed(2)} ${(pad.top + plotH).toFixed(2)} Z`;

    const positive = points[points.length - 1].close >= points[0].close;
    const trendClass = positive ? "chart-line-pos" : "chart-line-neg";

    svg.innerHTML = `
      <line class="chart-grid" x1="${pad.left}" y1="${pad.top + plotH}" x2="${pad.left + plotW}" y2="${pad.top + plotH}" />
      <line class="chart-grid" x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + plotH}" />
      <path class="chart-area ${trendClass}" d="${areaPath}" />
      <path class="chart-line ${trendClass}" d="${linePath}" />
      <g class="chart-hover" hidden>
        <line class="chart-crosshair" y1="${pad.top}" y2="${pad.top + plotH}" />
        <circle class="chart-dot ${trendClass}" r="4" />
      </g>
      <text class="chart-axis" x="${pad.left}" y="${height - 8}">${formatDate(points[0].date)}</text>
      <text class="chart-axis chart-axis-end" x="${pad.left + plotW}" y="${height - 8}">${formatDate(points[points.length - 1].date)}</text>
      <text class="chart-axis" x="8" y="${yAt(maxClose).toFixed(2)}">${formatPrice(maxClose)}</text>
      <text class="chart-axis" x="8" y="${yAt(minClose).toFixed(2)}">${formatPrice(minClose)}</text>
    `;

    const hoverGroup = svg.querySelector(".chart-hover") as SVGGElement;
    const crosshair = hoverGroup.querySelector(".chart-crosshair") as SVGLineElement;
    const dot = hoverGroup.querySelector(".chart-dot") as SVGCircleElement;

    const pctChange =
      ((points[points.length - 1].close / points[0].close - 1) * 100);
    const sign = pctChange >= 0 ? "+" : "";
    meta.innerHTML = `
      <span>${formatPrice(points[points.length - 1].close)}</span>
      <span class="${positive ? "ret-pos" : "ret-neg"}">${sign}${pctChange.toFixed(1)}%</span>
      <span class="chart-meta-range">${range}</span>
    `;

    toolbar.querySelectorAll(".chart-range-btn").forEach((btn) => {
      btn.classList.toggle(
        "active",
        (btn as HTMLElement).dataset.range === range,
      );
    });

    function hideHover(): void {
      hoverGroup.hidden = true;
      tooltip.hidden = true;
    }

    function showHover(clientX: number): void {
      const rect = svg.getBoundingClientRect();
      const relativeX = ((clientX - rect.left) / rect.width) * width;
      const clampedX = Math.max(pad.left, Math.min(pad.left + plotW, relativeX));
      const ratio = (clampedX - pad.left) / plotW;
      const index = Math.round(ratio * (points.length - 1));
      const point = points[index];
      const x = xAt(index);
      const y = yAt(point.close);

      crosshair.setAttribute("x1", String(x));
      crosshair.setAttribute("x2", String(x));
      dot.setAttribute("cx", String(x));
      dot.setAttribute("cy", String(y));
      hoverGroup.hidden = false;

      tooltip.hidden = false;
      tooltip.textContent = `${formatDate(point.date)} · ${formatPrice(point.close)}`;
      const areaRect = chartArea.getBoundingClientRect();
      const tooltipX = clientX - areaRect.left;
      tooltip.style.left = `${Math.min(Math.max(tooltipX, 48), areaRect.width - 48)}px`;
      tooltip.style.top = "8px";
    }

    svg.onmousemove = (event) => showHover(event.clientX);
    svg.onmouseleave = () => hideHover();
    svg.ontouchstart = (event) => {
      if (event.touches[0]) showHover(event.touches[0].clientX);
    };
    svg.ontouchmove = (event) => {
      event.preventDefault();
      if (event.touches[0]) showHover(event.touches[0].clientX);
    };
    svg.ontouchend = () => hideHover();
  }

  ranges.forEach((range) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chart-range-btn";
    btn.dataset.range = range;
    btn.textContent = range;
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      draw(range);
    });
    toolbar.appendChild(btn);
  });

  draw(activeRange);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
