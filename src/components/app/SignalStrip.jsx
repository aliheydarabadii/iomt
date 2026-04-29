export default function SignalStrip({ history, isRecording }) {
  const width = 900;
  const height = 240;
  const paddingX = 18;
  const paddingY = 18;
  const centerY = height / 2;
  const innerHeight = height - paddingY * 2;
  const plotWidth = width - paddingX * 2;
  const step = plotWidth / Math.max(history.length - 1, 1);
  const playheadX = width * 0.16;

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.28)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
            Heart Sound Trace
          </p>
          <p className="mt-1 text-sm text-slate-600">
            This waveform is rendered from the latest REST response.
          </p>
        </div>
        <span
          className={[
            "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
            isRecording
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-100 text-slate-500",
          ].join(" ")}
        >
          {isRecording ? "LIVE" : "STANDBY"}
        </span>
      </div>

      <div className="mt-5 overflow-hidden rounded-[20px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" aria-hidden="true">
          {[paddingY, centerY, height - paddingY].map((y, index) => (
            <line
              key={index}
              x1={0}
              x2={width}
              y1={y}
              y2={y}
              stroke={y === centerY ? "#d0d8e4" : "#e5ebf3"}
              strokeWidth={y === centerY ? "1.5" : "1"}
            />
          ))}

          <line
            x1={playheadX}
            x2={playheadX}
            y1={paddingY}
            y2={height - paddingY}
            stroke={isRecording ? "#0f172a" : "#94a3b8"}
            strokeWidth="2"
          />

          {history.map((level, index) => {
            const x = paddingX + index * step;
            const amplitude = Math.max(2, level * (innerHeight * 0.48));

            return (
              <line
                key={index}
                x1={x}
                x2={x}
                y1={centerY - amplitude}
                y2={centerY + amplitude}
                stroke="#2d9cff"
                strokeWidth={step > 4 ? "2.2" : "1.8"}
                strokeLinecap="round"
                opacity={isRecording ? 0.92 : 0.55}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
