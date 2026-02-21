import clsx from "clsx";

export function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-medium">{label}</div>
      <input
        {...props}
        className={clsx(
          "w-full rounded-2xl border px-3 py-2 text-sm outline-none",
          "focus:border-slate-900"
        )}
      />
    </label>
  );
}
