import { useId, useMemo } from "react";

const WIDTH = 900;
const HEIGHT = 210;
const PADDING = { top: 18, right: 20, bottom: 38, left: 20 };

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.round(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

function buildPath(values, completedWidth) {
  if (!values.length || completedWidth <= 0) return "";
  const centerY = PADDING.top + (HEIGHT - PADDING.top - PADDING.bottom) / 2;
  const amplitude = (HEIGHT - PADDING.top - PADDING.bottom) * 0.44;
  const step = completedWidth / Math.max(values.length - 1, 1);

  return values
    .map((value, index) => {
      const x = PADDING.left + index * step;
      const normalized = Math.min(1, Math.max(0, Number(value) || 0.5));
      const y = centerY - (normalized - 0.5) * amplitude * 2;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export default function RecordingSignalProgress({
  waveform,
  progress,
  capturedSampleCount,
  expectedSampleCount,
  elapsedSeconds,
  durationSeconds,
  signalQuality,
}) {
  const clipId = useId().replace(/:/g, "");
  const safeProgress = Math.min(1, Math.max(0, Number(progress) || 0));
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const completedWidth = plotWidth * safeProgress;
  const progressX = PADDING.left + completedWidth;
  const path = useMemo(
    () => buildPath(Array.isArray(waveform) ? waveform : [], completedWidth),
    [waveform, completedWidth],
  );
  const percentage = Math.round(safeProgress * 100);
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <section className="rounded-[24px] border border-sky-200 bg-white p-4 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.28)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
            Recorded Signal Progress
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            The trace grows only as new samples arrive from the device.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-slate-950">{percentage}%</p>
          <p className="text-xs font-medium text-slate-500">
            {formatTime(elapsedSeconds)} / {formatTime(durationSeconds)}
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[18px] border border-slate-200 bg-slate-100">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="block h-44 w-full"
          role="img"
          aria-label={`Live recorded signal progress, ${percentage} percent complete`}
        >
          <defs>
            <clipPath id={clipId}>
              <rect
                x={PADDING.left}
                y={PADDING.top}
                width={completedWidth}
                height={plotHeight}
              />
            </clipPath>
          </defs>

          <rect
            x={PADDING.left}
            y={PADDING.top}
            width={plotWidth}
            height={plotHeight}
            rx="10"
            fill="#e2e8f0"
          />
          <rect
            x={PADDING.left}
            y={PADDING.top}
            width={completedWidth}
            height={plotHeight}
            rx="10"
            fill="#e0f2fe"
          />

          {ticks.map((tick) => {
            const x = PADDING.left + plotWidth * tick;
            return (
              <g key={tick}>
                <line
                  x1={x}
                  x2={x}
                  y1={PADDING.top}
                  y2={PADDING.top + plotHeight}
                  stroke="#cbd5e1"
                  strokeDasharray="3 5"
                />
                <text
                  x={x}
                  y={HEIGHT - 13}
                  textAnchor={tick === 0 ? "start" : tick === 1 ? "end" : "middle"}
                  fontSize="11"
                  fontWeight="600"
                  fill="#64748b"
                >
                  {formatTime(durationSeconds * tick)}
                </text>
              </g>
            );
          })}

          <line
            x1={PADDING.left}
            x2={PADDING.left + plotWidth}
            y1={PADDING.top + plotHeight / 2}
            y2={PADDING.top + plotHeight / 2}
            stroke="#94a3b8"
            opacity="0.55"
          />

          {path ? (
            <path
              d={path}
              clipPath={`url(#${clipId})`}
              fill="none"
              stroke="#0369a1"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          <line
            x1={progressX}
            x2={progressX}
            y1={PADDING.top}
            y2={PADDING.top + plotHeight}
            stroke="#0f172a"
            strokeWidth="3"
          />
          <circle
            cx={progressX}
            cy={PADDING.top + plotHeight / 2}
            r="5"
            fill="#0f172a"
          />
        </svg>
      </div>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
          <span className="font-semibold text-slate-900">
            {capturedSampleCount.toLocaleString()}
          </span>{" "}
          samples received
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
          Target{" "}
          <span className="font-semibold text-slate-900">
            {expectedSampleCount.toLocaleString()}
          </span>{" "}
          samples
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
          Signal{" "}
          <span className="font-semibold text-slate-900">
            {signalQuality || "Waiting"}
          </span>
        </div>
      </div>
    </section>
  );
}
