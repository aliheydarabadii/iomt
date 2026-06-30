import { LoaderCircle, Trash2 } from "lucide-react";
import RecordingWaveform from "@/components/app/RecordingWaveform";
import { formatCaptureTime, formatRuntime } from "@/lib/formatters";

export default function HistoryCard({ record, onRemove, isRemoving }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-slate-950">{record.areaLabel}</p>
          <p className="mt-1 text-sm text-slate-600">{record.areaShort}</p>
        </div>
        <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
          {formatRuntime(record.durationMs)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
        <span className="rounded-full bg-white px-3 py-1">
          {formatCaptureTime(record.capturedAt)}
        </span>
        <span className="rounded-full bg-white px-3 py-1">{record.status}</span>
        <button
          type="button"
          onClick={() => onRemove?.(record)}
          disabled={isRemoving}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1 font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRemoving ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {isRemoving ? "Removing..." : "Remove"}
        </button>
      </div>

      {record.audioUrl ? (
        <RecordingWaveform audioUrl={record.audioUrl} />
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          No audio file URL was provided for this record.
        </p>
      )}
    </div>
  );
}
