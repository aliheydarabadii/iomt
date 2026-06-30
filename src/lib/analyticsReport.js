import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const MARGIN = 36;
const COLORS = {
  ink: [15, 23, 42],
  muted: [100, 116, 139],
  line: [203, 213, 225],
  pale: [248, 250, 252],
  sky: [2, 132, 199],
  skyPale: [240, 249, 255],
  rosePale: [255, 241, 242],
  white: [255, 255, 255],
};

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function reportValue(value, digits = 3) {
  if (value === null || value === undefined || value === "") return "Not available";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map((item) => reportValue(item, digits)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  if (!isFiniteNumber(value)) return String(value);
  const number = Number(value);
  if (Number.isInteger(number)) return String(number);
  return number.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
}

function titleize(value) {
  return String(value)
    .replace(/^_+/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "medium",
  }).format(date);
}

function filenameOnly(value) {
  const parts = String(value || "").split(/[\\/]/);
  return parts.at(-1) || "Not available";
}

function rowsFromObject(value, omittedKeys = []) {
  const omitted = new Set(omittedKeys);
  return Object.entries(value || {})
    .filter(([key]) => !omitted.has(key))
    .map(([key, item]) => [titleize(key), reportValue(item)]);
}

function pageWidth(doc) {
  return doc.internal.pageSize.getWidth();
}

function pageHeight(doc) {
  return doc.internal.pageSize.getHeight();
}

function setCursor(doc, y) {
  doc.__reportCursorY = y;
}

function cursor(doc) {
  return doc.__reportCursorY || MARGIN;
}

function addPage(doc, orientation = "portrait") {
  doc.addPage("a4", orientation);
  setCursor(doc, MARGIN);
}

function ensureSpace(doc, height, orientation = null) {
  const y = cursor(doc);
  if (y + height <= pageHeight(doc) - MARGIN) return y;
  const currentOrientation =
    orientation || (pageWidth(doc) > pageHeight(doc) ? "landscape" : "portrait");
  addPage(doc, currentOrientation);
  return cursor(doc);
}

function addSectionTitle(doc, title, options = {}) {
  const y = options.forceY ?? ensureSpace(doc, 38);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(options.size || 15);
  doc.setTextColor(...COLORS.ink);
  doc.text(title, MARGIN, y);
  doc.setDrawColor(...COLORS.sky);
  doc.setLineWidth(2);
  doc.line(MARGIN, y + 6, MARGIN + 62, y + 6);
  setCursor(doc, y + 18);
  return y + 18;
}

function addTable(doc, title, headers, rows, options = {}) {
  if (!rows?.length) return;
  if (options.newPage) addPage(doc, options.orientation || "portrait");
  const startY = addSectionTitle(doc, title);
  autoTable(doc, {
    startY,
    head: [headers],
    body: rows,
    theme: "grid",
    margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: MARGIN },
    styles: {
      font: "helvetica",
      fontSize: options.fontSize || 7.5,
      cellPadding: options.cellPadding || 3.5,
      overflow: "linebreak",
      valign: "middle",
      textColor: COLORS.ink,
      lineColor: [226, 232, 240],
      lineWidth: 0.45,
    },
    headStyles: {
      fillColor: COLORS.ink,
      textColor: COLORS.white,
      fontStyle: "bold",
      fontSize: options.headFontSize || options.fontSize || 7.5,
    },
    alternateRowStyles: { fillColor: COLORS.pale },
    columnStyles: options.columnStyles,
    rowPageBreak: "avoid",
    showHead: "everyPage",
    didDrawPage: options.didDrawPage,
  });
  setCursor(doc, doc.lastAutoTable.finalY + 16);
}

function addLandscapeTable(doc, title, headers, rows, options = {}) {
  if (!rows?.length) return;
  addPage(doc, "landscape");
  addTable(doc, title, headers, rows, {
    ...options,
    fontSize: options.fontSize || 6.4,
    cellPadding: options.cellPadding || 2.5,
  });
}

function addKeyMetrics(doc, metrics) {
  const startY = addSectionTitle(doc, "Key Measurements");
  const columns = 4;
  const gap = 7;
  const width = (pageWidth(doc) - MARGIN * 2 - gap * (columns - 1)) / columns;
  const height = 49;

  metrics.forEach((metric, index) => {
    const row = Math.floor(index / columns);
    const x = MARGIN + (index % columns) * (width + gap);
    const y = startY + row * (height + gap);
    doc.setFillColor(...COLORS.pale);
    doc.setDrawColor(...COLORS.line);
    doc.roundedRect(x, y, width, height, 4, 4, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.muted);
    doc.text(metric.label.toUpperCase(), x + 7, y + 13);
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.ink);
    const text = `${reportValue(metric.value, 2)}${metric.unit ? ` ${metric.unit}` : ""}`;
    doc.text(doc.splitTextToSize(text, width - 14).slice(0, 2), x + 7, y + 32);
  });
  setCursor(
    doc,
    startY + Math.ceil(metrics.length / columns) * (height + gap) + 3,
  );
}

