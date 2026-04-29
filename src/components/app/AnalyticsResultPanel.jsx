import DetailChip from "@/components/app/DetailChip";

const CHART_WIDTH = 960;
const CHART_HEIGHT = 280;
const CHART_PADDING = {
  top: 20,
  right: 20,
  bottom: 32,
  left: 48,
};
const MAX_SIGNAL_POINTS = 420;
const SEGMENT_ORDER = ["S1", "Systole", "S2", "Diastole"];
const SEGMENT_COLORS = {
  Diastole: "rgba(16, 185, 129, 0.18)",
  S1: "rgba(244, 63, 94, 0.18)",
  S2: "rgba(59, 130, 246, 0.18)",
  Systole: "rgba(245, 158, 11, 0.18)",
};
const SEGMENT_STROKES = {
  Diastole: "#10b981",
  S1: "#fb7185",
  S2: "#38bdf8",
  Systole: "#f59e0b",
};
const MARKER_COLORS = {
  Peak: "#0f172a",
  S1: "#e11d48",
  S2: "#2563eb",
};

function formatValue(value, digits = 2) {
  if (value === null || value === undefined || value === "") return "Not returned";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "Not returned";
    if (Math.abs(value) >= 100 || Number.isInteger(value)) return String(Math.round(value));
    return value.toFixed(digits);
  }
  return String(value);
}

function toSeriesPoints(xValues, yValues) {
  if (!Array.isArray(yValues) || yValues.length === 0) return [];

  const safeX =
    Array.isArray(xValues) && xValues.length === yValues.length
      ? xValues
      : yValues.map((_, index) => index);

  if (yValues.length <= MAX_SIGNAL_POINTS) {
    return yValues.map((value, index) => ({ x: safeX[index], y: value }));
  }

  const bucketSize = Math.ceil(yValues.length / MAX_SIGNAL_POINTS);
  const points = [];

  for (let index = 0; index < yValues.length; index += bucketSize) {
    const valueBucket = yValues.slice(index, index + bucketSize);
    const xBucket = safeX.slice(index, index + bucketSize);

    points.push({
      x: xBucket.reduce((sum, value) => sum + value, 0) / xBucket.length,
      y: valueBucket.reduce((sum, value) => sum + value, 0) / valueBucket.length,
    });
  }

  return points;
}

function firstArray(...values) {
  return values.find((value) => Array.isArray(value) && value.length > 0) || [];
}

function getSegmentLegend(spans) {
  const presentLabels = new Set(
    spans
      .map((span) => span.label)
      .filter((label) => SEGMENT_ORDER.includes(label)),
  );
  const labels = SEGMENT_ORDER.filter((label) => presentLabels.has(label));

  return labels.map((label) => ({
    label,
    fill: SEGMENT_COLORS[label],
    stroke: SEGMENT_STROKES[label],
  }));
}

