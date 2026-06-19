import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Download, LoaderCircle } from "lucide-react";
import DetailChip from "@/components/app/DetailChip";
import { resolveApiUrl } from "@/lib/api";

const CHART_WIDTH = 1000;
const CHART_HEIGHT = 350;
const PADDING = { top: 24, right: 24, bottom: 64, left: 82 };
const COLORS = {
  raw: "#64748b",
  filtered: "#0284c7",
  envelope: "#dc2626",
  systolic: "#f59e0b",
  diastolic: "#7c3aed",
  normal: "#10b981",
  outlier: "#ef4444",
  morphology: "#0f766e",
  threshold: "#be123c",
};
const SEGMENT_COLORS = {
  S1: "rgba(225, 29, 72, 0.15)",
  Systole: "rgba(245, 158, 11, 0.13)",
  S2: "rgba(37, 99, 235, 0.14)",
  Diastole: "rgba(16, 185, 129, 0.11)",
};
const SEGMENT_STROKES = {
  S1: "#e11d48",
  Systole: "#d97706",
  S2: "#2563eb",
  Diastole: "#059669",
};

function isFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return false;
  return Number.isFinite(Number(value));
}

function formatValue(value, digits = 2) {
  if (value === null || value === undefined || value === "") return "Not available";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map((item) => formatValue(item, digits)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  if (!isFiniteNumber(value)) return String(value);

  const number = Number(value);
  if (Math.abs(number) >= 1000) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(number);
  }
  if (Number.isInteger(number)) return String(number);
  return number.toFixed(digits);
}

