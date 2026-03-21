import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import siteLogo from "../assets/logo.png";
import { signOut, type SessionUser } from "../lib/auth";
import { useAppSettings, type Language } from "../lib/app-settings";
import { useNotice } from "../lib/notices";

type OpenMenu = "user" | "settings" | null;
type MobileMenuView = "closed" | "main" | "settings";

const LANGUAGE_OPTIONS: Language[] = ["en", "vi", "es"];

export function Layout({ user, loading }: { user: SessionUser | null; loading: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [mobileMenuView, setMobileMenuView] = useState<MobileMenuView>("closed");
  const { language, setLanguage, theme, setTheme, copy } = useAppSettings();
  const notice = useNotice();

  const layoutCopy = copy.layout;
  const mobileCartLabel = language === "en" ? "My cart" : copy.cartDetail.title;
  const mobileThemeLabel = language === "en" ? "Theme" : layoutCopy.theme;
  const isDark = theme === "dark";

  const nav = useMemo(
    () => [
      { to: "/", label: layoutCopy.nav.home },
      { to: "/shop", label: layoutCopy.nav.shop },
      { to: "/community", label: layoutCopy.nav.community },
      { to: "/chat", label: layoutCopy.nav.chat },
    ],
    [layoutCopy]
  );

  const mobileMenuItems = useMemo(
    () => [
      { to: "/", label: layoutCopy.nav.home, icon: "fa-house" },
      { to: user ? "/shop" : "/auth", label: layoutCopy.nav.shop, icon: "fa-store" },
      { to: user ? "/community" : "/auth", label: layoutCopy.nav.community, icon: "fa-users" },
      { to: user ? "/chat" : "/auth", label: layoutCopy.nav.chat, icon: "fa-comments" },
      ...(user
        ? [
            { to: "/cart", label: mobileCartLabel, icon: "fa-cart-shopping" },
            { to: "/profile", label: layoutCopy.profile, icon: "fa-user" },
          ]
        : [{ to: "/auth", label: layoutCopy.signIn, icon: "fa-right-to-bracket" }]),
    ],
    [layoutCopy, mobileCartLabel, user]
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

  useEffect(() => {
    setOpenMenu(null);
    setMobileMenuView("closed");
  }, [location.key]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    function handleViewportChange(event: MediaQueryListEvent) {
      if (event.matches) setMobileMenuView("closed");
    }
    mediaQuery.addEventListener("change", handleViewportChange);
    return () => mediaQuery.removeEventListener("change", handleViewportChange);
  }, []);

  function closeAllMenus() {
    setOpenMenu(null);
    setMobileMenuView("closed");
  }

  function getNavTarget(to: string) {
    return user || to === "/" ? to : "/auth";
  }

  function handleMobileMenuButton() {
    if (mobileMenuView === "settings") {
      setMobileMenuView("main");
      return;
    }
    setMobileMenuView((current) => (current === "closed" ? "main" : "closed"));
  }

  function handleMobileNavigate(to: string) {
    closeAllMenus();
    navigate(to);
  }

  async function handleSignOut() {
    try {
      await signOut();
      closeAllMenus();
      navigate("/", { replace: true });
    } catch (error: any) {
      notice.showError(error?.message ?? layoutCopy.signOutFailed);
    }
  }

  // ── Header styling ──────────────────────────────────────────
  const headerClasses = isDark
    ? "border-b border-[rgb(78,58,36)] bg-[rgb(14,10,6)]/88"
    : "border-b border-[rgb(210,196,178)/0.7] bg-[rgb(255,252,248)/0.82]";

  const logoRingClasses = isDark
    ? "border-[rgb(78,58,36)] bg-[rgb(28,20,12)] ring-[rgb(28,20,12)]"
    : "border-[rgb(210,196,178)] bg-[rgb(255,252,248)] ring-[rgb(255,246,232)]";

  const brandTitleClasses = isDark ? "text-[rgb(252,246,238)]" : "text-[rgb(28,18,8)]";
  const brandSubtitleClasses = isDark ? "text-[rgb(164,140,110)]" : "text-[rgb(140,112,82)]";

  const navInactiveClasses = isDark
    ? "text-[rgb(208,190,166)] hover:bg-[rgb(42,30,18)] hover:text-[rgb(252,246,238)]"
    : "text-[rgb(92,70,46)] hover:bg-[rgb(242,236,226)] hover:text-[rgb(28,18,8)]";

  const navActiveClasses = isDark
    ? "bg-[rgb(213,120,28)] text-white shadow-sm"
    : "bg-[rgb(28,18,8)] text-white shadow-sm";

  const iconButtonClasses = isDark
    ? "border-[rgb(78,58,36)] bg-[rgb(28,20,12)] text-[rgb(234,222,206)] hover:bg-[rgb(42,30,18)] hover:border-[rgb(110,84,52)]"
    : "border-[rgb(210,196,178)] bg-[rgb(255,252,248)] text-[rgb(92,70,46)] hover:bg-[rgb(248,244,237)] hover:border-[rgb(180,164,142)]";

  const menuClasses = isDark
    ? "border-[rgb(78,58,36)] bg-[rgb(14,10,6)] text-[rgb(234,222,206)] shadow-black/40"
    : "border-[rgb(210,196,178)] bg-[rgb(255,252,248)] text-[rgb(48,34,18)] shadow-[rgb(180,164,142)/0.35]";

  const sectionTitleClasses = isDark ? "text-[rgb(164,140,110)]" : "text-[rgb(140,112,82)]";

  const optionButtonClasses = isDark
    ? "border-[rgb(78,58,36)] bg-[rgb(28,20,12)] text-[rgb(234,222,206)] hover:bg-[rgb(42,30,18)]"
    : "border-[rgb(210,196,178)] bg-[rgb(248,244,237)] text-[rgb(92,70,46)] hover:bg-[rgb(242,236,226)]";

  const selectedOptionClasses = isDark
    ? "border-[rgb(213,120,28)] bg-[rgb(80,56,24)] text-[rgb(240,172,60)]"
    : "border-[rgb(28,18,8)] bg-[rgb(28,18,8)] text-white";

  const mobileBackdropClasses = isDark ? "bg-[rgb(14,10,6)]/60" : "bg-[rgb(28,18,8)]/20";

  const mobileDrawerClasses = isDark
    ? "border-[rgb(78,58,36)] bg-[rgb(14,10,6)] text-[rgb(234,222,206)] shadow-black/50"
    : "border-[rgb(210,196,178)] bg-[rgb(255,252,248)] text-[rgb(48,34,18)] shadow-[rgb(180,164,142)/0.45]";

  const mobileItemClasses = isDark
    ? "border-[rgb(78,58,36)] bg-[rgb(14,10,6)]/80 text-[rgb(234,222,206)] hover:bg-[rgb(28,20,12)]"
    : "border-[rgb(210,196,178)] bg-[rgb(255,252,248)] text-[rgb(48,34,18)] hover:bg-[rgb(248,244,237)]";

  const mobileChevronClasses = isDark ? "text-[rgb(110,84,52)]" : "text-[rgb(180,164,142)]";

  const mobileSectionTitleClasses = clsx(
    "mb-3 pl-1 text-[11px] font-semibold uppercase tracking-[0.28em]",
    sectionTitleClasses
  );

  // ── Theme toggle pill ─────────────────────────────────────
  // A compact icon-only sun/moon toggle
  function ThemeToggle({ mobile = false }: { mobile?: boolean }) {
    const isLight = theme === "light";
    return (
      <button
        type="button"
        aria-label={isLight ? layoutCopy.dark : layoutCopy.light}
        title={isLight ? layoutCopy.dark : layoutCopy.light}
        onClick={() => setTheme(isLight ? "dark" : "light")}
        className={clsx(
          "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full transition-all duration-300",
          mobile ? "h-10 w-10" : "h-11 w-11",
          "border",
          iconButtonClasses,
          // amber glow in dark when toggling to light
          !isLight && "shadow-[0_0_12px_rgb(213,120,28)/0.35]"
        )}
      >
        {/* Sun icon */}
        <i
          className={clsx(
            "fa-solid fa-sun absolute transition-all duration-300",
            isLight
              ? "translate-y-0 opacity-100 rotate-0 text-[rgb(213,120,28)]"
              : "translate-y-5 opacity-0 rotate-90"
          )}
          style={{ fontSize: mobile ? 15 : 16 }}
          aria-hidden="true"
        />
        {/* Moon icon */}
        <i
          className={clsx(
            "fa-solid fa-moon absolute transition-all duration-300",
            !isLight
              ? "translate-y-0 opacity-100 rotate-0 text-[rgb(180,160,220)]"
              : "-translate-y-5 opacity-0 -rotate-90"
          )}
          style={{ fontSize: mobile ? 14 : 15 }}
          aria-hidden="true"
        />
      </button>
    );
  }

  return (
    <>
      <header
        className={clsx(
          "sticky top-0 z-50 backdrop-blur-xl transition-colors duration-300",
          headerClasses
        )}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          {/* Brand */}
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

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={getNavTarget(item.to)}
                className={({ isActive }) =>
                  clsx(
                    "rounded-full px-4 py-2 text-sm font-medium transition",
                    isActive ? navActiveClasses : navInactiveClasses
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Desktop actions */}
          <div ref={menuRef} className="flex items-center gap-2">
            {loading ? (
              <>
                <div className="hidden h-10 w-10 animate-pulse rounded-full bg-slate-100 md:block" />
                <div className="hidden h-10 w-10 animate-pulse rounded-full bg-slate-100 md:block" />
                <div className="h-10 w-10 animate-pulse rounded-full bg-slate-100 md:hidden" />
              </>
            ) : (
              <>
                {user ? (
                  <div className="hidden items-center gap-2 md:flex">
                    {/* Cart */}
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

                    {/* Theme toggle */}
                    <ThemeToggle />

                    {/* Profile */}
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
                            isDark ? "hover:bg-[rgb(28,20,12)]" : "hover:bg-[rgb(248,244,237)]"
                          )}
                        >
                          <i className="fa-solid fa-user text-sm" aria-hidden="true" />
                          <span>{layoutCopy.profile}</span>
                        </button>
                      </div>
                    </div>

                    {/* Settings */}
                    <div className="relative">
                      <button
                        type="button"
                        aria-label={layoutCopy.settings}
                        aria-haspopup="menu"
                        aria-expanded={openMenu === "settings"}
                        onClick={() => setOpenMenu((current) => (current === "settings" ? null : "settings"))}
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
                          {/* Language */}
                          <div>
                            <div className={clsx("mb-2 text-xs font-semibold uppercase tracking-[0.2em]", sectionTitleClasses)}>
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

                          {/* Sign out */}
                          <button
                            type="button"
                            onClick={() => void handleSignOut()}
                            className={clsx(
                              "flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                              isDark
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
                  </div>
                ) : (
                  <div className="hidden items-center gap-2 md:flex">
                    {/* Theme toggle even when logged out */}
                    <ThemeToggle />
                    <Link
                      to="/auth"
                      className={clsx(
                        "rounded-full px-4 py-2 text-sm font-medium text-white hover:opacity-90",
                        isDark ? "bg-[rgb(213,120,28)]" : "bg-[rgb(28,18,8)]"
                      )}
                    >
                      {layoutCopy.signIn}
                    </Link>
                  </div>
                )}

                {/* Mobile hamburger */}
                <div className="md:hidden">
                  <button
                    type="button"
                    aria-label={mobileMenuView === "settings" ? "Back" : "Menu"}
                    aria-haspopup="dialog"
                    aria-expanded={mobileMenuView !== "closed"}
                    aria-controls="mobile-menu-panel"
                    onClick={handleMobileMenuButton}
                    className={clsx(
                      "relative z-[60] inline-flex h-11 w-11 items-center justify-center rounded-full border text-base transition-colors duration-300",
                      iconButtonClasses
                    )}
                  >
                    <i
                      className={
                        mobileMenuView === "settings"
                          ? "fa-solid fa-arrow-left"
                          : "fa-solid fa-bars"
                      }
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <div
        className={clsx(
          "fixed inset-0 z-[45] md:hidden transition-opacity duration-300",
          mobileMenuView === "closed"
            ? "pointer-events-none opacity-0"
            : "pointer-events-auto opacity-100"
        )}
      >
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileMenuView("closed")}
          className={clsx("absolute inset-0", mobileBackdropClasses)}
        />

        <div
          id="mobile-menu-panel"
          className={clsx(
            "absolute bottom-0 right-0 top-[4.75rem] w-[min(88vw,22rem)] overflow-hidden rounded-l-[2rem] border-l shadow-2xl transition-transform duration-300 ease-out",
            mobileDrawerClasses,
            mobileMenuView === "closed" ? "translate-x-full" : "translate-x-0"
          )}
        >
          <div className="h-full overflow-y-auto p-4">
            {mobileMenuView === "settings" ? (
              <div className="space-y-6">
                <div>
                  <div className={mobileSectionTitleClasses}>{layoutCopy.language}</div>
                  <div className="space-y-2">
                    {LANGUAGE_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setLanguage(option)}
                        className={clsx(
                          "w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium transition",
                          optionButtonClasses,
                          language === option && selectedOptionClasses
                        )}
                      >
                        {layoutCopy.languageNames[option]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mobile theme toggle */}
                <div>
                  <div className={mobileSectionTitleClasses}>{mobileThemeLabel}</div>
                  <div
                    className="flex items-center gap-3 rounded-2xl border px-4 py-3"
                    style={{
                      borderColor: isDark ? "rgb(78,58,36)" : "rgb(210,196,178)",
                      background: isDark ? "rgb(28,20,12)" : "rgb(248,244,237)",
                    }}
                  >
                    <i className={clsx("fa-solid fa-sun text-sm", isDark ? "text-[rgb(164,140,110)]" : "text-[rgb(213,120,28)]")} aria-hidden="true" />
                    {/* Toggle pill */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isDark}
                      aria-label={isDark ? layoutCopy.light : layoutCopy.dark}
                      onClick={() => setTheme(isDark ? "light" : "dark")}
                      className={clsx(
                        "relative h-7 w-12 rounded-full transition-colors duration-300",
                        isDark ? "bg-[rgb(213,120,28)]" : "bg-[rgb(210,196,178)]"
                      )}
                    >
                      <span
                        className={clsx(
                          "absolute top-1 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300",
                          isDark ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                    <i className={clsx("fa-solid fa-moon text-sm", isDark ? "text-[rgb(180,160,220)]" : "text-[rgb(164,140,110)]")} aria-hidden="true" />
                    <span className={clsx("ml-auto text-sm font-medium", isDark ? "text-[rgb(208,190,166)]" : "text-[rgb(92,70,46)]")}>
                      {isDark ? layoutCopy.dark : layoutCopy.light}
                    </span>
                  </div>
                </div>

                {user ? (
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className={clsx(
                      "flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                      isDark
                        ? "bg-red-500/15 text-red-200 hover:bg-red-500/25"
                        : "bg-red-50 text-red-700 hover:bg-red-100"
                    )}
                  >
                    <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
                    <span>{layoutCopy.signOut}</span>
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                {mobileMenuItems.map((item) => (
                  <button
                    key={`${item.to}-${item.label}`}
                    type="button"
                    onClick={() => handleMobileNavigate(item.to)}
                    className={clsx(
                      "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition",
                      mobileItemClasses
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <i className={`fa-solid ${item.icon}`} aria-hidden="true" />
                      <span>{item.label}</span>
                    </span>
                    <i
                      className={clsx("fa-solid fa-chevron-right text-xs", mobileChevronClasses)}
                      aria-hidden="true"
                    />
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setMobileMenuView("settings")}
                  className={clsx(
                    "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition",
                    mobileItemClasses
                  )}
                >
                  <span className="flex items-center gap-3">
                    <i className="fa-solid fa-gear" aria-hidden="true" />
                    <span>{layoutCopy.settings}</span>
                  </span>
                  <i
                    className={clsx("fa-solid fa-chevron-right text-xs", mobileChevronClasses)}
                    aria-hidden="true"
                  />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
