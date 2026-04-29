function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const badgeVariants = {
  default: "border border-slate-900 bg-slate-900 text-white",
  secondary: "border border-slate-200 bg-slate-100 text-slate-700",
};

export function Badge({
  className = "",
  variant = "default",
  ...props
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full text-xs font-medium transition-colors",
        badgeVariants[variant] || badgeVariants.default,
        className,
      )}
      {...props}
    />
  );
}
