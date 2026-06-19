import { useEffect, useMemo, useState } from "react";
import { HEART_AUSCULTATION_AREAS } from "@/components/HeartAuscultationMap";
import {
  createPatient,
  deleteRecording,
  fetchMeasurement,
  recordMeasurement,
  searchPatientsByName,
} from "@/lib/api";
import {
  DEFAULT_SELECTED_ID,
  EMPTY_MEASUREMENT,
  POLL_INTERVAL_MS,
  RECORD_DURATION_SECONDS,
  getInitialCreateForm,
} from "@/lib/config";
import LookupPage from "@/pages/LookupPage";
import MeasurementPage from "@/pages/MeasurementPage";

export default function App() {
  const [currentPage, setCurrentPage] = useState("lookup");
  const [intakeMode, setIntakeMode] = useState("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [createForm, setCreateForm] = useState(() => getInitialCreateForm());
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  const [measurement, setMeasurement] = useState(EMPTY_MEASUREMENT);
  const [selectedAreaId, setSelectedAreaId] = useState(DEFAULT_SELECTED_ID);
  const [isMeasurementLoading, setIsMeasurementLoading] = useState(false);
  const [measurementError, setMeasurementError] = useState("");
  const [isRecordPending, setIsRecordPending] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const selectedArea = useMemo(() => {
    const activeAreaId =
      measurement.currentSession.isRecording && measurement.currentSession.activeAreaId
        ? measurement.currentSession.activeAreaId
        : selectedAreaId;

    return (
      HEART_AUSCULTATION_AREAS.find((area) => area.id === activeAreaId) ||
      HEART_AUSCULTATION_AREAS[0]
    );
  }, [
    measurement.currentSession.activeAreaId,
    measurement.currentSession.isRecording,
    selectedAreaId,
  ]);

  useEffect(() => {
    if (currentPage !== "measurement" || !selectedPatient) return undefined;

    let cancelled = false;
    let isRefreshing = false;
    const controller = new AbortController();

    async function loadMeasurement() {
      if (cancelled || isRefreshing) return;
      isRefreshing = true;

      try {
        const nextMeasurement = await fetchMeasurement(selectedPatient, controller.signal);
        if (cancelled) return;

        setMeasurement(nextMeasurement);
        setMeasurementError("");

        if (nextMeasurement.currentSession.isRecording) {
          setSelectedAreaId(nextMeasurement.currentSession.activeAreaId);
        }
      } catch (error) {
        if (cancelled || error?.name === "AbortError") return;

        setMeasurementError(
          error instanceof Error
            ? error.message
            : "Unable to load measurement data.",
        );
      } finally {
        if (!cancelled) {
          setIsMeasurementLoading(false);
        }

        isRefreshing = false;
      }
    }

    setIsMeasurementLoading(true);
    loadMeasurement();
    const intervalId = window.setInterval(
      loadMeasurement,
      isRecordPending ? 500 : POLL_INTERVAL_MS,
    );

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [currentPage, isRecordPending, selectedPatient]);

  // Drive the "Recording… (N seconds)" busy state while the blocking record
  // request is in flight.
  useEffect(() => {
    if (!isRecordPending) return undefined;

    setRecordSeconds(0);
    const intervalId = window.setInterval(() => {
      setRecordSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isRecordPending]);

  async function handleSearch(event) {
    event.preventDefault();

    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError("");
    setCreateSuccess("");

    try {
      const results = await searchPatientsByName(searchQuery.trim());
      setPatients(results);
      setSelectedPatient(results[0] || null);
    } catch (error) {
      setSearchError(
        error instanceof Error ? error.message : "Unable to search patients.",
      );
      setPatients([]);
      setSelectedPatient(null);
    } finally {
      setIsSearching(false);
    }
  }

  async function handleCreatePatient(event) {
    event.preventDefault();

    const fullName = createForm.fullName.trim();
    const mrn = createForm.mrn.trim();

    if (!fullName || !mrn || !createForm.dob || !createForm.latestVisit) {
      return;
    }

    const latestVisit = new Date(createForm.latestVisit);
    if (Number.isNaN(latestVisit.getTime())) {
      setCreateError("Latest visit must be a valid date and time.");
      return;
    }

    setIsCreating(true);
    setCreateError("");
    setCreateSuccess("");

    try {
      const createdPatient = await createPatient({
        fullName,
        mrn,
        sex: createForm.sex,
        dob: createForm.dob,
        latestVisit: latestVisit.toISOString(),
      });

      setPatients((current) => [
        createdPatient,
        ...current.filter((patient) => patient.id !== createdPatient.id),
      ]);
      setSelectedPatient(createdPatient);
      setSearchQuery(createdPatient.fullName);
      setCreateSuccess(`${createdPatient.fullName} was created and selected.`);
      setCreateForm(getInitialCreateForm());
      setIntakeMode("search");
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Unable to create patient.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRecord() {
    if (!selectedPatient || isRecordPending) return;

    const recordUrl = measurement.controls.recordUrl;
    const areaId = selectedArea.id;

    setIsRecordPending(true);
    setMeasurementError("");

    try {
      // Blocks for the full fixed-duration capture, then the recording is
      // already stored on the server when this resolves.
      await recordMeasurement(selectedPatient.id, areaId, { url: recordUrl });

      // Refresh to pull in the freshly stored recording and updated session.
      const nextMeasurement = await fetchMeasurement(selectedPatient);
      setMeasurement(nextMeasurement);
      if (nextMeasurement.currentSession.isRecording) {
        setSelectedAreaId(nextMeasurement.currentSession.activeAreaId);
      }
    } catch (error) {
      setMeasurementError(
        error instanceof Error ? error.message : "Unable to record.",
      );
    } finally {
      setIsRecordPending(false);
    }
  }

  async function handleRemoveRecording(recordId) {
    if (!selectedPatient || !recordId) return null;

    await deleteRecording(recordId);
    const nextMeasurement = await fetchMeasurement(selectedPatient);
    setMeasurement(nextMeasurement);
    setSelectedPatient((current) =>
      current?.id === selectedPatient.id
        ? { ...current, recordings: nextMeasurement.records }
        : current,
    );
    return nextMeasurement;
  }

  if (currentPage === "lookup") {
    return (
      <LookupPage
        intakeMode={intakeMode}
        onIntakeModeChange={(mode) => {
          setIntakeMode(mode);
          setSearchError("");
          setCreateError("");
          setCreateSuccess("");
        }}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onSearch={handleSearch}
        isSearching={isSearching}
        searchError={searchError}
        createForm={createForm}
        onCreateFormChange={(field, value) => {
          setCreateError("");
          setCreateSuccess("");
          setCreateForm((current) => ({
            ...current,
            [field]: value,
          }));
        }}
        onCreatePatient={handleCreatePatient}
        isCreating={isCreating}
        createError={createError}
        createSuccess={createSuccess}
        patients={patients}
        selectedPatient={selectedPatient}
        onSelectPatient={setSelectedPatient}
        onOpenMeasurement={() => {
          if (!selectedPatient) return;

          setSelectedAreaId(DEFAULT_SELECTED_ID);
          setMeasurement(EMPTY_MEASUREMENT);
          setMeasurementError("");
          setCurrentPage("measurement");
        }}
      />
    );
  }

  return (
    <MeasurementPage
      patient={selectedPatient}
      measurement={measurement}
      selectedArea={selectedArea}
      selectedAreaId={selectedArea.id}
      onAreaChange={setSelectedAreaId}
      isLoading={isMeasurementLoading}
      errorMessage={measurementError}
      isRecordPending={isRecordPending}
      recordSeconds={recordSeconds}
      recordDurationSeconds={RECORD_DURATION_SECONDS}
      onRecord={handleRecord}
      onRemoveRecording={handleRemoveRecording}
      onBack={() => setCurrentPage("lookup")}
    />
  );
}
