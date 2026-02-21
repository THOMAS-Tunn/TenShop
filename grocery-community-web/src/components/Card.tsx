import clsx from "clsx";

export function Card({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={clsx("rounded-3xl border bg-white p-4 shadow-soft", className)}>{children}</div>;
}