function buildPath(points, minY, maxY) {
  if (!points.length) return "";

  const plotWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
  const minX = points[0].x;
  const maxX = points[points.length - 1].x || minX + 1;
  const xSpan = maxX - minX || 1;
  const ySpan = maxY - minY || 1;

  return points
    .map((point, index) => {
      const x = CHART_PADDING.left + ((point.x - minX) / xSpan) * plotWidth;
      const y =
        CHART_PADDING.top + (1 - (point.y - minY) / ySpan) * plotHeight;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function normalizeSegments(result) {
  const segments =
    result.events?.segments ||
    result.segmentation?.segments ||
    result.analysis?.segmentation?.segments ||
    [];

  return segments
    .map((segment) => {
      const label = segment.state || segment.label || "Segment";

      return {
        label,
        start: segment.start_s ?? segment.startS ?? segment.start,
        end: segment.end_s ?? segment.endS ?? segment.end,
        color: SEGMENT_COLORS[label] || "rgba(148, 163, 184, 0.16)",
        stroke: SEGMENT_STROKES[label] || "#94a3b8",
      };
    })
    .filter((segment) => Number.isFinite(segment.start) && Number.isFinite(segment.end));
}

function normalizeMarkers(result) {
  const plot = result.plot || {};
  const peaks = result.peaks || result.analysis?.peaks || {};
  const events = result.events || {};
  const allPeakTimes = firstArray(
    plot.peakTimesS,
    plot.peak_times_s,
    events.peak_times_s,
    peaks.peak_times_s,
  );
  const s1Times = firstArray(
    plot.s1TimesS,
    plot.s1_times_s,
    events.s1_times_s,
    peaks.s1_times_s,
  );
  const s2Times = firstArray(
    plot.s2TimesS,
    plot.s2_times_s,
    events.s2_times_s,
    peaks.s2_times_s,
  );
  const labeledTimes = new Set();
  const markers = [];

  s1Times.forEach((time) => {
    labeledTimes.add(time);
    markers.push({ time, label: "S1", color: MARKER_COLORS.S1 });
  });

  s2Times.forEach((time) => {
    labeledTimes.add(time);
    markers.push({ time, label: "S2", color: MARKER_COLORS.S2 });
  });

  allPeakTimes.forEach((time) => {
    if (labeledTimes.has(time)) return;
    markers.push({ time, label: "Peak", color: MARKER_COLORS.Peak });
  });

  return markers.sort((a, b) => a.time - b.time);
}

function getSignalTimeAxis(signals) {
  return signals.timeAxisS || signals.time_axis_s || signals.timeAxis || [];
}

function getPlotDescription(plot, fallback) {
  const details = [];

  if (plot.sampleRateHz) details.push(`${formatValue(plot.sampleRateHz)} Hz`);
  if (plot.durationS) details.push(`${formatValue(plot.durationS, 1)}s`);
  if (plot.downsampled) details.push(`downsampled to ${formatValue(plot.pointCount)} points`);

  return details.length ? `${fallback} ${details.join(" · ")}.` : fallback;
}

function normalizePlotList(result) {
  if (Array.isArray(result.plots) && result.plots.length > 0) {
    return result.plots
      .map((plot, index) => ({
        id: plot.id || `plot-${index}`,
        title: plot.title || `Plot ${index + 1}`,
        description: plot.description || "Returned by the analytics endpoint.",
        xValues: plot.x || plot.timeAxis || plot.time_axis_s || [],
        yValues: plot.y || plot.values || plot.signal || [],
        color: plot.color || "#1d9bf0",
        markers: Array.isArray(plot.markers) ? plot.markers : [],
        spans: Array.isArray(plot.spans) ? plot.spans : [],
      }))
      .filter((plot) => Array.isArray(plot.yValues) && plot.yValues.length > 0);
  }

  const topLevelPlot = result.plot || {};
  const topLevelTimeAxis = getSignalTimeAxis(topLevelPlot);
  const defaultSegments = normalizeSegments(result);
  const defaultMarkers = normalizeMarkers(result);
  const plots = [];

  if (Array.isArray(topLevelPlot.amplitude) && topLevelPlot.amplitude.length > 0) {
    plots.push({
      id: "analysis-amplitude",
      title: "Heart Sound Segmentation",
      description: getPlotDescription(
        topLevelPlot,
        "Four-state segmentation: S1 -> Systole -> S2 -> Diastole.",
      ),
      xValues: topLevelTimeAxis,
      yValues: topLevelPlot.amplitude,
      color: "#0ea5e9",
      markers: [],
      spans: defaultSegments,
      showSegmentLabels: true,
      showSegmentationLegend: true,
      details: [
        `${formatValue(topLevelPlot.sampleRateHz)} Hz`,
        `${formatValue(topLevelPlot.durationS, 1)}s`,
        topLevelPlot.downsampled ? "Downsampled" : "Full resolution",
      ],
    });
  }

  if (Array.isArray(topLevelPlot.envelope) && topLevelPlot.envelope.length > 0) {
    plots.push({
      id: "analysis-envelope",
      title: "Envelope And Peaks",
      description: "Envelope curve with backend-detected S1, S2, and remaining peak markers.",
      xValues: topLevelTimeAxis,
      yValues: topLevelPlot.envelope,
      color: "#0369a1",
      markers: defaultMarkers,
      spans: [],
      details: [
        `${formatValue(defaultMarkers.length)} markers`,
        `${formatValue(defaultSegments.length)} segments`,
      ],
    });
  }

  if (plots.length > 0) return plots;

  const signals = result.signals || result.analysis?.signals || {};
  const timeAxis = getSignalTimeAxis(signals);
  const fallbackFiltered =
    firstArray(signals.filtered_normalized, signals.filteredNormalized, signals.filtered);

  if (Array.isArray(fallbackFiltered) && fallbackFiltered.length > 0) {
    plots.push({
      id: "filtered-pcg",
      title: "Filtered PCG",
      description: "Plot rendered from backend-provided filtered signal data.",
      xValues: timeAxis,
      yValues: fallbackFiltered,
      color: "#1d9bf0",
      markers: [],
      spans: defaultSegments,
      showSegmentLabels: true,
      showSegmentationLegend: true,
    });
  }

  if (Array.isArray(signals.envelope) && signals.envelope.length > 0) {
    plots.push({
      id: "envelope",
      title: "Envelope",
      description: "Plot rendered from backend-provided envelope data.",
      xValues: timeAxis,
      yValues: signals.envelope,
      color: "#0f5bd7",
      markers: defaultMarkers,
      spans: [],
    });
  }

  return plots;
}

function PlotCard({ plot }) {
  const points = toSeriesPoints(plot.xValues, plot.yValues);

  if (!points.length) return null;

  const spans = plot.spans || [];
  const markers = plot.markers || [];
  const segmentLegend = plot.showSegmentationLegend ? getSegmentLegend(spans) : [];
  const plotWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
  const minX = points[0].x;
  const maxX = points[points.length - 1].x || minX + 1;
  const xSpan = maxX - minX || 1;
  const yValues = points.map((point) => point.y);
  const rawMinY = Math.min(...yValues);
  const rawMaxY = Math.max(...yValues);
  const minY = rawMinY === rawMaxY ? rawMinY - 1 : rawMinY;
  const maxY = rawMinY === rawMaxY ? rawMaxY + 1 : rawMaxY;

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
            {plot.title}
          </p>
          <p className="mt-2 text-sm text-slate-600">{plot.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DetailChip>{formatValue(maxX - minX, 1)}s</DetailChip>
          <DetailChip>{points.length} points</DetailChip>
          {(plot.details || []).map((detail) => (
            <DetailChip key={detail}>{detail}</DetailChip>
          ))}
        </div>
      </div>

      {segmentLegend.length ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            State Cycle
          </span>
          {segmentLegend.map((segment, index) => (
            <div key={segment.label} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <span
                className="h-3 w-7 rounded-full border"
                style={{ background: segment.fill, borderColor: segment.stroke }}
              />
              <span>{segment.label}</span>
              {index < segmentLegend.length - 1 ? (
                <span className="text-slate-400">-&gt;</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-[18px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="h-56 w-full"
          aria-hidden="true"
        >
          {[0, 0.5, 1].map((fraction) => {
            const y = CHART_PADDING.top + plotHeight * fraction;
            return (
              <line
                key={fraction}
                x1={CHART_PADDING.left}
                x2={CHART_WIDTH - CHART_PADDING.right}
                y1={y}
                y2={y}
                stroke={fraction === 0.5 ? "#cfd8e3" : "#e6ecf3"}
                strokeWidth={fraction === 0.5 ? "1.5" : "1"}
              />
            );
          })}

          <line
            x1={CHART_PADDING.left}
            x2={CHART_PADDING.left}
            y1={CHART_PADDING.top}
            y2={CHART_HEIGHT - CHART_PADDING.bottom}
            stroke="#cfd8e3"
            strokeWidth="1.4"
          />
          <line
            x1={CHART_PADDING.left}
            x2={CHART_WIDTH - CHART_PADDING.right}
            y1={CHART_HEIGHT - CHART_PADDING.bottom}
            y2={CHART_HEIGHT - CHART_PADDING.bottom}
            stroke="#cfd8e3"
            strokeWidth="1.4"
          />

          {spans.map((span, index) => {
            const startX =
              CHART_PADDING.left + ((span.start - minX) / xSpan) * plotWidth;
            const endX =
              CHART_PADDING.left + ((span.end - minX) / xSpan) * plotWidth;
            const boundedStartX = Math.max(CHART_PADDING.left, startX);
            const boundedEndX = Math.min(CHART_WIDTH - CHART_PADDING.right, endX);
            const spanWidth = Math.max(1, boundedEndX - boundedStartX);

            if (span.end < minX || span.start > maxX) return null;

            return (
              <g key={`${span.label}-${index}`}>
                <rect
                  x={boundedStartX}
                  y={CHART_PADDING.top}
                  width={spanWidth}
                  height={plotHeight}
                  fill={span.color || "rgba(148, 163, 184, 0.16)"}
                  stroke={span.stroke || "rgba(148, 163, 184, 0.45)"}
                  strokeWidth="1"
                />
                {plot.showSegmentLabels && spanWidth > 34 ? (
                  <text
                    x={boundedStartX + spanWidth / 2}
                    y={CHART_PADDING.top + 16}
                    fill={span.stroke || "#475569"}
                    fontSize="10"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {span.label}
                  </text>
                ) : null}
              </g>
            );
          })}

          <path
            d={buildPath(points, minY, maxY)}
            fill="none"
            stroke={plot.color}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {markers.map((marker, index) => {
            const markerTime =
              typeof marker === "number" ? marker : marker.time ?? marker.x;
            const markerLabel =
              typeof marker === "number" ? "" : marker.label || "";
            const markerColor =
              typeof marker === "number"
                ? MARKER_COLORS.Peak
                : marker.color || MARKER_COLORS[markerLabel] || MARKER_COLORS.Peak;

            if (!Number.isFinite(markerTime) || markerTime < minX || markerTime > maxX) {
              return null;
            }

            const x =
              CHART_PADDING.left + ((markerTime - minX) / xSpan) * plotWidth;
            return (
              <g key={`${plot.id}-marker-${index}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={CHART_PADDING.top}
                  y2={CHART_HEIGHT - CHART_PADDING.bottom}
                  stroke={markerColor}
                  strokeDasharray="5 5"
                  strokeWidth="1.4"
                  opacity="0.7"
                />
                {markerLabel ? (
                  <text
                    x={x + 4}
                    y={CHART_PADDING.top + 13 + (index % 3) * 14}
                    fill={markerColor}
                    fontSize="10"
                    fontWeight="700"
                  >
                    {markerLabel}
                  </text>
                ) : null}
              </g>
            );
          })}

          <text
            x={CHART_PADDING.left}
            y={CHART_HEIGHT - 8}
            fill="#64748b"
            fontSize="11"
            fontWeight="600"
            textAnchor="start"
          >
            {formatValue(minX, 1)}s
          </text>
          <text
            x={CHART_WIDTH - CHART_PADDING.right}
            y={CHART_HEIGHT - 8}
            fill="#64748b"
            fontSize="11"
            fontWeight="600"
            textAnchor="end"
          >
            {formatValue(maxX, 1)}s
          </text>
          <text
            x={10}
            y={CHART_PADDING.top + 4}
            fill="#64748b"
            fontSize="11"
            fontWeight="600"
          >
            {formatValue(maxY, 2)}
          </text>
          <text
            x={10}
            y={CHART_HEIGHT - CHART_PADDING.bottom + 4}
            fill="#64748b"
            fontSize="11"
            fontWeight="600"
          >
            {formatValue(minY, 2)}
          </text>
        </svg>
      </div>
    </div>
  );
}

export default function AnalyticsResultPanel({ result, record }) {
  if (!result) return null;

  const plots = normalizePlotList(result);

  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
              Backend Plots
            </p>
            <p className="mt-2 text-sm text-slate-600">
              This view only renders chart data returned by the analytics endpoint.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {record ? <DetailChip tone="sky">{record.areaLabel}</DetailChip> : null}
            {record ? <DetailChip>{record.id}</DetailChip> : null}
            <DetailChip>{plots.length} plot{plots.length === 1 ? "" : "s"}</DetailChip>
          </div>
        </div>
      </div>

      {plots.length ? (
        plots.map((plot) => <PlotCard key={plot.id} plot={plot} />)
      ) : (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-lg font-semibold text-slate-950">
            No plot data returned
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            The analytics endpoint should return either a <code>plots</code> array or
            plot-ready signal arrays.
          </p>
        </div>
      )}
    </div>
  );
}
