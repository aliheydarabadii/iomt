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

function extractWaveformPoints(channelData) {
  const length = channelData.length ? channelData[0].length : 0;
  if (!length) return createPlaceholderPoints();

  const bucketSize = Math.max(1, Math.floor(length / POINT_COUNT));

  return Array.from({ length: POINT_COUNT }, (_, index) => {
    const start = index * bucketSize;
    const end =
      index === POINT_COUNT - 1
        ? length
        : Math.min(length, start + bucketSize);
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

// Chrome disables the native <audio> play button when it cannot determine the
// media format, which happens when the server serves the file without a real
// audio Content-Type. We sniff the format from the leading magic bytes so we
// can hand the element a blob URL with a correct MIME type instead.
function sniffAudioMimeType(bytes, fallbackType) {
  if (bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) {
    return "audio/wav"; // RIFF....WAVE
  }
  if (bytes.length >= 4 &&
    bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return "audio/ogg"; // OggS
  }
  if (bytes.length >= 4 &&
    bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
    return "audio/flac"; // fLaC
  }
  if (bytes.length >= 8 &&
    bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return "audio/mp4"; // ....ftyp (m4a/aac)
  }
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return "audio/mpeg"; // ID3 (mp3)
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    return "audio/mpeg"; // MPEG audio frame sync
  }

  if (fallbackType && fallbackType !== "application/octet-stream") {
    return fallbackType;
  }

  // Recordings come off the BLE capture as WAV, so default to that when the
  // header is unrecognized rather than leaving the type empty (= disabled).
  return "audio/wav";
}

// Heart recordings are captured at a very low sample rate (e.g. 500 Hz). Chrome
// refuses to play such files in <audio> AND cannot decode them via Web Audio
// (decodeAudioData/createBuffer reject sub-3 kHz rates), so the play button
// stays disabled. We parse the PCM ourselves, resample up to a rate browsers
// accept, and re-encode a standard WAV for both playback and the waveform.
const MIN_PLAYABLE_SAMPLE_RATE = 8000;

function readChunkTag(view, offset) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

// Decode a PCM/IEEE-float WAV into per-channel Float32 sample arrays. Returns
// null for anything that isn't a plain WAV we can read (e.g. compressed audio).
function parseWavPcm(arrayBuffer) {
  if (arrayBuffer.byteLength < 44) return null;

  const view = new DataView(arrayBuffer);
  if (readChunkTag(view, 0) !== "RIFF" || readChunkTag(view, 8) !== "WAVE") {
    return null;
  }

  let offset = 12;
  let format = null;
  let dataOffset = -1;
  let dataLength = 0;

  while (offset + 8 <= arrayBuffer.byteLength) {
    const id = readChunkTag(view, offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;

    if (id === "fmt ") {
      format = {
        audioFormat: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bitsPerSample: view.getUint16(body + 14, true),
      };
    } else if (id === "data") {
      dataOffset = body;
      dataLength = Math.min(size, arrayBuffer.byteLength - body);
    }

    offset = body + size + (size % 2); // chunks are word-aligned
  }

  if (!format || dataOffset < 0 || !format.channels || !format.sampleRate) {
    return null;
  }

  const { audioFormat, channels, sampleRate, bitsPerSample } = format;
  const bytesPerSample = bitsPerSample / 8;
  if (!bytesPerSample) return null;

  const frameSize = bytesPerSample * channels;
  const frameCount = Math.floor(dataLength / frameSize);
  const channelData = Array.from(
    { length: channels },
    () => new Float32Array(frameCount),
  );

  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const position = dataOffset + frame * frameSize + channel * bytesPerSample;
      let sample;

      if (audioFormat === 3 && bitsPerSample === 32) {
        sample = view.getFloat32(position, true);
      } else if (bitsPerSample === 16) {
        sample = view.getInt16(position, true) / 0x8000;
      } else if (bitsPerSample === 8) {
        sample = (view.getUint8(position) - 128) / 128;
      } else if (bitsPerSample === 32) {
        sample = view.getInt32(position, true) / 0x80000000;
      } else if (bitsPerSample === 24) {
        let value =
          (view.getUint8(position + 2) << 16) |
          (view.getUint8(position + 1) << 8) |
          view.getUint8(position);
        if (value & 0x800000) value |= ~0xffffff;
        sample = value / 0x800000;
      } else {
        return null;
      }

      channelData[channel][frame] = sample;
    }
  }

  return { sampleRate, channelData };
}

// Linear-interpolation resample of one channel. Heart audio tops out well below
// the source Nyquist, so interpolation introduces no audible artifacts.
function resampleChannel(input, inputRate, outputRate) {
  if (inputRate === outputRate || input.length === 0) return input;

  const outputLength = Math.max(
    1,
    Math.round((input.length * outputRate) / inputRate),
  );
  const output = new Float32Array(outputLength);
  const ratio = inputRate / outputRate;

  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = index * ratio;
    const lower = Math.floor(sourceIndex);
    const fraction = sourceIndex - lower;
    const a = input[lower] || 0;
    const b = input[Math.min(lower + 1, input.length - 1)] || 0;
    output[index] = a + (b - a) * fraction;
  }

  return output;
}

