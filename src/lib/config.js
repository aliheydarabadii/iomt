const DEFAULT_SELECTED_ID = "aortic";
const WAVEFORM_POINT_COUNT = 180;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const PATIENT_SEARCH_ENDPOINT =
  import.meta.env.VITE_PATIENT_SEARCH_ENDPOINT || "/api/patients/search";
const PATIENT_CREATE_ENDPOINT =
  import.meta.env.VITE_PATIENT_CREATE_ENDPOINT || "/api/patients";
const MEASUREMENT_ENDPOINT =
  import.meta.env.VITE_HEART_MEASUREMENT_ENDPOINT ||
  "/api/heart-measurements/current";
const RECORD_ENDPOINT_TEMPLATE =
  import.meta.env.VITE_HEART_RECORD_ENDPOINT_TEMPLATE ||
  "/api/heart-measurements/:patientId/record";
// Fixed-duration capture run by the BLE sensor (Arduino). The record request
// blocks for this long, so the UI shows a busy state for the whole window.
const RECORD_DURATION_SECONDS = Number(
  import.meta.env.VITE_HEART_RECORD_DURATION_SECONDS || 60,
);
// Must stay well above the record duration or the blocking call will appear to
// fail while the backend is still capturing.
const RECORD_REQUEST_TIMEOUT_MS = Number(
  import.meta.env.VITE_HEART_RECORD_REQUEST_TIMEOUT_MS || 90000,
);
const RECORDING_AUDIO_ENDPOINT_TEMPLATE =
  import.meta.env.VITE_HEART_RECORDING_AUDIO_ENDPOINT_TEMPLATE ||
  "/api/heart-recordings/:recordId/audio";
const ANALYTICS_ENDPOINT_TEMPLATE =
  import.meta.env.VITE_HEART_ANALYTICS_ENDPOINT_TEMPLATE ||
  "/api/heart-recordings/:recordId/analysis";
const ANALYTICS_METHOD = "GET";
const ANALYTICS_INCLUDE_SIGNALS =
  import.meta.env.VITE_HEART_ANALYTICS_INCLUDE_SIGNALS !== "false";
const ANALYTICS_MAX_POINTS = Number(
  import.meta.env.VITE_HEART_ANALYTICS_MAX_POINTS || 2500,
);
const POLL_INTERVAL_MS = Number(
  import.meta.env.VITE_HEART_MEASUREMENT_POLL_MS || 3000,
);

function formatDateTimeLocalValue(value) {
  const date = value ? new Date(value) : new Date();
  const pad = (segment) => String(segment).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function createIdleWaveform() {
  return Array.from({ length: WAVEFORM_POINT_COUNT }, (_, index) => {
    if (index % 28 === 0) return 0.08;
    if (index % 11 === 0) return 0.04;
    return 0.015;
  });
}

function getInitialCreateForm() {
  return {
    fullName: "",
    mrn: "",
    sex: "Male",
    dob: "",
    latestVisit: formatDateTimeLocalValue(),
  };
}

const EMPTY_MEASUREMENT = {
  sourceLabel: "REST endpoint",
  updatedAt: 0,
  currentSession: {
    isRecording: false,
    runtimeMs: 0,
    streamStatus: "Waiting for data",
    signalQuality: "Unavailable",
    activeAreaId: DEFAULT_SELECTED_ID,
    waveform: createIdleWaveform(),
    capturedSampleCount: 0,
    expectedSampleCount: 0,
    recordingProgress: 0,
    recordedWaveform: [],
  },
  controls: {
    canRecord: false,
    recordUrl: "",
    recordMethod: "POST",
  },
  records: [],
};

export {
  API_BASE_URL,
  ANALYTICS_ENDPOINT_TEMPLATE,
  ANALYTICS_INCLUDE_SIGNALS,
  ANALYTICS_MAX_POINTS,
  ANALYTICS_METHOD,
  DEFAULT_SELECTED_ID,
  EMPTY_MEASUREMENT,
  MEASUREMENT_ENDPOINT,
  PATIENT_CREATE_ENDPOINT,
  PATIENT_SEARCH_ENDPOINT,
  POLL_INTERVAL_MS,
  RECORD_DURATION_SECONDS,
  RECORD_ENDPOINT_TEMPLATE,
  RECORD_REQUEST_TIMEOUT_MS,
  RECORDING_AUDIO_ENDPOINT_TEMPLATE,
  WAVEFORM_POINT_COUNT,
  createIdleWaveform,
  getInitialCreateForm,
};
