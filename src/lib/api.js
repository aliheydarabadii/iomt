import {
  ANALYTICS_ENDPOINT_TEMPLATE,
  ANALYTICS_INCLUDE_SIGNALS,
  ANALYTICS_MAX_POINTS,
  ANALYTICS_METHOD,
  API_BASE_URL,
  MEASUREMENT_ENDPOINT,
  PATIENT_CREATE_ENDPOINT,
  PATIENT_SEARCH_ENDPOINT,
  RECORD_DURATION_SECONDS,
  RECORD_ENDPOINT_TEMPLATE,
  RECORD_REQUEST_TIMEOUT_MS,
} from "@/lib/config";
import {
  normalizeMeasurementResponse,
  normalizePatientResults,
} from "@/lib/normalizers";

async function readJsonBody(response) {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Friendly copy for the documented record error codes. Falls back to the
// server-provided message for anything not listed here.
const RECORD_ERROR_MESSAGES = {
  invalid_area_id: "That auscultation site is not valid.",
  patient_not_found: "This patient could not be found on the server.",
  recording_already_running:
    "A recording is already in progress for this patient.",
  ble_device_busy: "The sensor is currently streaming to another patient.",
  no_ble_audio_captured:
    "The capture finished but no audio arrived from the sensor. Check the sensor and try again.",
};

function getResponseErrorMessage(body, fallback) {
  if (body && typeof body === "object") {
    // New error envelope: { error: { code, message, details } }.
    if (body.error && typeof body.error === "object") {
      const { code, message } = body.error;
      return RECORD_ERROR_MESSAGES[code] || message || fallback;
    }

    if (typeof body.error === "string" && body.error.trim()) {
      return body.error;
    }

    return body.message || fallback;
  }

  if (typeof body === "string" && body.trim()) {
    return body;
  }

  return fallback;
}

function resolveApiUrl(url) {
  if (!url) {
    return API_BASE_URL;
  }

  try {
    return new URL(url).toString();
  } catch {
    return new URL(url, API_BASE_URL).toString();
  }
}

function withQuery(url, params) {
  const resolved = new URL(resolveApiUrl(url));

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      resolved.searchParams.set(key, value);
    }
  });

  return resolved.toString();
}

function buildRecordEndpointUrl(patientId) {
  if (!patientId) return "";

  return resolveApiUrl(
    RECORD_ENDPOINT_TEMPLATE.replace(":patientId", encodeURIComponent(patientId)),
  );
}

function buildRecordingAnalyticsUrl(recordId) {
  if (!recordId) return "";

  const encodedRecordId = encodeURIComponent(recordId);
  const endpoint = ANALYTICS_ENDPOINT_TEMPLATE
    .replace(":recordId", encodedRecordId)
    .replace(":recordingId", encodedRecordId)
    .replace("{recordId}", encodedRecordId)
    .replace("{recordingId}", encodedRecordId);
  const url = new URL(resolveApiUrl(endpoint));

  url.searchParams.set("includeSignals", String(ANALYTICS_INCLUDE_SIGNALS));
  url.searchParams.set("maxPoints", String(ANALYTICS_MAX_POINTS));
  url.searchParams.set("saveFilteredWav", "true");

  return url.toString();
}

async function searchPatientsByName(name, signal) {
  const attempts = [
    { url: PATIENT_SEARCH_ENDPOINT, params: { name } },
    { url: PATIENT_SEARCH_ENDPOINT, params: { q: name } },
    { url: "/api/patients", params: { name } },
    { url: "/api/patients", params: { fullName: name } },
    { url: "/api/patients", params: { q: name } },
  ];

  const tried = new Set();
  let lastNotFoundMessage = "Patient lookup failed with 404";

  for (const attempt of attempts) {
    const requestUrl = withQuery(attempt.url, attempt.params);
    if (tried.has(requestUrl)) continue;
    tried.add(requestUrl);

    const response = await fetch(requestUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal,
    });

    if (response.ok) {
      return normalizePatientResults((await readJsonBody(response)) || {});
    }

    const body = await readJsonBody(response);
    const message = getResponseErrorMessage(
      body,
      `Patient lookup failed with ${response.status}`,
    );

    if (response.status === 404) {
      lastNotFoundMessage = message;
      continue;
    }

    throw new Error(message);
  }

  throw new Error(lastNotFoundMessage);
}

