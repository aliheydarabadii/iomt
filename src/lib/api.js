import {
  ANALYTICS_ENDPOINT_TEMPLATE,
  ANALYTICS_INCLUDE_SIGNALS,
  ANALYTICS_MAX_POINTS,
  ANALYTICS_METHOD,
  API_BASE_URL,
  MEASUREMENT_ENDPOINT,
  PATIENT_CREATE_ENDPOINT,
  PATIENT_SEARCH_ENDPOINT,
  RECORDING_ENDPOINT_TEMPLATE,
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

function getResponseErrorMessage(body, fallback) {
  if (body && typeof body === "object") {
    return body.message || body.error || fallback;
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

function buildRecordingActionUrl(patientId) {
  if (!patientId) return "";

  return resolveApiUrl(
    RECORDING_ENDPOINT_TEMPLATE.replace(":patientId", encodeURIComponent(patientId)),
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
  const fallbackRecordingUrl = buildRecordingActionUrl(patient?.id);

  if (!fallbackRecordingUrl) {
    return normalized;
  }

  return {
    ...normalized,
    controls: {
      ...normalized.controls,
      recordUrl: fallbackRecordingUrl,
      stopUrl: fallbackRecordingUrl,
      recordMethod: "POST",
      stopMethod: "POST",
    },
  };
}

async function performControlAction(url, method, payload) {
  const response = await fetch(resolveApiUrl(url), {
    method,
    headers: {
      Accept: "application/json",
      ...(payload ? { "Content-Type": "application/json" } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });

  if (!response.ok) {
    const body = await readJsonBody(response);
    throw new Error(
      getResponseErrorMessage(body, `Control action failed with ${response.status}`),
    );
  }

  return readJsonBody(response);
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

export {
  buildRecordingAnalyticsUrl,
  buildRecordingActionUrl,
  fetchMeasurement,
  performControlAction,
  resolveApiUrl,
  runRecordingAnalysis,
  searchPatientsByName,
  createPatient,
};
