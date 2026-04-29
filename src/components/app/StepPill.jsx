export default function StepPill({ active, label, number }) {
  return (
    <div
      className={[
        "inline-flex items-center gap-3 rounded-full border px-4 py-2 text-sm font-medium",
        active
          ? "border-sky-200 bg-sky-50 text-sky-900"
          : "border-slate-200 bg-white/70 text-slate-500",
      ].join(" ")}
    >
      <span
        className={[
          "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
          active ? "bg-sky-600 text-white" : "bg-slate-200 text-slate-700",
        ].join(" ")}
      >
        {number}
      </span>
      {label}
    </div>
  );
}