function titleize(value) {
  return String(value)
    .replace(/^_+/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Metric({ label, value, unit, tone = "slate" }) {
  const toneClasses = {
    emerald: "border-emerald-200 bg-emerald-50",
    rose: "border-rose-200 bg-rose-50",
    sky: "border-sky-200 bg-sky-50",
    slate: "border-slate-200 bg-slate-50",
    violet: "border-violet-200 bg-violet-50",
  };
  const displayValue = formatValue(value);
  const valueClass =
    typeof displayValue === "string" && displayValue.length > 24
      ? "text-sm leading-5"
      : "text-xl";

  return (
    <div className={`min-w-0 rounded-lg border p-4 ${toneClasses[tone]}`}>
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className={`mt-2 break-words font-semibold text-slate-950 ${valueClass}`}>
        {displayValue}
        {unit && value !== null && value !== undefined ? (
          <span className="ml-1 text-sm font-medium text-slate-500">{unit}</span>
        ) : null}
      </p>
    </div>
  );
}

function FindingBanner({ title, text, tone = "sky" }) {
  const tones = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
    rose: "border-rose-200 bg-rose-50 text-rose-950",
    sky: "border-sky-200 bg-sky-50 text-sky-950",
  };

  return (
    <div className={`rounded-lg border px-4 py-3 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase opacity-70">{title}</p>
      <p className="mt-1 text-sm font-semibold leading-6">{text || "Not available"}</p>
    </div>
  );
}

function Section({ eyebrow, title, actions, children }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase text-sky-700">{eyebrow}</p>
          ) : null}
          <h2 className="mt-1 text-lg font-semibold text-slate-950">{title}</h2>
        </div>
        {actions}
      </header>
      <div className="min-w-0 p-5">{children}</div>
    </section>
  );
}

function FlatTable({
  rows,
  columns,
  emptyMessage = "No data returned.",
  compact = false,
}) {
  if (!rows?.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 px-4 py-7 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  const visibleColumns =
    columns ||
    Array.from(
      rows.reduce((keys, row) => {
        Object.keys(row || {}).forEach((key) => keys.add(key));
        return keys;
      }, new Set()),
    );

  return (
    <div className="max-w-full overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-slate-100 text-xs font-semibold uppercase text-slate-600">
          <tr>
            {visibleColumns.map((column) => (
              <th key={column} className="whitespace-nowrap border-b border-slate-200 px-3 py-3">
                {titleize(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row, rowIndex) => (
            <tr key={row.id ?? row.cycle_index ?? row.index ?? rowIndex} className="align-top">
              {visibleColumns.map((column) => (
                <td
                  key={column}
                  className={[
                    "min-w-[110px] max-w-[360px] whitespace-normal break-words px-3 text-slate-700",
                    compact ? "py-2 text-xs" : "py-3",
                  ].join(" ")}
                >
                  {formatValue(row?.[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ObjectTable({ value, emptyMessage = "No data returned." }) {
  const rows = Object.entries(value || {}).map(([key, item]) => ({
    metric: titleize(key),
    value: formatValue(item),
  }));
  return <FlatTable rows={rows} columns={["metric", "value"]} emptyMessage={emptyMessage} />;
}

function clampDomain(start, end, minimum, maximum) {
  const fullSpan = maximum - minimum || 1;
  const requestedSpan = Math.min(Math.max(end - start, fullSpan / 200), fullSpan);
  let nextStart = start;
  let nextEnd = start + requestedSpan;

  if (nextStart < minimum) {
    nextStart = minimum;
    nextEnd = minimum + requestedSpan;
  }
  if (nextEnd > maximum) {
    nextEnd = maximum;
    nextStart = maximum - requestedSpan;
  }

  return [nextStart, nextEnd];
}

function InteractivePlot({
  title,
  subtitle,
  xValues,
  series,
  spans = [],
  markers = [],
  kind = "line",
  threshold = null,
  xUnit = "",
  yUnit = "",
  xLabel = "X",
  yLabel = "Y",
  xTickLabels = null,
  zeroFloor = false,
}) {
  const clipId = useId().replace(/:/g, "");
  const svgRef = useRef(null);
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);
  const normalized = useMemo(() => {
    const requestedX = Array.isArray(xValues) ? xValues.map(Number) : [];
    const alignedSeries = series.filter(
      (item) => requestedX.length > 0 && item.values?.length === requestedX.length,
    );
    const targetSeries = alignedSeries.length ? alignedSeries : series;
    const pointCount = alignedSeries.length
      ? requestedX.length
      : Math.max(0, ...targetSeries.map((item) => item.values?.length || 0));
    const x =
      requestedX.length === pointCount
        ? requestedX
        : Array.from({ length: pointCount }, (_, index) => index);
    const cleanSeries = series
      .map((item) => ({
        ...item,
        values: (item.values || []).map((value) =>
          isFiniteNumber(value) ? Number(value) : null,
        ),
      }))
      .filter((item) => item.values.length === pointCount && pointCount > 0);
    return { x, series: cleanSeries };
  }, [series, xValues]);

  const firstX = normalized.x[0] ?? 0;
  const lastX = normalized.x.at(-1) ?? firstX + 1;
  const fullMin = firstX === lastX ? firstX - 0.5 : firstX;
  const fullMax = firstX === lastX ? lastX + 0.5 : lastX;
  const [domain, setDomain] = useState([fullMin, fullMax]);

  useEffect(() => {
    setDomain([fullMin, fullMax]);
  }, [fullMin, fullMax, title]);

  const [viewMin, viewMax] = domain;
  const viewSpan = viewMax - viewMin || 1;
  const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const visibleIndices = normalized.x
    .map((x, index) => ({ x, index }))
    .filter(({ x }) => x >= viewMin && x <= viewMax);
  const yCandidates = [];
  normalized.series.forEach((item) => {
    visibleIndices.forEach(({ index }) => {
      const value = item.values[index];
      if (value !== null) yCandidates.push(value);
    });
  });
  if (isFiniteNumber(threshold)) yCandidates.push(Number(threshold));
  const rawMinY = yCandidates.length ? Math.min(...yCandidates) : 0;
  const rawMaxY = yCandidates.length ? Math.max(...yCandidates) : 1;
  const yPadding = Math.max((rawMaxY - rawMinY) * 0.08, 0.02);
  const minY =
    rawMinY === rawMaxY
      ? zeroFloor
        ? Math.max(0, rawMinY - 1)
        : rawMinY - 1
      : zeroFloor
        ? Math.max(0, rawMinY - yPadding)
        : rawMinY - yPadding;
  const maxY = rawMinY === rawMaxY ? rawMaxY + 1 : rawMaxY + yPadding;
  const ySpan = maxY - minY || 1;

  const toX = (value) => PADDING.left + ((value - viewMin) / viewSpan) * plotWidth;
  const toY = (value) => PADDING.top + (1 - (value - minY) / ySpan) * plotHeight;
  const linePath = (values) =>
    visibleIndices
      .filter(({ index }) => values[index] !== null)
      .map(({ x, index }, pointIndex) => {
        const command = pointIndex === 0 ? "M" : "L";
        return `${command} ${toX(x).toFixed(2)} ${toY(values[index]).toFixed(2)}`;
      })
      .join(" ");

  function zoomAt(factor, anchorRatio = 0.5) {
    const nextSpan = viewSpan * factor;
    const anchor = viewMin + viewSpan * anchorRatio;
    const nextStart = anchor - nextSpan * anchorRatio;
    setDomain(clampDomain(nextStart, nextStart + nextSpan, fullMin, fullMax));
  }

  useEffect(() => {
    const node = svgRef.current;
    if (!node) return undefined;

    function handleNativeWheel(event) {
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      const anchorRatio = Math.min(
        1,
        Math.max(0, (event.clientX - rect.left) / rect.width),
      );
      const factor = event.deltaY < 0 ? 0.82 : 1.2;

      setDomain(([currentMin, currentMax]) => {
        const currentSpan = currentMax - currentMin || 1;
        const nextSpan = currentSpan * factor;
        const anchor = currentMin + currentSpan * anchorRatio;
        const nextStart = anchor - nextSpan * anchorRatio;
        return clampDomain(nextStart, nextStart + nextSpan, fullMin, fullMax);
      });
    }

    node.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => node.removeEventListener("wheel", handleNativeWheel);
  }, [fullMin, fullMax]);

  function handlePointerDown(event) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointersRef.current.values()];

    if (points.length === 1) {
      gestureRef.current = {
        type: "pan",
        startX: points[0].x,
        domain: [...domain],
      };
    } else if (points.length === 2) {
      gestureRef.current = {
        type: "pinch",
        distance: Math.abs(points[1].x - points[0].x) || 1,
        center: (points[0].x + points[1].x) / 2,
        domain: [...domain],
      };
    }
  }

  function handlePointerMove(event) {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointersRef.current.values()];
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !gestureRef.current) return;

    if (points.length === 1 && gestureRef.current.type === "pan") {
      const [start, end] = gestureRef.current.domain;
      const shift = ((gestureRef.current.startX - points[0].x) / rect.width) * (end - start);
      setDomain(clampDomain(start + shift, end + shift, fullMin, fullMax));
    } else if (points.length === 2) {
      const initial = gestureRef.current;
      const distance = Math.abs(points[1].x - points[0].x) || 1;
      const ratio = distance / (initial.distance || distance);
      const initialSpan = initial.domain[1] - initial.domain[0];
      const nextSpan = initialSpan / ratio;
      const centerRatio = Math.min(1, Math.max(0, (initial.center - rect.left) / rect.width));
      const anchor = initial.domain[0] + initialSpan * centerRatio;
      const nextStart = anchor - nextSpan * centerRatio;
      setDomain(clampDomain(nextStart, nextStart + nextSpan, fullMin, fullMax));
    }
  }

  function handlePointerEnd(event) {
    pointersRef.current.delete(event.pointerId);
    const points = [...pointersRef.current.values()];
    if (points.length === 1) {
      gestureRef.current = {
        type: "pan",
        startX: points[0].x,
        domain: [...domain],
      };
    } else if (points.length === 0) {
      gestureRef.current = null;
    }
  }

  if (!normalized.series.length) return null;

  const barCount = Math.max(1, visibleIndices.length);
  const barWidth = Math.max(2, Math.min(34, (plotWidth / barCount) * 0.68));

  return (
    <section
      className="min-w-0 rounded-lg border border-slate-200 bg-white p-4"
      data-report-plot
      data-report-title={title}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-950">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => zoomAt(0.72)}
            title="Zoom in"
            aria-label="Zoom in"
            className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-lg font-semibold text-slate-700 hover:bg-slate-50"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => zoomAt(1.38)}
            title="Zoom out"
            aria-label="Zoom out"
            className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-lg font-semibold text-slate-700 hover:bg-slate-50"
          >
            -
          </button>
          <button
            type="button"
            onClick={() => setDomain([fullMin, fullMax])}
            data-report-reset
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {normalized.series.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span className="h-2.5 w-5 rounded-sm" style={{ backgroundColor: item.color }} />
            {item.label}
          </div>
        ))}
        {isFiniteNumber(threshold) ? (
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span className="h-0 w-5 border-t-2 border-dashed border-rose-700" />
            Threshold
          </div>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
          <span className="font-semibold text-slate-900">X: {xLabel}</span>
          <span className="ml-2">
            View {formatValue(viewMin, 2)} to {formatValue(viewMax, 2)}
            {xUnit ? ` ${xUnit}` : ""}
            {" / "}full {formatValue(fullMin, 2)} to {formatValue(fullMax, 2)}
            {xUnit ? ` ${xUnit}` : ""} / {normalized.x.length} points
          </span>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
          <span className="font-semibold text-slate-900">Y: {yLabel}</span>
          <span className="ml-2">
            {formatValue(minY, 2)} to {formatValue(maxY, 2)}
            {yUnit ? ` ${yUnit}` : ""}
          </span>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="block h-64 w-full cursor-grab select-none active:cursor-grabbing"
          style={{ touchAction: "none" }}
          role="img"
          aria-label={title}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          <defs>
            <clipPath id={clipId}>
              <rect
                x={PADDING.left}
                y={PADDING.top}
                width={plotWidth}
                height={plotHeight}
              />
            </clipPath>
          </defs>

          {Array.from({ length: 5 }, (_, index) => {
            const fraction = index / 4;
            const y = PADDING.top + plotHeight * fraction;
            const value = maxY - ySpan * fraction;
            return (
              <g key={`y-${fraction}`}>
                <line
                  x1={PADDING.left}
                  x2={CHART_WIDTH - PADDING.right}
                  y1={y}
                  y2={y}
                  stroke="#e2e8f0"
                />
                <text x={PADDING.left - 9} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">
                  {formatValue(value, 2)}{yUnit ? ` ${yUnit}` : ""}
                </text>
              </g>
            );
          })}

          {Array.from({ length: 5 }, (_, index) => {
            const fraction = index / 4;
            const x = PADDING.left + plotWidth * fraction;
            const value = viewMin + viewSpan * fraction;
            return (
              <g key={`x-${fraction}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={PADDING.top}
                  y2={CHART_HEIGHT - PADDING.bottom}
                  stroke="#eef2f7"
                />
                <text
                  x={x}
                  y={CHART_HEIGHT - 14}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#64748b"
                >
                  {xTickLabels?.[index] ||
                    `${formatValue(value, 2)}${xUnit ? ` ${xUnit}` : ""}`}
                </text>
              </g>
            );
          })}

          <text
            x={PADDING.left + plotWidth / 2}
            y={CHART_HEIGHT - 8}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill="#334155"
          >
            {xLabel}{xUnit ? ` (${xUnit})` : ""}
          </text>
          <text
            x="18"
            y={PADDING.top + plotHeight / 2}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill="#334155"
            transform={`rotate(-90 18 ${PADDING.top + plotHeight / 2})`}
          >
            {yLabel}{yUnit ? ` (${yUnit})` : ""}
          </text>

          <g clipPath={`url(#${clipId})`}>
            {spans.map((span, index) => {
              if (!isFiniteNumber(span.start) || !isFiniteNumber(span.end)) return null;
              if (span.end < viewMin || span.start > viewMax) return null;
              const start = Math.max(viewMin, Number(span.start));
              const end = Math.min(viewMax, Number(span.end));
              const x = toX(start);
              const width = Math.max(1, toX(end) - x);
              return (
                <g key={`${span.label || "span"}-${index}`}>
                  <rect
                    x={x}
                    y={PADDING.top}
                    width={width}
                    height={plotHeight}
                    fill={span.color || "rgba(148, 163, 184, 0.14)"}
                    stroke={span.stroke || "rgba(100, 116, 139, 0.35)"}
                    strokeWidth="0.8"
                  />
                  {span.label && width > 42 ? (
                    <text
                      x={x + width / 2}
                      y={PADDING.top + 14}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="700"
                      fill={span.stroke || "#475569"}
                    >
                      {span.label}
                    </text>
                  ) : null}
                </g>
              );
            })}

            {kind === "bar"
              ? normalized.series.map((item, seriesIndex) =>
                  visibleIndices.map(({ x, index }) => {
                    const value = item.values[index];
                    if (value === null) return null;
                    const groupedWidth = barWidth / normalized.series.length;
                    const left =
                      toX(x) -
                      barWidth / 2 +
                      seriesIndex * groupedWidth;
                    const zeroY = toY(Math.max(0, minY));
                    const valueY = toY(value);
                    return (
                      <rect
                        key={`${item.label}-${index}`}
                        x={left}
                        y={Math.min(zeroY, valueY)}
                        width={Math.max(1, groupedWidth - 1)}
                        height={Math.max(1, Math.abs(zeroY - valueY))}
                        fill={item.color}
                        opacity="0.88"
                      />
                    );
                  }),
                )
              : normalized.series.map((item) => (
                  <path
                    key={item.label}
                    d={linePath(item.values)}
                    fill="none"
                    stroke={item.color}
                    strokeWidth={item.width || 2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={item.opacity || 1}
                  />
                ))}

            {markers.map((marker, index) => {
              const value = Number(marker.x ?? marker.time);
              if (!Number.isFinite(value) || value < viewMin || value > viewMax) return null;
              const x = toX(value);
              return (
                <g key={`${marker.label || "marker"}-${index}`}>
                  <line
                    x1={x}
                    x2={x}
                    y1={PADDING.top}
                    y2={CHART_HEIGHT - PADDING.bottom}
                    stroke={marker.color || "#334155"}
                    strokeDasharray="4 4"
                  />
                  {marker.label ? (
                    <text
                      x={x + 3}
                      y={PADDING.top + 25 + (index % 3) * 13}
                      fontSize="9"
                      fontWeight="700"
                      fill={marker.color || "#334155"}
                    >
                      {marker.label}
                    </text>
                  ) : null}
                </g>
              );
            })}

            {isFiniteNumber(threshold) ? (
              <line
                x1={PADDING.left}
                x2={CHART_WIDTH - PADDING.right}
                y1={toY(Number(threshold))}
                y2={toY(Number(threshold))}
                stroke={COLORS.threshold}
                strokeDasharray="7 5"
                strokeWidth="1.6"
              />
            ) : null}
          </g>
        </svg>
      </div>
    </section>
  );
}

