import { Link, NavLink, useNavigate } from "react-router-dom";
import { signOut, type SessionUser } from "../lib/auth";
import { useMemo } from "react";
import clsx from "clsx";
import siteLogo from "../assets/logo.png";

export function Layout({ user, loading }: { user: SessionUser | null; loading: boolean }) {
  const navigate = useNavigate();

  const nav = useMemo(
    () => [
      { to: "/", label: "Home" },
      { to: "/shop", label: "Shop" },
      { to: "/community", label: "Community" },
      { to: "/chat", label: "Chat" },
    ],
    []
  );

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/88 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm ring-4 ring-red-50">
            <img
              src={siteLogo}
              alt="TenShop logo"
              className="h-full w-full rounded-full object-cover"
            />
          </div>

          <div className="leading-tight">
            <div className="text-base font-semibold tracking-tight text-slate-900">TenShop</div>
            <div className="text-xs text-slate-500">Delicious • Flexible • Easy</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={user || n.to === "/" ? n.to : "/auth"}
              className={({ isActive }) =>
                clsx(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-100"
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {loading ? (
            <div className="h-10 w-28 animate-pulse rounded-full bg-slate-100" />
          ) : user ? (
            <>
              <button
                onClick={() => navigate("/profile")}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
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
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
