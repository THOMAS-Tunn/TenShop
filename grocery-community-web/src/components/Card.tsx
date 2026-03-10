import clsx from "clsx";

export function Card({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        "rounded-3xl border border-slate-200 bg-white p-4 text-slate-900 shadow-soft transition-colors duration-300",
        className
      )}
    >
      {children}
    </div>
  );
}