function getSignals(result, analysis) {
  const signals = analysis.signals || {};
  const plot = result.plot || {};
  const plotTime = plot.timeAxisS || [];
  const plotAmplitude = plot.amplitude || [];
  const plotEnvelope = plot.envelope || [];
  const plotIsAligned =
    plotTime.length > 0 &&
    plotAmplitude.length === plotTime.length &&
    plotEnvelope.length === plotTime.length;

  if (plotIsAligned) {
    return {
      time: plotTime,
      raw: [],
      filtered: plotAmplitude,
      envelope: plotEnvelope,
    };
  }

  return {
    time: signals.time_axis_s || [],
    raw: signals.raw || [],
    filtered: signals.filtered_normalized || [],
    envelope: signals.envelope || [],
  };
}

function cycleSpan(cycle, sampleRate, label, color, stroke) {
  return {
    label,
    start: Number(cycle._s1_start) / sampleRate,
    end: Number(cycle._dia_end) / sampleRate,
    color,
    stroke,
  };
}

function buildPlots(result, analysis) {
  const signals = getSignals(result, analysis);
  const sampleRate = Number(analysis.file_info?.sample_rate_hz) || 1;
  const peaks = analysis.peaks || {};
  const segmentation = analysis.segmentation || {};
  const classification = analysis.classification || {};
  const cycles = classification.cycles || [];
  const outliers = new Set(
    classification.robust_outliers?.outlier_cycle_indices || [],
  );
  const murmurCycles = analysis.murmur?.cycle_results || [];
  const activities = analysis.advanced_activity?.cycle_results || [];
  const morphology = analysis.morphology;
  const qualityBands = analysis.signal_quality?.subband_energy_ratio || {};

  const segmentationSpans = (segmentation.segments || []).map((segment) => ({
    label: segment.state,
    start: segment.start_s,
    end: segment.end_s,
    color: SEGMENT_COLORS[segment.state],
    stroke: SEGMENT_STROKES[segment.state],
  }));
  const peakMarkers = [
    ...(peaks.s1_times_s || []).map((time) => ({
      time,
      label: "S1",
      color: SEGMENT_STROKES.S1,
    })),
    ...(peaks.s2_times_s || []).map((time) => ({
      time,
      label: "S2",
      color: SEGMENT_STROKES.S2,
    })),
  ];
  const outlierSpans = cycles.map((cycle, index) =>
    cycleSpan(
      cycle,
      sampleRate,
      outliers.has(index) ? `Outlier ${index + 1}` : `Cycle ${index + 1}`,
      outliers.has(index) ? "rgba(239, 68, 68, 0.16)" : "rgba(16, 185, 129, 0.08)",
      outliers.has(index) ? COLORS.outlier : COLORS.normal,
    ),
  );
  const murmurSpans = [];
  cycles.forEach((cycle, index) => {
    const resultForCycle = murmurCycles[index] || {};
    if (resultForCycle.systolic_murmur_like) {
      murmurSpans.push({
        label: `Sys ${index + 1}`,
        start: Number(cycle._sys_start) / sampleRate,
        end: Number(cycle._sys_end) / sampleRate,
        color: "rgba(245, 158, 11, 0.22)",
        stroke: COLORS.systolic,
      });
    }
    if (resultForCycle.diastolic_murmur_like) {
      murmurSpans.push({
        label: `Dia ${index + 1}`,
        start: Number(cycle._dia_start) / sampleRate,
        end: Number(cycle._dia_end) / sampleRate,
        color: "rgba(124, 58, 237, 0.18)",
        stroke: COLORS.diastolic,
      });
    }
  });
  const activitySpans = [];
  activities.forEach((activity) => {
    const cycle = cycles[activity.cycle_index];
    if (!cycle) return;
    if (activity.systolic_active) {
      activitySpans.push({
        label: activity.systolic_timing,
        start: Number(cycle._sys_start) / sampleRate,
        end: Number(cycle._sys_end) / sampleRate,
        color: "rgba(220, 38, 38, 0.17)",
        stroke: "#dc2626",
      });
    }
    const diaStart = Number(cycle._dia_start) / sampleRate;
    const diaEnd = Number(cycle._dia_end) / sampleRate;
    const third = (diaEnd - diaStart) / 3;
    if (activity.mid_diastolic_active) {
      activitySpans.push({
        label: "Mid diastolic",
        start: diaStart + third,
        end: diaStart + third * 2,
        color: "rgba(124, 58, 237, 0.18)",
        stroke: COLORS.diastolic,
      });
    }
    if (activity.late_diastolic_active) {
      activitySpans.push({
        label: "Late diastolic",
        start: diaStart + third * 2,
        end: diaEnd,
        color: "rgba(124, 58, 237, 0.23)",
        stroke: COLORS.diastolic,
      });
    }
  });

  const cycleIndices = cycles.map((_, index) => index + 1);
  const morphologyX = morphology?.valid_cycle_indices?.map((index) => index + 1) || [];
  const qualityLabels = Object.keys(qualityBands).map((label) =>
    label.replaceAll("_", "-").replace("-hz", " Hz"),
  );

  return [
    {
      title: "Filtered waveform, envelope, and segmentation",
      subtitle: "Detected S1/S2 positions and four-state cardiac segmentation.",
      xValues: signals.time,
      series: [
        { label: "Filtered PCG", values: signals.filtered, color: COLORS.filtered },
        { label: "Envelope", values: signals.envelope, color: COLORS.envelope, opacity: 0.85 },
      ],
      spans: segmentationSpans,
      markers: peakMarkers,
      xUnit: "s",
      xLabel: "Time",
      yLabel: "Normalized amplitude",
    },
    {
      title: "Robust cycle outlier overlay",
      subtitle: "Accepted cycles colored by median/MAD outlier status.",
      xValues: signals.time,
      series: [{ label: "Filtered PCG", values: signals.filtered, color: COLORS.filtered }],
      spans: outlierSpans,
      xUnit: "s",
      xLabel: "Time",
      yLabel: "Normalized amplitude",
    },
    {
      title: "Murmur-like activity overlay",
      subtitle: "Flagged systolic and diastolic intervals from cycle energy ratios.",
      xValues: signals.time,
      series: [{ label: "Filtered PCG", values: signals.filtered, color: COLORS.filtered }],
      spans: murmurSpans,
      xUnit: "s",
      xLabel: "Time",
      yLabel: "Normalized amplitude",
    },
    {
      title: "Advanced activity timeline",
      subtitle: "Systolic timing plus active mid and late diastolic thirds.",
      xValues: signals.time,
      series: [{ label: "Filtered PCG", values: signals.filtered, color: COLORS.filtered }],
      spans: activitySpans,
      xUnit: "s",
      xLabel: "Time",
      yLabel: "Normalized amplitude",
    },
    {
      title: "Cycle heart rate",
      subtitle: "Per-cycle heart-rate estimate.",
      xValues: cycleIndices,
      series: [
        {
          label: "Heart rate",
          values: cycles.map((cycle) => cycle.heart_rate_bpm),
          color: COLORS.filtered,
        },
      ],
      xLabel: "Cycle",
      yLabel: "Heart rate",
      yUnit: "bpm",
      zeroFloor: true,
    },
    {
      title: "Cycle phase durations",
      subtitle: "S1, systolic, S2, and diastolic duration by accepted cycle.",
      xValues: cycleIndices,
      series: [
        { label: "S1", values: cycles.map((cycle) => cycle.s1_duration_ms), color: SEGMENT_STROKES.S1 },
        { label: "Systole", values: cycles.map((cycle) => cycle.systolic_ms), color: SEGMENT_STROKES.Systole },
        { label: "S2", values: cycles.map((cycle) => cycle.s2_duration_ms), color: SEGMENT_STROKES.S2 },
        { label: "Diastole", values: cycles.map((cycle) => cycle.diastolic_ms), color: SEGMENT_STROKES.Diastole },
      ],
      xLabel: "Cycle",
      yLabel: "Duration",
      yUnit: "ms",
      zeroFloor: true,
    },
    {
      title: "Murmur energy ratios",
      subtitle: "Systolic and diastolic energy relative to mean S1/S2 RMS.",
      xValues: cycleIndices,
      series: [
        {
          label: "Systolic ratio",
          values: murmurCycles.map((cycle) => cycle.systolic_ratio),
          color: COLORS.systolic,
        },
        {
          label: "Diastolic ratio",
          values: murmurCycles.map((cycle) => cycle.diastolic_ratio),
          color: COLORS.diastolic,
        },
      ],
      kind: "bar",
      threshold: analysis.murmur?.detection_ratio,
      xLabel: "Cycle",
      yLabel: "Energy ratio",
      zeroFloor: true,
    },
    {
      title: "Cycle morphology similarity",
      subtitle: "Correlation against the S1-aligned mean cycle template.",
      xValues: morphologyX,
      series: [
        {
          label: "Template correlation",
          values: morphology?.cycle_template_correlations || [],
          color: COLORS.morphology,
        },
      ],
      kind: "bar",
      threshold: morphology?.low_similarity_threshold,
      xLabel: "Cycle",
      yLabel: "Correlation",
    },
    {
      title: "Filtered PCG sub-band energy",
      subtitle: "Relative energy distribution across configured quality sub-bands.",
      xValues: qualityLabels.map((_, index) => index + 1),
      series: [
        {
          label: qualityLabels.join(" | ") || "Sub-band ratio",
          values: Object.values(qualityBands),
          color: "#0369a1",
        },
      ],
      kind: "bar",
      xLabel: "Frequency band",
      yLabel: "Energy ratio",
      zeroFloor: true,
      xTickLabels: [
        qualityLabels[0] || "1",
        "",
        qualityLabels[1] || "2",
        "",
        qualityLabels[2] || "3",
      ],
    },
  ].filter((plot) => plot.series.some((item) => item.values?.length));
}

