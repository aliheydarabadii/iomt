import { useEffect, useMemo, useState } from "react";
import AnalyticsResultPanel from "@/components/app/AnalyticsResultPanel";
import DetailChip from "@/components/app/DetailChip";
import HistoryCard from "@/components/app/HistoryCard";
import SignalStrip from "@/components/app/SignalStrip";
import StepPill from "@/components/app/StepPill";
import SummaryTile from "@/components/app/SummaryTile";
import HeartAuscultationMap from "@/components/HeartAuscultationMap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildRecordingAnalyticsUrl,
  resolveApiUrl,
  runRecordingAnalysis,
} from "@/lib/api";
import {
  ANALYTICS_METHOD,
  DEFAULT_SELECTED_ID,
  MEASUREMENT_ENDPOINT,
} from "@/lib/config";
import { formatCaptureTime, formatRuntime } from "@/lib/formatters";
import referenceImage from "@/image/image.png";

function MeasurementTabButton({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
        active
          ? "bg-slate-950 text-white"
          : "bg-white/80 text-slate-600 hover:bg-white hover:text-slate-950",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

export default function MeasurementPage({
  patient,
  measurement,
  selectedArea,
  selectedAreaId,
  onAreaChange,
  isLoading,
  errorMessage,
  isRecordPending,
  recordSeconds,
  recordDurationSeconds,
  onRecord,
  onBack,
}) {
  if (!patient) return null;

  const latestRecord = measurement.records[0] || null;
  const historyRecords =
    measurement.records.length > 0 ? measurement.records : patient.recordings;
  const [activeTab, setActiveTab] = useState("console");
  const [selectedAnalyticsRecordId, setSelectedAnalyticsRecordId] = useState(
    historyRecords[0]?.id || "",
  );
  const [analyticsResult, setAnalyticsResult] = useState(null);
  const [analyticsError, setAnalyticsError] = useState("");
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [lastAnalyzedRecordId, setLastAnalyzedRecordId] = useState("");

  useEffect(() => {
    if (
      selectedAnalyticsRecordId &&
      historyRecords.some((record) => record.id === selectedAnalyticsRecordId)
    ) {
      return;
    }

    setSelectedAnalyticsRecordId(historyRecords[0]?.id || "");
  }, [historyRecords, selectedAnalyticsRecordId]);

  const selectedAnalyticsRecord = useMemo(
    () =>
      historyRecords.find((record) => record.id === selectedAnalyticsRecordId) || null,
    [historyRecords, selectedAnalyticsRecordId],
  );

  async function handleRunAnalysis() {
    if (!selectedAnalyticsRecord) return;

    setIsAnalyticsLoading(true);
    setAnalyticsError("");

    try {
      const result = await runRecordingAnalysis(selectedAnalyticsRecord.id);

      setAnalyticsResult(result);
      setLastAnalyzedRecordId(selectedAnalyticsRecord.id);
    } catch (error) {
      setAnalyticsError(
        error instanceof Error ? error.message : "Unable to run analytics.",
      );
    } finally {
      setIsAnalyticsLoading(false);
    }
  }

  // The blocking record call locks the session before the first /current poll
  // reflects isRecording, so treat the in-flight request as an active session.
  const sessionActive = measurement.currentSession.isRecording || isRecordPending;

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="relative overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(235,245,255,0.88))] p-6 shadow-[0_32px_80px_-36px_rgba(15,23,42,0.45)] sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.2),transparent_30%),radial-gradient(circle_at_left_center,rgba(14,165,233,0.1),transparent_32%)]" />
          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-3">
                <StepPill active={false} number="1" label="Patient Lookup" />
                <StepPill active number="2" label="Measurement Console" />
              </div>
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-white"
              >
                Back To Lookup
              </button>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_340px]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
                  Measurement Session
                </p>
                <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                  Heart Sound Measurement Console
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
                  Live measurement data, server session state, and patient history are
                  aligned in one workspace so the operator can stay focused on the exam.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <DetailChip tone="sky">{patient.fullName}</DetailChip>
                  {patient.mrn ? <DetailChip>MRN {patient.mrn}</DetailChip> : null}
                  {patient.sex ? <DetailChip>{patient.sex}</DetailChip> : null}
                  {patient.age ? <DetailChip>Age {patient.age}</DetailChip> : null}
                  <DetailChip tone="emerald">
                    {sessionActive ? "Recording active" : "Session idle"}
                  </DetailChip>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <SummaryTile
                  label="Selected Site"
                  value={selectedArea.label}
                  detail={
                    sessionActive ? "Locked by active session" : selectedArea.short
                  }
                />
                <SummaryTile
                  label="Runtime"
                  value={formatRuntime(measurement.currentSession.runtimeMs)}
                  detail={
                    isLoading
                      ? "Refreshing from server..."
                      : measurement.currentSession.streamStatus
                  }
                />
                <SummaryTile
                  label="Last Capture"
                  value={latestRecord ? formatRuntime(latestRecord.durationMs) : "--:--"}
                  detail={
                    latestRecord
                      ? `${latestRecord.areaLabel} · ${formatCaptureTime(latestRecord.capturedAt)}`
                      : "No measurement records returned by the API"
                  }
                />
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 flex flex-wrap gap-3">
          <MeasurementTabButton
            active={activeTab === "console"}
            label="Measurement Console"
            onClick={() => setActiveTab("console")}
          />
          <MeasurementTabButton
            active={activeTab === "analytics"}
            label="Analytics"
            onClick={() => setActiveTab("analytics")}
          />
        </div>

        {activeTab === "console" ? (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_390px]">
            <div className="space-y-6">
              <HeartAuscultationMap
                referenceImageSrc={referenceImage}
                defaultSelectedId={DEFAULT_SELECTED_ID}
                selectedAreaId={selectedAreaId}
                selectionLocked={sessionActive}
                onAreaClick={(area) => onAreaChange(area.id)}
              />

              <Card className="overflow-hidden rounded-[30px] border border-white/70 bg-white/92 shadow-[0_26px_70px_-34px_rgba(15,23,42,0.38)] backdrop-blur-sm">
                <CardHeader className="border-b border-slate-200/80 pb-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                        Recording History
                      </p>
                      <CardTitle className="mt-2 text-2xl text-slate-950">
                        Patient Record Timeline
                      </CardTitle>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Historical recordings remain visible below the live workspace so
                        prior findings can be compared without leaving the page.
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {historyRecords.length} records
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 p-5 sm:p-6">
                  {historyRecords.length ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      {historyRecords.map((record) => (
                        <HistoryCard key={record.id} record={record} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-5 py-8 text-center">
                      <p className="text-base font-semibold text-slate-900">
                        No measurements returned
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Once the API returns measurement records for this patient, they
                        will appear here with site, duration, and playback metadata.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="overflow-hidden rounded-[30px] border border-white/70 bg-slate-950 text-white shadow-[0_26px_70px_-34px_rgba(15,23,42,0.58)]">
                <CardContent className="space-y-4 p-5 sm:p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200/80">
                    Live Session
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-3xl font-semibold tracking-tight">
                        {formatRuntime(measurement.currentSession.runtimeMs)}
                      </p>
                      <p className="mt-1 text-sm text-slate-300">
                        {isLoading
                          ? "Refreshing from server..."
                          : measurement.currentSession.streamStatus}
                      </p>
                    </div>
                    <span
                      className={[
                        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                        sessionActive
                          ? "bg-rose-500/20 text-rose-100"
                          : "bg-white/10 text-slate-200",
                      ].join(" ")}
                    >
                      {sessionActive ? "Recording" : "Idle"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                        Selected Site
                      </p>
                      <p className="mt-2 text-base font-semibold">{selectedArea.label}</p>
                      <p className="mt-1 text-sm text-slate-300">{selectedArea.short}</p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                        Signal Quality
                      </p>
                      <p className="mt-2 text-base font-semibold">
                        {measurement.currentSession.signalQuality}
                      </p>
                      <p className="mt-1 text-sm text-slate-300">
                        Endpoint: {resolveApiUrl(MEASUREMENT_ENDPOINT)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <button
                      type="button"
                      disabled={!measurement.controls.canRecord || isRecordPending}
                      onClick={onRecord}
                      className="inline-flex items-center justify-center gap-2 rounded-[20px] bg-[#a61e2e] px-4 py-4 text-sm font-semibold text-white transition-colors hover:bg-[#911827] disabled:cursor-not-allowed disabled:bg-rose-300"
                    >
                      <svg
                        viewBox="0 0 20 20"
                        className="h-5 w-5"
                        aria-hidden="true"
                        fill="currentColor"
                      >
                        <circle cx="10" cy="10" r="5.5" />
                      </svg>
                      {isRecordPending
                        ? `Recording… (${recordSeconds}s)`
                        : "Record"}
                    </button>

                    {isRecordPending ? (
                      <p className="text-center text-sm text-slate-300">
                        Capturing a fixed {recordDurationSeconds}s sample from the
                        sensor. The recording stops on its own and saves
                        automatically.
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <SignalStrip
                history={measurement.currentSession.waveform}
                isRecording={sessionActive}
              />

              {errorMessage ? (
                <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {errorMessage}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-6">
              <Card className="overflow-hidden rounded-[30px] border border-white/70 bg-white/92 shadow-[0_26px_70px_-34px_rgba(15,23,42,0.38)] backdrop-blur-sm">
                <CardHeader className="border-b border-slate-200/80 pb-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                    Analytics Runner
                  </p>
                  <CardTitle className="mt-2 text-2xl text-slate-950">
                    PCG Analysis Workspace
                  </CardTitle>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Run backend analytics for a stored recording and render the
                    returned plots here. The frontend does not compute the analysis.
                  </p>
                </CardHeader>

                <CardContent className="space-y-4 p-5 sm:p-6">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Endpoint
                    </p>
                    <p className="mt-3 break-all text-sm leading-6 text-slate-700">
                      <code>{buildRecordingAnalyticsUrl(selectedAnalyticsRecordId)}</code>
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Method: <code>{ANALYTICS_METHOD}</code>
                    </p>
                  </div>

                  {historyRecords.length ? (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Select Recording
                      </p>
                      <div className="space-y-2">
                        {historyRecords.map((record) => (
                          <button
                            key={record.id}
                            type="button"
                            onClick={() => setSelectedAnalyticsRecordId(record.id)}
                            className={[
                              "w-full rounded-[20px] border px-4 py-4 text-left transition-colors",
                              selectedAnalyticsRecordId === record.id
                                ? "border-sky-200 bg-sky-50"
                                : "border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white",
                            ].join(" ")}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-base font-semibold text-slate-950">
                                  {record.areaLabel}
                                </p>
                                <p className="mt-1 text-sm text-slate-600">
                                  {formatCaptureTime(record.capturedAt)}
                                </p>
                              </div>
                              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                                {formatRuntime(record.durationMs)}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {selectedAnalyticsRecordId === record.id ? (
                                <DetailChip tone="sky">Selected</DetailChip>
                              ) : null}
                              <DetailChip>{record.id}</DetailChip>
                              <DetailChip>{record.status}</DetailChip>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-5 py-8 text-center">
                      <p className="text-base font-semibold text-slate-900">
                        No recordings available yet
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        The analytics tab becomes useful after the backend returns one
                        or more saved recordings for this patient.
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={!selectedAnalyticsRecord || isAnalyticsLoading}
                    onClick={handleRunAnalysis}
                    className="inline-flex w-full items-center justify-center rounded-[20px] bg-slate-950 px-4 py-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {isAnalyticsLoading ? "Running Analysis..." : "Run Analysis"}
                  </button>

                  {lastAnalyzedRecordId ? (
                    <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      Analytics loaded for <code>{lastAnalyzedRecordId}</code>.
                    </div>
                  ) : null}

                  {analyticsError ? (
                    <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                      {analyticsError}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {analyticsResult ? (
                <AnalyticsResultPanel
                  result={analyticsResult}
                  record={selectedAnalyticsRecord}
                />
              ) : (
                <Card className="overflow-hidden rounded-[30px] border border-white/70 bg-white/92 shadow-[0_26px_70px_-34px_rgba(15,23,42,0.38)] backdrop-blur-sm">
                  <CardContent className="px-6 py-12 text-center">
                    <p className="text-lg font-semibold text-slate-950">
                      Analytics output will appear here
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      Once the backend returns plot-ready output for the selected
                      recording, this tab will render those charts directly.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