function addFinding(doc, title, text, significant = false) {
  const lines = doc.splitTextToSize(text || "Not available", pageWidth(doc) - MARGIN * 2 - 24);
  const height = Math.max(58, 34 + lines.length * 11);
  const y = ensureSpace(doc, height + 8);
  doc.setFillColor(...(significant ? COLORS.rosePale : COLORS.skyPale));
  doc.setDrawColor(...(significant ? [251, 113, 133] : [125, 211, 252]));
  doc.roundedRect(MARGIN, y, pageWidth(doc) - MARGIN * 2, height, 5, 5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.muted);
  doc.text(title.toUpperCase(), MARGIN + 12, y + 16);
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.ink);
  doc.text(lines, MARGIN + 12, y + 34);
  setCursor(doc, y + height + 14);
}

function addInfoGrid(doc, patient, record, result, fileInfo) {
  const patientRows = [
    ["Full name", patient?.fullName || "Not available"],
    ["Patient ID", patient?.id || "Not available"],
    ["MRN", patient?.mrn || "Not available"],
    ["Date of birth", patient?.dob || "Not available"],
    ["Age / sex", `${reportValue(patient?.age)} / ${patient?.sex || "Not available"}`],
    ["Latest visit", formatDateTime(patient?.latestVisit)],
  ];
  const recordingRows = [
    ["Recording ID", result.recordingId || record?.id || "Not available"],
    ["Captured", formatDateTime(record?.capturedAt)],
    ["Auscultation site", record?.areaLabel || "Not available"],
    ["Site detail", record?.areaShort || "Not available"],
    ["Duration", `${reportValue(fileInfo.duration_s)} s`],
    ["Sample rate", `${reportValue(fileInfo.sample_rate_hz)} Hz`],
  ];
  const rows = Array.from(
    { length: Math.max(patientRows.length, recordingRows.length) },
    (_, index) => [
      ...(patientRows[index] || ["", ""]),
      ...(recordingRows[index] || ["", ""]),
    ],
  );
  addTable(
    doc,
    "Patient And Recording",
    ["Patient field", "Value", "Recording field", "Value"],
    rows,
    {
      fontSize: 7,
      columnStyles: {
        0: { cellWidth: 72, fontStyle: "bold" },
        1: { cellWidth: 150 },
        2: { cellWidth: 82, fontStyle: "bold" },
        3: { cellWidth: 175 },
      },
    },
  );
}

function tableRows(rows, columns) {
  return (rows || []).map((row) =>
    columns.map((column) => reportValue(row?.[column])),
  );
}

function peakEventRows(peaks) {
  const detected = peaks.peak_times_s || [];
  const s1 = peaks.s1_times_s || [];
  const s2 = peaks.s2_times_s || [];
  const length = Math.max(detected.length, s1.length, s2.length);
  return Array.from({ length }, (_, index) => [
    index + 1,
    index < detected.length ? reportValue(detected[index], 4) : "",
    index < s1.length ? reportValue(s1[index], 4) : "",
    index < s2.length ? reportValue(s2[index], 4) : "",
  ]);
}

