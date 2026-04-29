export default function SummaryTile({ label, value, detail }) {
  return (
    <div className="rounded-[24px] border border-white/65 bg-white/80 p-4 shadow-sm shadow-slate-950/5 backdrop-blur-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-1 text-sm text-slate-600">{detail}</p>
    </div>
  );
}