function FetchedAudioPlayer({
  url,
  version,
  missingMessage,
  loadingMessage,
  requestLabel,
}) {
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!url) {
      setSource("");
      setStatus("missing");
      return undefined;
    }

    const controller = new AbortController();
    let objectUrl = "";
    const requestUrl = new URL(resolveApiUrl(url));
    if (version) requestUrl.searchParams.set("v", version);

    setStatus("loading");
    setError("");
    fetch(requestUrl, {
      headers: { Accept: "audio/wav,audio/*" },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`${requestLabel} request failed with ${response.status}`);
        }
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(
          blob.type ? blob : new Blob([blob], { type: "audio/wav" }),
        );
        setSource(objectUrl);
        setStatus("ready");
      })
      .catch((requestError) => {
        if (requestError.name === "AbortError") return;
        setStatus("error");
        setError(requestError.message);
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, version]);

  if (status === "missing") {
    return <p className="mt-3 text-sm text-slate-600">{missingMessage}</p>;
  }
  if (status === "loading") {
    return <p className="mt-3 text-sm text-slate-600">{loadingMessage}</p>;
  }
  if (status === "error") {
    return <p className="mt-3 text-sm font-medium text-rose-700">{error}</p>;
  }

  return (
    <audio
      key={source}
      className="mt-3 w-full"
      controls
      preload="metadata"
      src={source}
      onError={() => {
        setStatus("error");
        setError(`The browser could not decode the ${requestLabel.toLowerCase()} WAV.`);
      }}
    >
      Your browser does not support WAV playback.
    </audio>
  );
}