function compactSegmentRows(segments) {
  const rows = [];
  for (let index = 0; index < segments.length; index += 2) {
    const first = segments[index] || {};
    const second = segments[index + 1] || {};
    rows.push([
      index + 1,
      reportValue(first.state),
      reportValue(first.start_s, 4),
      reportValue(first.end_s, 4),
      second.state ? index + 2 : "",
      second.state ? reportValue(second.state) : "",
      second.state ? reportValue(second.start_s, 4) : "",
      second.state ? reportValue(second.end_s, 4) : "",
    ]);
  }
  return rows;
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

async function svgToPng(svg) {
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const viewBox = svg.viewBox.baseVal;
  const width = Math.max(1000, viewBox.width || 1000);
  const height = Math.max(350, viewBox.height || 350);
  clone.setAttribute("width", width);
  clone.setAttribute("height", height);
  const blob = new Blob(
    [new XMLSerializer().serializeToString(clone)],
    { type: "image/svg+xml;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/png", 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function addPlotPages(doc, plotElements) {
  const plots = Array.from(plotElements || []);
  if (!plots.length) return;
  let slot = 0;

  for (const plot of plots) {
    const svg = plot.querySelector("svg[role='img']");
    if (!svg) continue;
    if (slot % 2 === 0) {
      addPage(doc, "portrait");
      addSectionTitle(doc, slot === 0 ? "Analysis Plots" : "Analysis Plots Continued");
    }
    const position = slot % 2;
    const title = plot.dataset.reportTitle || svg.getAttribute("aria-label") || "Analysis plot";
    const image = await svgToPng(svg);
    const y = position === 0 ? 66 : 414;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.ink);
    doc.text(title, MARGIN, y);
    doc.addImage(
      image,
      "PNG",
      MARGIN,
      y + 10,
      pageWidth(doc) - MARGIN * 2,
      205,
      undefined,
      "FAST",
    );
    slot += 1;
  }
  setCursor(doc, pageHeight(doc) - MARGIN);
}

function addFooters(doc, generatedAt) {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    const width = pageWidth(doc);
    const height = pageHeight(doc);
    doc.setDrawColor(226, 232, 240);
    doc.line(MARGIN, height - 27, width - MARGIN, height - 27);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text(`Generated ${generatedAt}`, MARGIN, height - 15);
    doc.text(`Page ${page} of ${pages}`, width - MARGIN, height - 15, {
      align: "right",
    });
  }
}

function safeFilename(value) {
  return String(value || "patient")
    .trim()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export async function createAnalysisPdfReport({
  result,
  patient,
  record,
  plotElements,
}) {
  const analysis = result.analysis || result;
  const fileInfo = analysis.file_info || {};
  const peaks = analysis.peaks || {};
  const segmentation = analysis.segmentation || {};
  const classification = analysis.classification || {};
  const cycles = classification.cycles || [];
  const rejectedCycles = classification.rejected_cycles || [];
  const ruleBased = classification.rule_based || {};
  const outliers = classification.robust_outliers || {};
  const murmur = analysis.murmur || {};
  const robustHrv = analysis.robust_hrv || {};
  const quality = analysis.signal_quality || {};
  const morphology = analysis.morphology || {};
  const activity = analysis.advanced_activity || {};
  const generatedAt = formatDateTime(new Date());
  const heartRate =
    robustHrv.clean?.heart_rate_mean_bpm ??
    robustHrv.raw?.heart_rate_mean_bpm ??
    classification.hrv_metrics?.heart_rate_mean_bpm ??
    classification.per_cycle_stats?.heart_rate_bpm?.mean;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
    compress: true,
  });
  setCursor(doc, 158);

  doc.setFillColor(...COLORS.ink);
  doc.rect(0, 0, pageWidth(doc), 116, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...COLORS.white);
  doc.text("PCG Analysis Report", MARGIN, 45);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(186, 230, 253);
  doc.text(
    `${patient?.fullName || "Unknown patient"} | ${record?.areaLabel || "Unknown site"}`,
    MARGIN,
    68,
  );
  doc.text(`Recording ${result.recordingId || record?.id || "Not available"}`, MARGIN, 86);
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.muted);
  doc.text(
    "Automated PCG screening output. This report is not a diagnosis and requires professional clinical interpretation.",
    MARGIN,
    136,
  );

  addKeyMetrics(doc, [
    { label: "Mean heart rate", value: heartRate, unit: "bpm" },
    { label: "SDNN", value: robustHrv.clean?.sdnn_ms ?? robustHrv.raw?.sdnn_ms, unit: "ms" },
    { label: "RMSSD", value: robustHrv.clean?.rmssd_ms ?? robustHrv.raw?.rmssd_ms, unit: "ms" },
    { label: "Duration", value: fileInfo.duration_s, unit: "s" },
    { label: "Accepted cycles", value: cycles.length },
    { label: "Outlier cycles", value: outliers.n_outlier_cycles || 0 },
    { label: "Noise reduction", value: quality.out_of_band_reduction_pct, unit: "%" },
    { label: "Morphology similarity", value: morphology.mean_similarity },
  ]);
  addFinding(
    doc,
    "Murmur-like screening",
    murmur.assessment,
    (murmur.systolic_pct || 0) > 50 || (murmur.diastolic_pct || 0) > 50,
  );
  addInfoGrid(doc, patient, record, result, fileInfo);

  addPage(doc, "portrait");
  addTable(doc, "Heart-rate Variability", ["Metric", "Raw", "Artifact-cleaned"], [
    ["Mean NN (ms)", reportValue(robustHrv.raw?.mean_nn_ms), reportValue(robustHrv.clean?.mean_nn_ms)],
    ["Median NN (ms)", reportValue(robustHrv.raw?.median_nn_ms), reportValue(robustHrv.clean?.median_nn_ms)],
    ["SDNN (ms)", reportValue(robustHrv.raw?.sdnn_ms), reportValue(robustHrv.clean?.sdnn_ms)],
    ["RMSSD (ms)", reportValue(robustHrv.raw?.rmssd_ms), reportValue(robustHrv.clean?.rmssd_ms)],
    ["pNN50 (%)", reportValue(robustHrv.raw?.pnn50_pct), reportValue(robustHrv.clean?.pnn50_pct)],
    ["CVNN (%)", reportValue(robustHrv.raw?.cvnn_pct), reportValue(robustHrv.clean?.cvnn_pct)],
    ["Mean heart rate (bpm)", reportValue(robustHrv.raw?.heart_rate_mean_bpm), reportValue(robustHrv.clean?.heart_rate_mean_bpm)],
    ["Intervals", reportValue(robustHrv.raw?.n_intervals), reportValue(robustHrv.clean?.n_intervals)],
  ]);
  addTable(doc, "Signal Quality", ["Metric", "Value"], [
    ["Raw out-of-band ratio", reportValue(quality.raw_out_of_band_ratio)],
    ["Filtered out-of-band ratio", reportValue(quality.filtered_out_of_band_ratio)],
    ["Out-of-band reduction", `${reportValue(quality.out_of_band_reduction_pct)} %`],
    ...rowsFromObject(quality.filtered_spectral_features),
  ]);
  addTable(
    doc,
    "PCG Sub-band Energy",
    ["Frequency band", "Energy ratio"],
    rowsFromObject(quality.subband_energy_ratio),
  );
  addTable(doc, "Peak And Cycle Counts", ["Metric", "Value"], [
    ["Detected peaks", reportValue(peaks.total_peaks)],
    ["S1 peaks", reportValue(peaks.s1_count)],
    ["S2 peaks", reportValue(peaks.s2_count)],
    ["Unassigned peaks", reportValue(peaks.unassigned_count)],
    ["Accepted S1/S2 pairs", reportValue(peaks.accepted_pairs)],
    ["Accepted cycles", reportValue(cycles.length)],
    ["Rejected cycles", reportValue(rejectedCycles.length)],
  ]);

  await addPlotPages(doc, plotElements);

  addPage(doc, "portrait");
  addTable(
    doc,
    "Segmentation Statistics",
    ["State", "Count", "Mean (ms)", "Std (ms)", "Min (ms)", "Max (ms)"],
    Object.entries(segmentation.stats || {}).map(([state, stats]) => [
      state,
      reportValue(stats.count),
      reportValue(stats.mean_ms),
      reportValue(stats.std_ms),
      reportValue(stats.min_ms),
      reportValue(stats.max_ms),
    ]),
  );
  addTable(
    doc,
    "Per-cycle Aggregate Statistics",
    ["Metric", "Mean", "Std", "Min", "Max"],
    Object.entries(classification.per_cycle_stats || {}).map(([metric, stats]) => [
      titleize(metric),
      reportValue(stats.mean),
      reportValue(stats.std),
      reportValue(stats.min),
      reportValue(stats.max),
    ]),
  );
  addTable(doc, "Morphology Consistency", ["Metric", "Value"], rowsFromObject(morphology));
  addTable(doc, "Advanced Activity Summary", ["Metric", "Value"], rowsFromObject(activity, [
    "cycle_results",
  ]));

  addTable(
    doc,
    "Rule-based Findings",
    ["Cycle", "Violations"],
    (ruleBased.flagged_details || []).map((finding) => [
      reportValue(finding.cycle_index),
      reportValue(finding.violations),
    ]),
    { newPage: true },
  );
  addTable(
    doc,
    "Robust MAD Outliers",
    ["Cycle", "Feature", "Value", "Robust Z"],
    (outliers.findings || []).map((finding) => [
      reportValue(finding.cycle_index),
      titleize(finding.feature),
      reportValue(finding.value),
      reportValue(finding.robust_z),
    ]),
  );
  addTable(
    doc,
    "Rejected Cycles",
    ["Cycle", "Reason", "S1 (ms)", "Systole (ms)", "S2 (ms)", "Diastole (ms)", "Cycle (ms)"],
    rejectedCycles.map((cycle, index) => [
      reportValue(cycle.cycle_index ?? index),
      reportValue(cycle.reason),
      reportValue(cycle.s1_duration_ms),
      reportValue(cycle.systolic_ms),
      reportValue(cycle.s2_duration_ms),
      reportValue(cycle.diastolic_ms),
      reportValue(cycle.cycle_duration_ms),
    ]),
  );

  const murmurColumns = [
    "systolic_murmur_like",
    "diastolic_murmur_like",
    "systolic_grade",
    "diastolic_grade",
    "systolic_ratio",
    "diastolic_ratio",
    "sys_diamond",
    "dia_decrescendo",
    "reference_rms",
  ];
  addLandscapeTable(
    doc,
    "Murmur Cycle Results",
    ["Cycle", ...murmurColumns.map(titleize)],
    (murmur.cycle_results || []).map((row, index) => [
      index + 1,
      ...murmurColumns.map((column) => reportValue(row[column])),
    ]),
  );

  const activityTimingColumns = [
    "cycle_index",
    "reference_rms",
    "systolic_active",
    "systolic_ratio",
    "systolic_timing",
    "systolic_shape",
    "diastolic_active",
    "diastolic_ratio",
    "diastolic_timing",
    "mid_diastolic_active",
    "late_diastolic_active",
  ];
  addLandscapeTable(
    doc,
    "Advanced Activity: Timing And Status",
    activityTimingColumns.map(titleize),
    tableRows(activity.cycle_results, activityTimingColumns),
  );
  const activityFractionColumns = [
    "cycle_index",
    "systolic_early_fraction",
    "systolic_mid_fraction",
    "systolic_late_fraction",
    "systolic_peak_position",
    "diastolic_early_ratio",
    "diastolic_mid_ratio",
    "diastolic_late_ratio",
    "diastolic_early_fraction",
    "diastolic_mid_fraction",
    "diastolic_late_fraction",
  ];
  addLandscapeTable(
    doc,
    "Advanced Activity: Phase Fractions",
    activityFractionColumns.map(titleize),
    tableRows(activity.cycle_results, activityFractionColumns),
  );

  const cleanCycles = cycles.map((cycle, index) => ({
    cycle: index + 1,
    ...Object.fromEntries(
      Object.entries(cycle).filter(([key]) => !key.startsWith("_")),
    ),
  }));
  const timingColumns = [
    "cycle",
    "heart_rate_bpm",
    "cycle_duration_ms",
    "s1_duration_ms",
    "systolic_ms",
    "s2_duration_ms",
    "diastolic_ms",
    "sd_ratio",
    "s1_s2_amp_ratio",
  ];
  addLandscapeTable(
    doc,
    "Accepted Cycles: Timing Metrics",
    timingColumns.map(titleize),
    tableRows(cleanCycles, timingColumns),
  );
  const acousticColumns = [
    "cycle",
    "s1_rms",
    "s2_rms",
    "energy_concentration",
    "s1_zcr",
    "s2_zcr",
    "s1_kurtosis",
    "s2_kurtosis",
    "s1_centroid",
    "s2_centroid",
    "sys_noise_ratio",
    "dia_noise_ratio",
  ];
  addLandscapeTable(
    doc,
    "Accepted Cycles: Acoustic Metrics",
    acousticColumns.map(titleize),
    tableRows(cleanCycles, acousticColumns),
  );
  const mfccColumns = [
    "cycle",
    "mfcc_0",
    "mfcc_1",
    "mfcc_2",
    "mfcc_3",
    "mfcc_4",
    "mfcc_5",
    "mfcc_6",
    "mfcc_7",
  ];
  addLandscapeTable(
    doc,
    "Accepted Cycles: MFCC Coefficients",
    mfccColumns.map(titleize),
    tableRows(cleanCycles, mfccColumns),
  );

  addLandscapeTable(
    doc,
    "Segmentation Timeline",
    [
      "#",
      "State",
      "Start (s)",
      "End (s)",
      "#",
      "State",
      "Start (s)",
      "End (s)",
    ],
    compactSegmentRows(segmentation.segments || []),
    { fontSize: 6.8 },
  );

  addTable(
    doc,
    "Peak Event Times",
    ["Sequence", "Detected peak (s)", "S1 time (s)", "S2 time (s)"],
    peakEventRows(peaks),
    { newPage: true, fontSize: 7 },
  );
  addTable(doc, "Pipeline Configuration", ["Setting", "Value"], rowsFromObject(analysis.config));
  addTable(doc, "Export Information", ["Field", "Value"], [
    ["Input file", filenameOnly(fileInfo.filename)],
    ...rowsFromObject(analysis.exports),
    ["Report generated", generatedAt],
  ]);

  addFooters(doc, generatedAt);
  const date = new Date().toISOString().slice(0, 10);
  doc.save(`${safeFilename(patient?.fullName)}_pcg_report_${date}.pdf`);
}
