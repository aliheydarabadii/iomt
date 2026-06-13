import {
  API_BASE_URL,
  DEFAULT_SELECTED_ID,
  RECORDING_AUDIO_ENDPOINT_TEMPLATE,
  WAVEFORM_POINT_COUNT,
  createIdleWaveform,
} from "@/lib/config";

function toTimestamp(value) {
  if (!value) return 0;
  if (typeof value === "number") return value;

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeWaveform(waveform) {
  if (!Array.isArray(waveform) || waveform.length === 0) {
    return createIdleWaveform();
  }

  const normalized = waveform
    .map((entry) => {
      const raw =
        typeof entry === "number"
          ? entry
          : typeof entry === "object" && entry !== null
            ? entry.value
            : 0;

      if (!Number.isFinite(raw)) return 0.015;
      return Math.min(1, Math.max(0.015, raw));
    })
    .slice(-WAVEFORM_POINT_COUNT);

  if (normalized.length >= WAVEFORM_POINT_COUNT) {
    return normalized;
  }

  return [
    ...createIdleWaveform().slice(0, WAVEFORM_POINT_COUNT - normalized.length),
    ...normalized,
  ];
}

function resolveApiResourceUrl(url) {
  if (!url) return "";

  try {
    return new URL(url).toString();
  } catch {
    return new URL(url, API_BASE_URL).toString();
  }
}

function buildRecordingAudioUrl(recordId, explicitUrl) {
  if (explicitUrl) {
    return resolveApiResourceUrl(explicitUrl);
  }

  if (!recordId) return "";

  return resolveApiResourceUrl(
    RECORDING_AUDIO_ENDPOINT_TEMPLATE.replace(
      ":recordId",
      encodeURIComponent(recordId),
    ),
  );
}

function normalizeRecord(record, index) {
  const id = record.id || `record-${index}`;

  return {
    id,
    areaId: record.areaId || record.siteId || DEFAULT_SELECTED_ID,
    areaLabel: record.areaLabel || record.siteLabel || "Unknown site",
    areaShort: record.areaShort || record.siteDescription || "No site detail",
    capturedAt: toTimestamp(record.capturedAt || record.createdAt),
    durationMs: Number(record.durationMs || record.duration || 0),
    status: record.status || "Stored on server",
    audioUrl: buildRecordingAudioUrl(
      id,
      record.audioUrl || record.audioPath || record.url,
    ),
  };
}

function normalizeMeasurementResponse(payload) {
  const session = payload.currentSession || payload.session || {};
  const controls = payload.controls || payload.actions || {};
  const records = Array.isArray(payload.records) ? payload.records : [];
  const isRecording = Boolean(session.isRecording);
  const sharedRecordingUrl = controls.recordUrl || controls.url || "";
  const sharedRecordingMethod = controls.recordMethod || controls.method || "POST";
  const hasRecordControl =
    controls.canRecord !== undefined ||
    Boolean(controls.recordUrl || controls.record?.url || sharedRecordingUrl);

  return {
    sourceLabel: payload.sourceLabel || payload.source || "REST endpoint",
    updatedAt: toTimestamp(payload.updatedAt) || Date.now(),
    currentSession: {
      isRecording,
      runtimeMs: Number(session.runtimeMs || session.runtime || 0),
      streamStatus: session.streamStatus || session.status || "Waiting for data",
      signalQuality: session.signalQuality || session.quality || "Unavailable",
      activeAreaId: session.activeAreaId || session.areaId || DEFAULT_SELECTED_ID,
      waveform: normalizeWaveform(session.waveform || payload.waveform),
    },
    controls: {
      canRecord: hasRecordControl
        ? Boolean(
            controls.canRecord ??
              controls.recordUrl ??
              controls.record?.url ??
              sharedRecordingUrl,
          )
        : !isRecording,
      recordUrl: controls.recordUrl || controls.record?.url || sharedRecordingUrl,
      recordMethod:
        controls.recordMethod || controls.record?.method || sharedRecordingMethod,
    },
    records: records.map(normalizeRecord),
  };
}

function normalizePatientResults(payload) {
  const rawPatients = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.patients)
      ? payload.patients
      : Array.isArray(payload.results)
        ? payload.results
        : payload.patient
          ? [payload.patient]
          : payload && typeof payload === "object" && (payload.fullName || payload.name || payload.id)
            ? [payload]
            : [];

  return rawPatients.map((patient, index) => {
    const fullName =
      patient.name ||
      patient.fullName ||
      [patient.firstName, patient.lastName].filter(Boolean).join(" ") ||
      `Patient ${index + 1}`;

    const recordings = Array.isArray(patient.recordings)
      ? patient.recordings
      : Array.isArray(patient.history)
        ? patient.history
        : [];

    return {
      id: patient.id || patient.patientId || patient.mrn || `patient-${index}`,
      fullName,
      mrn: patient.mrn || patient.patientNumber || "",
      age: patient.age || "",
      sex: patient.sex || patient.gender || "",
      dob: patient.dob || patient.birthDate || "",
      latestVisit: toTimestamp(patient.latestVisit || patient.lastVisitAt),
      recordings: recordings.map(normalizeRecord),
    };
  });
}

export {
  normalizeMeasurementResponse,
  normalizePatientResults,
  normalizeRecord,
  normalizeWaveform,
  toTimestamp,
};
