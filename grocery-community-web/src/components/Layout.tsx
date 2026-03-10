import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import siteLogo from "../assets/logo.png";
import { signOut, type SessionUser } from "../lib/auth";
import { useAppSettings, type Language } from "../lib/app-settings";
import { useNotice } from "../lib/notices";

type OpenMenu = "user" | "settings" | null;

const LANGUAGE_OPTIONS: Language[] = ["en", "vi", "es"];

export function Layout({ user, loading }: { user: SessionUser | null; loading: boolean }) {
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const { language, setLanguage, theme, setTheme, copy } = useAppSettings();
  const notice = useNotice();

  const layoutCopy = copy.layout;

  const nav = useMemo(
    () => [
      { to: "/", label: layoutCopy.nav.home },
      { to: "/shop", label: layoutCopy.nav.shop },
      { to: "/community", label: layoutCopy.nav.community },
      { to: "/chat", label: layoutCopy.nav.chat },
    ],
    [layoutCopy]
  );

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  async function handleSignOut() {
    try {
      await signOut();
      setOpenMenu(null);
      navigate("/", { replace: true });
    } catch (error: any) {
      notice.showError(error?.message ?? layoutCopy.signOutFailed);
    }
  }

  const headerClasses =
    theme === "dark"
      ? "border-slate-800 bg-slate-950/88"
      : "border-slate-200 bg-white/88";

  const logoRingClasses =
    theme === "dark"
      ? "border-slate-700 bg-slate-900 ring-slate-900"
      : "border-slate-200 bg-white ring-red-50";
  const brandTitleClasses = theme === "dark" ? "text-slate-100" : "text-slate-900";
  const brandSubtitleClasses = theme === "dark" ? "text-slate-400" : "text-slate-500";
  const navInactiveClasses =
    theme === "dark" ? "text-slate-200 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100";
  const iconButtonClasses =
    theme === "dark"
      ? "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50";
  const menuClasses =
    theme === "dark"
      ? "border-slate-800 bg-slate-950 text-slate-100 shadow-black/30"
      : "border-slate-200 bg-white text-slate-900 shadow-slate-300/60";
  const sectionTitleClasses = theme === "dark" ? "text-slate-400" : "text-slate-500";
  const optionButtonClasses =
    theme === "dark"
      ? "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100";
  const selectedOptionClasses =
    theme === "dark"
      ? "border-slate-500 bg-slate-800 text-white"
      : "border-slate-900 bg-slate-900 text-white";

  return (
    <header
      className={clsx(
        "sticky top-0 z-50 backdrop-blur-xl transition-colors duration-300",
        headerClasses
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-3">
          <div
            className={clsx(
              "flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border shadow-sm ring-4 transition-colors duration-300",
              logoRingClasses
            )}
          >
            <img
              src={siteLogo}
              alt="TenShop logo"
              className="h-full w-full rounded-full object-cover"
            />
          </div>

          <div className="leading-tight">
            <div
              className={clsx(
                "text-base font-semibold tracking-tight transition-colors duration-300",
                brandTitleClasses
              )}
            >
              TenShop
            </div>
            <div className={clsx("text-xs transition-colors duration-300", brandSubtitleClasses)}>
              {layoutCopy.brandTagline}
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={user || item.to === "/" ? item.to : "/auth"}
              className={({ isActive }) =>
                clsx(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  isActive ? "bg-slate-900 text-white shadow-sm" : navInactiveClasses
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div ref={menuRef} className="flex items-center gap-2">
          {loading ? (
            <>
              <div className="h-10 w-10 animate-pulse rounded-full bg-slate-100" />
              <div className="h-10 w-10 animate-pulse rounded-full bg-slate-100" />
            </>
          ) : user ? (
            <>
              <div className="relative">
                <button
                  type="button"
                  aria-label={copy.shop.yourCarts}
                  onClick={() => {
                    setOpenMenu(null);
                    navigate("/cart");
                  }}
                  className={clsx(
                    "inline-flex h-11 w-11 items-center justify-center rounded-full border text-base transition-colors duration-300",
                    iconButtonClasses
                  )}
                >
                  <i className="fa-solid fa-cart-shopping" aria-hidden="true" />
                </button>
              </div>

              <div className="relative">
                <button
                  type="button"
                  aria-label={layoutCopy.profile}
                  aria-haspopup="menu"
                  aria-expanded={openMenu === "user"}
                  onClick={() => setOpenMenu((current) => (current === "user" ? null : "user"))}
                  className={clsx(
                    "inline-flex h-11 w-11 items-center justify-center rounded-full border text-base transition-colors duration-300",
                    iconButtonClasses
                  )}
                >
                  <i className="fa-solid fa-user" aria-hidden="true" />
                </button>

                <div
                  className={clsx(
                    "absolute right-0 mt-3 w-48 origin-top-right overflow-hidden rounded-2xl border shadow-2xl transition-all duration-300 ease-out",
                    menuClasses,
                    openMenu === "user"
                      ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                      : "pointer-events-none -translate-y-2 scale-95 opacity-0"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      navigate("/profile");
                      setOpenMenu(null);
                    }}
                    className={clsx(
                      "flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition",
                      theme === "dark" ? "hover:bg-slate-900" : "hover:bg-slate-50"
                    )}
                  >
                    <i className="fa-solid fa-user text-sm" aria-hidden="true" />
                    <span>{layoutCopy.profile}</span>
                  </button>
                </div>
              </div>

              <div className="relative">
                <button
                  type="button"
                  aria-label={layoutCopy.settings}
                  aria-haspopup="menu"
                  aria-expanded={openMenu === "settings"}
                  onClick={() =>
                    setOpenMenu((current) => (current === "settings" ? null : "settings"))
                  }
                  className={clsx(
                    "inline-flex h-11 w-11 items-center justify-center rounded-full border text-base transition-all duration-300",
                    iconButtonClasses,
                    openMenu === "settings" ? "rotate-90" : "rotate-0"
                  )}
                >
                  <i className="fa-solid fa-gear" aria-hidden="true" />
                </button>

                <div
                  className={clsx(
                    "absolute right-0 mt-3 w-80 origin-top-right overflow-hidden rounded-3xl border shadow-2xl transition-all duration-300 ease-out",
                    menuClasses,
                    openMenu === "settings"
                      ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                      : "pointer-events-none -translate-y-2 scale-95 opacity-0"
                  )}
                >
                  <div className="space-y-4 p-4">
                    <div>
                      <div
                        className={clsx(
                          "mb-2 text-xs font-semibold uppercase tracking-[0.2em]",
                          sectionTitleClasses
                        )}
                      >
                        {layoutCopy.language}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {LANGUAGE_OPTIONS.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setLanguage(option)}
                            className={clsx(
                              "rounded-2xl border px-3 py-2 text-sm font-medium transition",
                              optionButtonClasses,
                              language === option && selectedOptionClasses
                            )}
                          >
                            {layoutCopy.languageNames[option]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div
                        className={clsx(
                          "mb-2 text-xs font-semibold uppercase tracking-[0.2em]",
                          sectionTitleClasses
                        )}
                      >
                        {layoutCopy.theme}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setTheme("light")}
                          className={clsx(
                            "rounded-2xl border px-3 py-2 text-sm font-medium transition",
                            optionButtonClasses,
                            theme === "light" && selectedOptionClasses
                          )}
                        >
                          {layoutCopy.light}
                        </button>
                        <button
                          type="button"
                          onClick={() => setTheme("dark")}
                          className={clsx(
                            "rounded-2xl border px-3 py-2 text-sm font-medium transition",
                            optionButtonClasses,
                            theme === "dark" && selectedOptionClasses
                          )}
                        >
                          {layoutCopy.dark}
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleSignOut()}
                      className={clsx(
                        "flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                        theme === "dark"
                          ? "bg-red-500/15 text-red-200 hover:bg-red-500/25"
                          : "bg-red-50 text-red-700 hover:bg-red-100"
                      )}
                    >
                      <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
                      <span>{layoutCopy.signOut}</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <Link
              to="/auth"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              {layoutCopy.signIn}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