async function createPatient(payload) {
  const response = await fetch(resolveApiUrl(PATIENT_CREATE_ENDPOINT), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await readJsonBody(response);

  if (!response.ok) {
    throw new Error(
      getResponseErrorMessage(body, `Patient creation failed with ${response.status}`),
    );
  }

  const [createdPatient] = normalizePatientResults(body || { patient: payload });

  if (!createdPatient) {
    throw new Error("Patient creation succeeded but no patient object was returned.");
  }

  return createdPatient;
}

async function fetchMeasurement(patient, signal) {
  const response = await fetch(
    withQuery(MEASUREMENT_ENDPOINT, {
      patientId: patient?.id,
      patientName: patient?.fullName,
    }),
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal,
    },
  );

  if (!response.ok) {
    const body = await readJsonBody(response);
    throw new Error(
      getResponseErrorMessage(body, `Measurement request failed with ${response.status}`),
    );
  }

  const normalized = normalizeMeasurementResponse((await readJsonBody(response)) || {});
  const fallbackRecordUrl = buildRecordEndpointUrl(patient?.id);

  if (!fallbackRecordUrl) {
    return normalized;
  }

  return {
    ...normalized,
    controls: {
      ...normalized.controls,
      recordUrl: normalized.controls.recordUrl || fallbackRecordUrl,
      recordMethod: normalized.controls.recordMethod || "POST",
    },
  };
}

// Single fixed-duration capture. This request BLOCKS until the Arduino finishes
// recording and the backend stores the result (no separate stop call). Native
// fetch has no default timeout, so we add an AbortController guard set well
// above the record duration to avoid hanging forever on a stalled sensor.
async function recordMeasurement(
  patientId,
  areaId,
  { url, durationSeconds = RECORD_DURATION_SECONDS } = {},
) {
  const recordUrl = url ? resolveApiUrl(url) : buildRecordEndpointUrl(patientId);

  if (!recordUrl) {
    throw new Error("Missing patient id for the record request.");
  }

  const requestedDurationSeconds = Number(durationSeconds);
  const payload = { areaId };
  if (Number.isFinite(requestedDurationSeconds) && requestedDurationSeconds > 0) {
    payload.durationSeconds = requestedDurationSeconds;
    payload.durationMs = Math.round(requestedDurationSeconds * 1000);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RECORD_REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(recordUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(
        "The recording request timed out before the sensor responded.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const body = await readJsonBody(response);

  if (!response.ok) {
    throw new Error(
      getResponseErrorMessage(body, `Recording failed with ${response.status}`),
    );
  }

  return body;
}

async function runRecordingAnalysis(recordId) {
  const response = await fetch(buildRecordingAnalyticsUrl(recordId), {
    method: ANALYTICS_METHOD,
    headers: {
      Accept: "application/json",
    },
  });

  const body = await readJsonBody(response);

  if (!response.ok) {
    throw new Error(
      getResponseErrorMessage(
        body,
        `Analytics request failed with ${response.status}`,
      ),
    );
  }

  return body;
}

async function deleteRecording(recordId) {
  if (!recordId) {
    throw new Error("Missing recording id.");
  }

  const response = await fetch(
    resolveApiUrl(`/api/heart-recordings/${encodeURIComponent(recordId)}`),
    {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
    },
  );
  const body = await readJsonBody(response);

  if (!response.ok) {
    throw new Error(
      getResponseErrorMessage(
        body,
        `Recording deletion failed with ${response.status}`,
      ),
    );
  }

  return body;
}

export {
  buildRecordingAnalyticsUrl,
  buildRecordEndpointUrl,
  fetchMeasurement,
  recordMeasurement,
  resolveApiUrl,
  runRecordingAnalysis,
  searchPatientsByName,
  createPatient,
  deleteRecording,
};