function encodeWav(channelData, sampleRate) {
  const numChannels = channelData.length;
  const numFrames = numChannels ? channelData[0].length : 0;
  const blockAlign = numChannels * 2; // 16-bit samples
  const dataSize = numFrames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset, text) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let frame = 0; frame < numFrames; frame += 1) {
    for (let channel = 0; channel < numChannels; channel += 1) {
      const clamped = Math.max(-1, Math.min(1, channelData[channel][frame]));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
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
  const [audioSrc, setAudioSrc] = useState("");
  const [mediaDuration, setMediaDuration] = useState(0);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!audioUrl) return undefined;

    let cancelled = false;
    let objectUrl = "";
    let audioContext = null;
    const controller = new AbortController();

    async function loadWaveform() {
      setChartState({
        durationSeconds: 0,
        points: createPlaceholderPoints(),
        status: "loading",
      });
      setAudioSrc("");
      setMediaDuration(0);

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
        const arrayBuffer = await blob.arrayBuffer();
        if (cancelled) return;

        // Preferred path: parse the WAV ourselves and resample up to a rate the
        // browser can actually play, since the capture rate (~500 Hz) is too low
        // for both <audio> and Web Audio.
        const parsed = parseWavPcm(arrayBuffer);
        if (parsed && parsed.channelData.length) {
          const targetRate = Math.max(parsed.sampleRate, MIN_PLAYABLE_SAMPLE_RATE);
          const channelData = parsed.channelData.map((channel) =>
            resampleChannel(channel, parsed.sampleRate, targetRate),
          );

          objectUrl = URL.createObjectURL(encodeWav(channelData, targetRate));
          setAudioSrc(objectUrl);
          setChartState({
            durationSeconds: (channelData[0]?.length || 0) / targetRate,
            points: extractWaveformPoints(channelData),
            status: "ready",
          });
          return;
        }

        // Fallback for compressed formats: let Web Audio decode, then re-encode.
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          try {
            audioContext = new AudioContextClass();
            const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
            if (cancelled) return;

            const channelData = Array.from(
              { length: decoded.numberOfChannels },
              (_, channel) => decoded.getChannelData(channel),
            );
            objectUrl = URL.createObjectURL(encodeWav(channelData, decoded.sampleRate));
            setAudioSrc(objectUrl);
            setChartState({
              durationSeconds: decoded.duration,
              points: extractWaveformPoints(channelData),
              status: "ready",
            });
            return;
          } catch (decodeError) {
            if (cancelled) return;
            // Fall through to raw playback below.
          }
        }

        // Last resort: play the original bytes with a sniffed MIME type and skip
        // the decoded waveform preview.
        const header = new Uint8Array(arrayBuffer.slice(0, 16));
        objectUrl = URL.createObjectURL(
          new Blob([arrayBuffer], { type: sniffAudioMimeType(header, blob.type) }),
        );
        setAudioSrc(objectUrl);
        setChartState({
          durationSeconds: 0,
          points: createPlaceholderPoints(),
          status: "unsupported",
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

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }

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
  const effectiveDuration = chartState.durationSeconds || mediaDuration;
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
        src={audioSrc || audioUrl}
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