function AudioPlayers({ result, record }) {
  const originalUrl = result.audioUrl || record?.audioUrl;
  const filteredUrl = result.filteredAudioUrl;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase text-slate-500">Original recording</p>
        <FetchedAudioPlayer
          url={originalUrl}
          version={result.generatedAt}
          missingMessage="Original audio is unavailable."
          loadingMessage="Preparing original audio..."
          requestLabel="Original audio"
        />
      </div>
      <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
        <p className="text-xs font-semibold uppercase text-sky-700">Filtered recording</p>
        <FetchedAudioPlayer
          url={filteredUrl}
          version={result.generatedAt}
          missingMessage="Filtered audio was not exported."
          loadingMessage="Preparing filtered audio..."
          requestLabel="Filtered audio"
        />
      </div>
    </div>
  );
}

function hrvMetricRows(hrv) {
  if (!hrv) return [];
  const keys = Array.from(new Set([...Object.keys(hrv.raw || {}), ...Object.keys(hrv.clean || {})]));
  return keys.map((key) => ({
    metric: titleize(key),
    raw: hrv.raw?.[key],
    clean: hrv.clean?.[key],
  }));
}

export default function AnalyticsResultPanel({ result, record, patient }) {
  if (!result) return null;

  const reportRootRef = useRef(null);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const analysis = result.analysis || result;
  const fileInfo = analysis.file_info || {};
  const peaks = analysis.peaks || {};
  const segmentation = analysis.segmentation || {};
  const classification = analysis.classification || {};
  const cycles = classification.cycles || [];
  const ruleBased = classification.rule_based || {};
  const outliers = classification.robust_outliers || {};
  const murmur = analysis.murmur || {};
  const robustHrv = analysis.robust_hrv;
  const quality = analysis.signal_quality || {};
  const morphology = analysis.morphology;
  const activity = analysis.advanced_activity || {};
  const plots = buildPlots(result, analysis);
  const segmentationRows = Object.entries(segmentation.stats || {}).map(([state, stats]) => ({
    state,
    ...stats,
  }));
  const cycleStatsRows = Object.entries(classification.per_cycle_stats || {}).map(
    ([metric, stats]) => ({ metric: titleize(metric), ...stats }),
  );
  const qualityRows = Object.entries(quality.filtered_spectral_features || {}).map(
    ([metric, value]) => ({ metric: titleize(metric), value }),
  );
  const subbandRows = Object.entries(quality.subband_energy_ratio || {}).map(
    ([band, ratio]) => ({ band: band.replaceAll("_", "-"), ratio }),
  );
  const ruleRows = (ruleBased.flagged_details || []).map((finding) => ({
    cycle_index: finding.cycle_index,
    violations: finding.violations,
  }));
  const activityRows = activity.cycle_results || [];
  const cycleRows = cycles.map((cycle, index) => ({
    cycle: index + 1,
    ...Object.fromEntries(
      Object.entries(cycle).filter(([key]) => !key.startsWith("_")),
    ),
  }));
  const cycleTimingColumns = [
    "cycle",
    "heart_rate_bpm",
    "cycle_duration_ms",
    "s1_duration_ms",
    "systolic_ms",
    "s2_duration_ms",
    "diastolic_ms",
    "sd_ratio",
    "s1_s2_amp_ratio",
  ];
  const cycleAcousticColumns = [
    "cycle",
    "s1_rms",
    "s2_rms",
    "energy_concentration",
    "s1_zcr",
    "s2_zcr",
    "s1_kurtosis",
    "s2_kurtosis",
    "s1_centroid",
    "s2_centroid",
    "sys_noise_ratio",
    "dia_noise_ratio",
  ];
  const cycleMfccColumns = [
    "cycle",
    "mfcc_0",
    "mfcc_1",
    "mfcc_2",
    "mfcc_3",
    "mfcc_4",
    "mfcc_5",
    "mfcc_6",
    "mfcc_7",
  ];
  const activityTimingColumns = [
    "cycle_index",
    "systolic_active",
    "systolic_ratio",
    "systolic_timing",
    "systolic_shape",
    "diastolic_active",
    "diastolic_ratio",
    "diastolic_timing",
    "mid_diastolic_active",
    "late_diastolic_active",
  ];
  const activityFractionColumns = [
    "cycle_index",
    "systolic_early_fraction",
    "systolic_mid_fraction",
    "systolic_late_fraction",
    "systolic_peak_position",
    "diastolic_early_fraction",
    "diastolic_mid_fraction",
    "diastolic_late_fraction",
    "diastolic_early_ratio",
    "diastolic_mid_ratio",
    "diastolic_late_ratio",
  ];
  const heartRate =
    robustHrv?.clean?.heart_rate_mean_bpm ??
    robustHrv?.raw?.heart_rate_mean_bpm ??
    classification.hrv_metrics?.heart_rate_mean_bpm ??
    classification.per_cycle_stats?.heart_rate_bpm?.mean;
  const sdnn = robustHrv?.clean?.sdnn_ms ?? robustHrv?.raw?.sdnn_ms;
  const rmssd = robustHrv?.clean?.rmssd_ms ?? robustHrv?.raw?.rmssd_ms;

  async function handleDownloadReport() {
    setIsReportLoading(true);
    setReportError("");
    try {
      reportRootRef.current
        ?.querySelectorAll("[data-report-reset]")
        .forEach((button) => button.click());
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      const { createAnalysisPdfReport } = await import("@/lib/analyticsReport");
      await createAnalysisPdfReport({
        result,
        patient,
        record,
        plotElements: reportRootRef.current?.querySelectorAll("[data-report-plot]"),
      });
    } catch (error) {
      setReportError(
        error instanceof Error ? error.message : "Unable to create the PDF report.",
      );
    } finally {
      setIsReportLoading(false);
    }
  }

  return (
    <div ref={reportRootRef} className="min-w-0 space-y-6">
      <Section
        eyebrow="PCG analysis"
        title="Complete analytic result"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleDownloadReport}
              disabled={isReportLoading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isReportLoading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              {isReportLoading ? "Creating report..." : "Download report"}
            </button>
            {record ? <DetailChip tone="sky">{record.areaLabel}</DetailChip> : null}
            <DetailChip>{result.recordingId || record?.id}</DetailChip>
          </div>
        }
      >
        <div>
          <p className="text-xs font-semibold uppercase text-sky-700">
            Key clinical metrics
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Mean heart rate" value={heartRate} unit="bpm" tone="sky" />
          <Metric label="SDNN" value={sdnn} unit="ms" />
          <Metric label="RMSSD" value={rmssd} unit="ms" />
          <Metric label="Accepted cycles" value={cycles.length} tone="emerald" />
          <Metric label="Outlier cycles" value={outliers.n_outlier_cycles || 0} tone="rose" />
          <Metric label="Noise reduction" value={quality.out_of_band_reduction_pct} unit="%" tone="emerald" />
          <Metric label="Morphology similarity" value={morphology?.mean_similarity} tone="violet" />
          </div>
          <div className="mt-3">
            <FindingBanner
              title="Murmur-like screening"
              text={murmur.assessment}
              tone={
                (murmur.systolic_pct || 0) > 50 || (murmur.diastolic_pct || 0) > 50
                  ? "rose"
                  : "sky"
              }
            />
          </div>
        </div>

        <div className="mt-5">
          <AudioPlayers result={result} record={record} />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Duration" value={fileInfo.duration_s} unit="s" />
          <Metric label="Sample rate" value={fileInfo.sample_rate_hz} unit="Hz" />
          <Metric label="S1 peaks" value={peaks.s1_count} />
          <Metric label="S2 peaks" value={peaks.s2_count} />
        </div>

        {reportError ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {reportError}
          </p>
        ) : null}
      </Section>

      <Section eyebrow="Interactive plots" title="Signals and cycle analytics">
        <div className="grid gap-4">
          {plots.map((plot) => (
            <InteractivePlot key={plot.title} {...plot} />
          ))}
        </div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section eyebrow="Murmur-like screening" title={murmur.assessment || "Assessment unavailable"}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Systolic cycles" value={murmur.systolic_murmur_cycles} tone="rose" />
            <Metric label="Diastolic cycles" value={murmur.diastolic_murmur_cycles} tone="violet" />
            <Metric label="Systolic activity" value={murmur.systolic_pct} unit="%" />
            <Metric label="Diastolic activity" value={murmur.diastolic_pct} unit="%" />
          </div>
        </Section>

        <Section eyebrow="Signal quality" title="Filtering and spectral profile">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Raw out-of-band" value={quality.raw_out_of_band_ratio} />
            <Metric label="Filtered out-of-band" value={quality.filtered_out_of_band_ratio} tone="emerald" />
            <Metric label="Reduction" value={quality.out_of_band_reduction_pct} unit="%" tone="sky" />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <FlatTable rows={qualityRows} columns={["metric", "value"]} />
            <FlatTable rows={subbandRows} columns={["band", "ratio"]} />
          </div>
        </Section>
      </div>

      <Section eyebrow="HRV-like analysis" title="Raw and artifact-cleaned intervals">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Median RR" value={robustHrv?.median_rr_ms} unit="ms" />
          <Metric label="Intervals kept" value={robustHrv?.n_kept_intervals} tone="emerald" />
          <Metric label="Intervals rejected" value={robustHrv?.n_rejected_intervals} tone="rose" />
          <Metric
            label="Rejection range"
            value={robustHrv?.rejection_range_ms?.map((value) => `${formatValue(value, 1)} ms`)}
          />
        </div>
        <div className="mt-4">
          <FlatTable
            rows={hrvMetricRows(robustHrv)}
            columns={["metric", "raw", "clean"]}
            emptyMessage="Not enough usable S1-S1 intervals for robust HRV analysis."
          />
        </div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section eyebrow="Segmentation" title="State duration statistics">
          <FlatTable
            rows={segmentationRows}
            columns={["state", "count", "mean_ms", "std_ms", "min_ms", "max_ms"]}
          />
        </Section>
        <Section eyebrow="Cycle summary" title="Per-cycle aggregate statistics">
          <FlatTable
            rows={cycleStatsRows}
            columns={["metric", "mean", "std", "min", "max"]}
          />
        </Section>
      </div>

      <Section eyebrow="Screening details" title="Rules, robust outliers, and rejected cycles">
        <div className="grid gap-6">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              Rule-based flags ({ruleBased.flagged_cycles || 0})
            </h3>
            <FlatTable rows={ruleRows} columns={["cycle_index", "violations"]} />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              Robust MAD findings ({outliers.findings?.length || 0})
            </h3>
            <FlatTable
              rows={outliers.findings || []}
              columns={["cycle_index", "feature", "value", "robust_z"]}
            />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              Rejected cycles ({classification.rejected_cycles?.length || 0})
            </h3>
            <FlatTable rows={classification.rejected_cycles || []} />
          </div>
        </div>
      </Section>

      <Section eyebrow="Morphology" title="Cycle-template consistency">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Aligned cycles" value={morphology?.n_aligned_cycles} />
          <Metric label="Mean similarity" value={morphology?.mean_similarity} tone="emerald" />
          <Metric label="Median similarity" value={morphology?.median_similarity} />
          <Metric label="Low-similarity cycles" value={morphology?.low_similarity_cycle_indices?.length || 0} tone="rose" />
        </div>
        <div className="mt-4">
          <ObjectTable value={morphology || {}} emptyMessage="Morphology requires at least three aligned cycles." />
        </div>
      </Section>

      <Section eyebrow="Advanced activity" title="Per-cycle systolic and diastolic timing">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Ratio threshold" value={activity.ratio_threshold} />
          <Metric label="Systolic active cycles" value={activity.systolic_active_cycles} tone="rose" />
          <Metric label="Mid/late diastolic cycles" value={activity.mid_late_diastolic_active_cycles} tone="violet" />
        </div>
        <div className="mt-4 grid gap-4">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              Activity and timing
            </h3>
            <FlatTable rows={activityRows} columns={activityTimingColumns} compact />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              Phase fractions and ratios
            </h3>
            <FlatTable rows={activityRows} columns={activityFractionColumns} compact />
          </div>
        </div>
      </Section>

      <Section eyebrow="Cycle features" title="All accepted cycle measurements">
        <div className="grid gap-5">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              Timing and cardiac-cycle metrics
            </h3>
            <FlatTable rows={cycleRows} columns={cycleTimingColumns} compact />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              Acoustic and spectral metrics
            </h3>
            <FlatTable rows={cycleRows} columns={cycleAcousticColumns} compact />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              MFCC coefficients
            </h3>
            <FlatTable rows={cycleRows} columns={cycleMfccColumns} compact />
          </div>
        </div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section eyebrow="Input" title="File information">
          <ObjectTable value={fileInfo} />
        </Section>
        <Section eyebrow="Pipeline" title="Configuration used">
          <ObjectTable value={analysis.config || {}} />
        </Section>
      </div>

    </div>
  );
}
