import { useEffect, useId, useMemo, useRef, useState } from "react";

const VIEWBOX_WIDTH = 720;
const VIEWBOX_HEIGHT = 220;
const PADDING = {
  top: 16,
  right: 18,
  bottom: 30,
  left: 40,
};
const POINT_COUNT = 220;

function createPlaceholderPoints() {
  return Array.from({ length: POINT_COUNT }, () => 0);
}

function formatDurationLabel(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "--";
  }

  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  if (seconds < 60) return `${seconds.toFixed(0)}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${remainingSeconds}`;
}

function extractWaveform(audioBuffer) {
  const channelData = Array.from(
    { length: audioBuffer.numberOfChannels },
    (_, index) => audioBuffer.getChannelData(index),
  );
  const bucketSize = Math.max(1, Math.floor(audioBuffer.length / POINT_COUNT));

  return Array.from({ length: POINT_COUNT }, (_, index) => {
    const start = index * bucketSize;
    const end =
      index === POINT_COUNT - 1
        ? audioBuffer.length
        : Math.min(audioBuffer.length, start + bucketSize);
    const stride = Math.max(1, Math.floor((end - start) / 32));
    let min = 1;
    let max = -1;

    for (let sampleIndex = start; sampleIndex < end; sampleIndex += stride) {
      let sample = 0;

      for (const channel of channelData) {
        sample += channel[sampleIndex] || 0;
      }

      sample /= channelData.length || 1;
      min = Math.min(min, sample);
      max = Math.max(max, sample);
    }

    const peak = Math.abs(max) >= Math.abs(min) ? max : min;
    return Number.isFinite(peak) ? peak : 0;
  });
}

