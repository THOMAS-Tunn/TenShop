import { Link, NavLink, useNavigate } from "react-router-dom";
import { signOut, type SessionUser } from "../lib/auth";
import { useMemo } from "react";
import clsx from "clsx";

export function Layout({ user, loading }: { user: SessionUser | null; loading: boolean }) {
  const navigate = useNavigate();

  const nav = useMemo(
    () => [
      { to: "/", label: "Home" },
      { to: "/shop", label: "Shop" },
      { to: "/community", label: "Community" }
    ],
    []
  );

  return (
    <header className="sticky top-0 z-50 border-b bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-2xl bg-slate-900" />
          <div className="leading-tight">
            <div className="text-sm font-semibold">Grocery</div>
            <div className="text-xs text-slate-500">Shopping + Community</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                clsx(
                  "rounded-2xl px-3 py-2 text-sm transition",
                  isActive ? "bg-slate-900 text-white" : "hover:bg-slate-100"
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {loading ? (
            <div className="h-9 w-28 animate-pulse rounded-2xl bg-slate-100" />
          ) : user ? (
            <>
              <button
                onClick={() => navigate("/profile")}
                className="rounded-2xl border px-3 py-2 text-sm hover:bg-slate-50"
                title={user.email ?? "Profile"}
              >
                Profile
              </button>
              <button
                onClick={async () => {
                  try {
                    await signOut();
                    navigate("/", { replace: true });
                  } catch (e: any) {
                    alert(e?.message ?? "Sign out failed");
                  }
                }}
                className="rounded-2xl bg-slate-900 px-3 py-2 text-sm text-white hover:opacity-90"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="rounded-2xl bg-slate-900 px-3 py-2 text-sm text-white hover:opacity-90"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
