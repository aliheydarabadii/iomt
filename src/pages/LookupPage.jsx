import DetailChip from "@/components/app/DetailChip";
import HistoryCard from "@/components/app/HistoryCard";
import StepPill from "@/components/app/StepPill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCaptureTime } from "@/lib/formatters";

export default function LookupPage({
  intakeMode,
  onIntakeModeChange,
  searchQuery,
  onSearchQueryChange,
  onSearch,
  isSearching,
  searchError,
  createForm,
  onCreateFormChange,
  onCreatePatient,
  isCreating,
  createError,
  createSuccess,
  patients,
  selectedPatient,
  onSelectPatient,
  onOpenMeasurement,
}) {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="relative overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(235,245,255,0.88))] p-6 shadow-[0_32px_80px_-36px_rgba(15,23,42,0.45)] sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.2),transparent_30%),radial-gradient(circle_at_left_center,rgba(14,165,233,0.1),transparent_32%)]" />
          <div className="relative">
            <div className="flex flex-wrap gap-3">
              <StepPill active number="1" label="Patient Lookup" />
              <StepPill active={false} number="2" label="Measurement Console" />
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
              Patient Intake
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Find A Patient Before Reviewing Heart Sound History
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
              Enter the patient name, retrieve prior recordings from the server,
              review the history, then open the measurement page with the patient
              context already attached.
            </p>
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card className="overflow-hidden rounded-[30px] border border-white/70 bg-white/92 shadow-[0_26px_70px_-34px_rgba(15,23,42,0.38)] backdrop-blur-sm">
              <CardHeader className="border-b border-slate-200/80 pb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                  Intake Actions
                </p>
                <CardTitle className="mt-2 text-2xl text-slate-950">
                  Patient Intake Workspace
                </CardTitle>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Choose whether you want to find an existing record or register a new patient.
                </p>
              </CardHeader>

              <CardContent className="space-y-5 p-5 sm:p-6">
                <div className="grid grid-cols-2 rounded-[22px] bg-slate-100 p-1.5">
                  <button
                    type="button"
                    onClick={() => onIntakeModeChange("search")}
                    className={[
                      "rounded-[18px] px-4 py-3 text-sm font-semibold transition-colors",
                      intakeMode === "search"
                        ? "bg-white text-slate-950 shadow-sm shadow-slate-950/5"
                        : "text-slate-500 hover:text-slate-700",
                    ].join(" ")}
                  >
                    Find Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => onIntakeModeChange("create")}
                    className={[
                      "rounded-[18px] px-4 py-3 text-sm font-semibold transition-colors",
                      intakeMode === "create"
                        ? "bg-white text-slate-950 shadow-sm shadow-slate-950/5"
                        : "text-slate-500 hover:text-slate-700",
                    ].join(" ")}
                  >
                    Create Patient
                  </button>
                </div>

                {intakeMode === "search" ? (
                  <form className="space-y-4" onSubmit={onSearch}>
                    <div>
                      <label
                        htmlFor="patient-name"
                        className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500"
                      >
                        Patient Name
                      </label>
                      <input
                        id="patient-name"
                        type="text"
                        value={searchQuery}
                        onChange={(event) => onSearchQueryChange(event.target.value)}
                        placeholder="Enter full patient name"
                        className="mt-2 w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-950 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSearching || !searchQuery.trim()}
                      className="inline-flex w-full items-center justify-center rounded-[20px] bg-slate-950 px-4 py-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {isSearching ? "Searching..." : "Search Patient"}
                    </button>

                    {searchError ? (
                      <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                        {searchError}
                      </div>
                    ) : null}
                  </form>
                ) : (
                  <form className="space-y-4" onSubmit={onCreatePatient}>
                    <div>
                      <label
                        htmlFor="create-full-name"
                        className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500"
                      >
                        Full Name
                      </label>
                      <input
                        id="create-full-name"
                        type="text"
                        value={createForm.fullName}
                        onChange={(event) =>
                          onCreateFormChange("fullName", event.target.value)
                        }
                        placeholder="Daniel Carter"
                        className="mt-2 w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-950 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                        required
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="create-mrn"
                          className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500"
                        >
                          MRN
                        </label>
                        <input
                          id="create-mrn"
                          type="text"
                          value={createForm.mrn}
                          onChange={(event) =>
                            onCreateFormChange("mrn", event.target.value)
                          }
                          placeholder="MRN-10999"
                          className="mt-2 w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-950 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                          required
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="create-sex"
                          className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500"
                        >
                          Sex
                        </label>
                        <select
                          id="create-sex"
                          value={createForm.sex}
                          onChange={(event) =>
                            onCreateFormChange("sex", event.target.value)
                          }
                          className="mt-2 w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-950 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="create-dob"
                          className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500"
                        >
                          Date Of Birth
                        </label>
                        <input
                          id="create-dob"
                          type="date"
                          value={createForm.dob}
                          onChange={(event) =>
                            onCreateFormChange("dob", event.target.value)
                          }
                          className="mt-2 w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-950 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                          required
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="create-latest-visit"
                          className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500"
                        >
                          Latest Visit
                        </label>
                        <input
                          id="create-latest-visit"
                          type="datetime-local"
                          value={createForm.latestVisit}
                          onChange={(event) =>
                            onCreateFormChange("latestVisit", event.target.value)
                          }
                          className="mt-2 w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-950 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={
                        isCreating ||
                        !createForm.fullName.trim() ||
                        !createForm.mrn.trim() ||
                        !createForm.dob ||
                        !createForm.latestVisit
                      }
                      className="inline-flex w-full items-center justify-center rounded-[20px] bg-sky-600 px-4 py-4 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-200"
                    >
                      {isCreating ? "Creating Patient..." : "Create And Select Patient"}
                    </button>

                    {createError ? (
                      <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                        {createError}
                      </div>
                    ) : null}

                    {createSuccess ? (
                      <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        {createSuccess}
                      </div>
                    ) : null}
                  </form>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="overflow-hidden rounded-[30px] border border-white/70 bg-white/92 shadow-[0_26px_70px_-34px_rgba(15,23,42,0.38)] backdrop-blur-sm">
              <CardContent className="p-5 sm:p-6">
                {selectedPatient ? (
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                        Active Patient
                      </p>
                      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                        {selectedPatient.fullName}
                      </h2>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedPatient.mrn ? (
                          <DetailChip tone="sky">MRN {selectedPatient.mrn}</DetailChip>
                        ) : null}
                        {selectedPatient.age ? (
                          <DetailChip>Age {selectedPatient.age}</DetailChip>
                        ) : null}
                        {selectedPatient.sex ? (
                          <DetailChip>{selectedPatient.sex}</DetailChip>
                        ) : null}
                        {selectedPatient.dob ? (
                          <DetailChip>DOB {selectedPatient.dob}</DetailChip>
                        ) : null}
                      </div>
                      <p className="mt-4 text-sm leading-6 text-slate-600">
                        Review prior measurements first, then move into the live
                        measurement console once this patient selection is confirmed.
                      </p>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Snapshot
                      </p>
                      <div className="mt-4 space-y-3">
                        <div>
                          <p className="text-2xl font-semibold text-slate-950">
                            {selectedPatient.recordings.length}
                          </p>
                          <p className="text-sm text-slate-500">Historical recordings</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {selectedPatient.latestVisit
                              ? formatCaptureTime(selectedPatient.latestVisit)
                              : "No visit date"}
                          </p>
                          <p className="text-sm text-slate-500">Latest visit</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onOpenMeasurement}
                        className="mt-5 inline-flex w-full items-center justify-center rounded-[18px] bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
                      >
                        Open Measurement Console
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-5 py-10 text-center">
                    <p className="text-base font-semibold text-slate-900">
                      No patient selected yet
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Pick a patient from the search results or create a new patient
                      profile to unlock the history workspace.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[minmax(300px,0.92fr)_minmax(0,1.08fr)]">
              <Card className="overflow-hidden rounded-[30px] border border-white/70 bg-white/92 shadow-[0_26px_70px_-34px_rgba(15,23,42,0.38)] backdrop-blur-sm">
                <CardHeader className="border-b border-slate-200/80 pb-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-2xl text-slate-950">Search Results</CardTitle>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Select the correct patient to load their historical measurements.
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {patients.length} found
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 p-5 sm:p-6">
                  {patients.length ? (
                    patients.map((patient) => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => onSelectPatient(patient)}
                        className={[
                          "w-full rounded-[24px] border px-4 py-4 text-left transition-colors",
                          selectedPatient?.id === patient.id
                            ? "border-sky-200 bg-sky-50 shadow-sm shadow-sky-100/80"
                            : "border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold text-slate-950">
                              {patient.fullName}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              {patient.mrn ? `MRN ${patient.mrn}` : "No MRN returned"}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                            {patient.recordings.length} records
                          </span>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                          {selectedPatient?.id === patient.id ? (
                            <DetailChip tone="sky">Selected</DetailChip>
                          ) : null}
                          {patient.age ? <DetailChip>Age {patient.age}</DetailChip> : null}
                          {patient.sex ? <DetailChip>{patient.sex}</DetailChip> : null}
                          {patient.latestVisit ? (
                            <DetailChip>
                              Last visit {formatCaptureTime(patient.latestVisit)}
                            </DetailChip>
                          ) : null}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-5 py-8 text-center">
                      <p className="text-base font-semibold text-slate-900">
                        No patient selected
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Search for a patient name to load the matching profiles and
                        prior recordings from the server.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="overflow-hidden rounded-[30px] border border-white/70 bg-white/92 shadow-[0_26px_70px_-34px_rgba(15,23,42,0.38)] backdrop-blur-sm">
                <CardHeader className="border-b border-slate-200/80 pb-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-2xl text-slate-950">Patient History</CardTitle>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Timeline of historical heart sound recordings for the selected patient.
                      </p>
                    </div>
                    {selectedPatient ? (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {selectedPatient.recordings.length} history items
                      </span>
                    ) : null}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 p-5 sm:p-6">
                  {selectedPatient ? (
                    <>
                      <div className="rounded-[24px] border border-slate-200 bg-slate-50/75 p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Selected Patient
                        </p>
                        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                          {selectedPatient.fullName}
                        </h2>
                        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                          {selectedPatient.mrn ? (
                            <span className="rounded-full bg-white px-3 py-1">
                              MRN {selectedPatient.mrn}
                            </span>
                          ) : null}
                          {selectedPatient.age ? (
                            <span className="rounded-full bg-white px-3 py-1">
                              Age {selectedPatient.age}
                            </span>
                          ) : null}
                          {selectedPatient.sex ? (
                            <span className="rounded-full bg-white px-3 py-1">
                              {selectedPatient.sex}
                            </span>
                          ) : null}
                          {selectedPatient.dob ? (
                            <span className="rounded-full bg-white px-3 py-1">
                              DOB {selectedPatient.dob}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {selectedPatient.recordings.length ? (
                        <div className="space-y-4">
                          {selectedPatient.recordings.map((record) => (
                            <HistoryCard key={record.id} record={record} />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-5 py-8 text-center">
                          <p className="text-base font-semibold text-slate-900">
                            No prior recordings returned
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            The patient profile was found, but the lookup response did
                            not include any historical heart sound measurements.
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-5 py-8 text-center">
                      <p className="text-base font-semibold text-slate-900">
                        Select a patient to review history
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        After you choose a patient from the result list, the historical
                        recordings and profile details will appear here.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