function buildPath(points) {
  const plotWidth = VIEWBOX_WIDTH - PADDING.left - PADDING.right;
  const plotHeight = VIEWBOX_HEIGHT - PADDING.top - PADDING.bottom;
  const stepX = plotWidth / Math.max(points.length - 1, 1);

  return points
    .map((point, index) => {
      const x = PADDING.left + stepX * index;
      const normalized = (point + 1) / 2;
      const y = PADDING.top + (1 - normalized) * plotHeight;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export default function RecordingWaveform({ audioUrl }) {
  const audioRef = useRef(null);
  const animationFrameRef = useRef(0);
  const clipPathId = useId().replace(/:/g, "");
  const [chartState, setChartState] = useState({
    durationSeconds: 0,
    points: createPlaceholderPoints(),
    status: "loading",
  });
  const [mediaDuration, setMediaDuration] = useState(0);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!audioUrl) return undefined;

    let cancelled = false;
    let audioContext = null;
    const controller = new AbortController();

    async function loadWaveform() {
      setChartState({
        durationSeconds: 0,
        points: createPlaceholderPoints(),
        status: "loading",
      });

      try {
        const response = await fetch(audioUrl, {
          headers: {
            Accept: "audio/*,*/*",
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Audio request failed with ${response.status}`);
        }

        const blob = await response.blob();
        if (cancelled) return;

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) {
          setChartState({
            durationSeconds: 0,
            points: createPlaceholderPoints(),
            status: "unsupported",
          });
          return;
        }

        audioContext = new AudioContextClass();
        const decoded = await audioContext.decodeAudioData(await blob.arrayBuffer());
        if (cancelled) return;

        setChartState({
          durationSeconds: decoded.duration,
          points: extractWaveform(decoded),
          status: "ready",
        });
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;

        setChartState({
          durationSeconds: 0,
          points: createPlaceholderPoints(),
          status: "error",
        });
      } finally {
        if (audioContext && audioContext.state !== "closed") {
          audioContext.close().catch(() => {});
        }
      }
    }

    loadWaveform();

    return () => {
      cancelled = true;
      controller.abort();

      if (audioContext && audioContext.state !== "closed") {
        audioContext.close().catch(() => {});
      }
    };
  }, [audioUrl]);

  useEffect(() => {
    setMediaDuration(0);
    setPlaybackTime(0);
    setIsPlaying(false);
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const waveformPath = useMemo(
    () => buildPath(chartState.points),
    [chartState.points],
  );

  const plotBottom = VIEWBOX_HEIGHT - PADDING.bottom;
  const plotWidth = VIEWBOX_WIDTH - PADDING.left - PADDING.right;
  const centerY = PADDING.top + (plotBottom - PADDING.top) / 2;
  const effectiveDuration = mediaDuration || chartState.durationSeconds;
  const durationLabel = formatDurationLabel(effectiveDuration);
  const tickValues = [0, effectiveDuration / 2, effectiveDuration];
  const tickLabels = tickValues.map((value) => formatDurationLabel(value));
  const progress =
    effectiveDuration > 0 ? Math.min(1, playbackTime / effectiveDuration) : 0;
  const progressX = PADDING.left + plotWidth * progress;
  const subtitleByStatus = {
    error: "Waveform preview is unavailable for this file, but playback may still work.",
    loading: "Loading and decoding the recorded audio file.",
    ready: isPlaying
      ? "Playback is moving live across the stored waveform."
      : "Decoded waveform from the stored recording.",
    unsupported: "Playback is available, but waveform decoding is unsupported here.",
  };

  function stopPlaybackTracking(nextTime) {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    }

    setIsPlaying(false);

    if (typeof nextTime === "number") {
      setPlaybackTime(nextTime);
    }
  }

  function trackPlaybackPosition() {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    setPlaybackTime(audioElement.currentTime || 0);

    if (!audioElement.paused && !audioElement.ended) {
      animationFrameRef.current = requestAnimationFrame(trackPlaybackPosition);
      return;
    }

    stopPlaybackTracking(audioElement.currentTime || 0);
  }

  function handleAudioPlay() {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    setIsPlaying(true);
    animationFrameRef.current = requestAnimationFrame(trackPlaybackPosition);
  }

  function handleAudioPause() {
    stopPlaybackTracking(audioRef.current?.currentTime || 0);
  }

  function handleAudioEnded() {
    stopPlaybackTracking(audioRef.current?.duration || effectiveDuration);
  }

  function handleAudioLoadedMetadata(event) {
    const nextDuration = event.currentTarget.duration;
    if (Number.isFinite(nextDuration) && nextDuration > 0) {
      setMediaDuration(nextDuration);
    }
  }

  function handleAudioSeeked(event) {
    setPlaybackTime(event.currentTarget.currentTime || 0);
  }

  function handleAudioTimeUpdate(event) {
    if (!isPlaying) {
      setPlaybackTime(event.currentTarget.currentTime || 0);
    }
  }

  function handleChartPointer(event) {
    if (!effectiveDuration || !audioRef.current) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeX = Math.min(Math.max(0, event.clientX - bounds.left), bounds.width);
    const nextTime = (relativeX / bounds.width) * effectiveDuration;

    audioRef.current.currentTime = nextTime;
    setPlaybackTime(nextTime);
  }

  return (
    <div className="mt-4 rounded-[20px] border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
            Amplitude vs Time
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {subtitleByStatus[chartState.status]}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-semibold">
          <span
            className={[
              "rounded-full px-3 py-1",
              isPlaying
                ? "bg-sky-100 text-sky-800"
                : "bg-slate-100 text-slate-600",
            ].join(" ")}
          >
            {formatDurationLabel(playbackTime)} / {durationLabel}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
            {isPlaying ? "Playing" : "Paused"}
          </span>
        </div>
      </div>

      <div
        className="mt-4 overflow-hidden rounded-[18px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]"
        role="presentation"
        onClick={handleChartPointer}
      >
        <svg
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          className="h-48 w-full cursor-pointer"
          aria-label="Recorded audio amplitude versus time"
          role="img"
        >
          <defs>
            <clipPath id={`played-waveform-${clipPathId}`}>
              <rect
                x={PADDING.left}
                y={PADDING.top}
                width={Math.max(0, progressX - PADDING.left)}
                height={plotBottom - PADDING.top}
              />
            </clipPath>
          </defs>

          {[PADDING.top, centerY, plotBottom].map((y, index) => (
            <line
              key={y}
              x1={PADDING.left}
              x2={VIEWBOX_WIDTH - PADDING.right}
              y1={y}
              y2={y}
              stroke={index === 1 ? "#cfd8e3" : "#e6ecf3"}
              strokeWidth={index === 1 ? "1.5" : "1"}
            />
          ))}

          <line
            x1={PADDING.left}
            x2={PADDING.left}
            y1={PADDING.top}
            y2={plotBottom}
            stroke="#cfd8e3"
            strokeWidth="1.5"
          />

          <line
            x1={PADDING.left}
            x2={VIEWBOX_WIDTH - PADDING.right}
            y1={plotBottom}
            y2={plotBottom}
            stroke="#cfd8e3"
            strokeWidth="1.5"
          />

          <path
            d={waveformPath}
            fill="none"
            stroke="#1d9bf0"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.4"
            opacity={chartState.status === "ready" ? 0.35 : 0.2}
          />

          <path
            d={waveformPath}
            clipPath={`url(#played-waveform-${clipPathId})`}
            fill="none"
            stroke="#0f5bd7"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.8"
            opacity={chartState.status === "ready" ? 0.95 : 0.3}
          />

          {chartState.status === "ready" ? (
            <>
              <line
                x1={progressX}
                x2={progressX}
                y1={PADDING.top}
                y2={plotBottom}
                stroke={isPlaying ? "#0f172a" : "#94a3b8"}
                strokeWidth="2"
              />
              <circle
                cx={progressX}
                cy={centerY}
                r="4.5"
                fill={isPlaying ? "#0f172a" : "#94a3b8"}
              />
            </>
          ) : null}

          {["+1", "0", "-1"].map((label, index) => {
            const positions = [PADDING.top + 4, centerY + 4, plotBottom + 4];
            return (
              <text
                key={label}
                x={10}
                y={positions[index]}
                fill="#64748b"
                fontSize="11"
                fontWeight="600"
              >
                {label}
              </text>
            );
          })}

          {tickLabels.map((label, index) => {
            const x = PADDING.left + (plotWidth * index) / 2;

            return (
              <g key={`${label}-${index}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={plotBottom}
                  y2={plotBottom + 6}
                  stroke="#94a3b8"
                  strokeWidth="1.2"
                />
                <text
                  x={x}
                  y={VIEWBOX_HEIGHT - 8}
                  fill="#64748b"
                  fontSize="11"
                  fontWeight="600"
                  textAnchor={index === 0 ? "start" : index === 2 ? "end" : "middle"}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <audio
        ref={audioRef}
        controls
        preload="metadata"
        src={audioUrl}
        className="mt-4 w-full"
        onEnded={handleAudioEnded}
        onLoadedMetadata={handleAudioLoadedMetadata}
        onPause={handleAudioPause}
        onPlay={handleAudioPlay}
        onSeeked={handleAudioSeeked}
        onTimeUpdate={handleAudioTimeUpdate}
      />
    </div>
  );
}
