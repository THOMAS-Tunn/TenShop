import clsx from "clsx";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAppSettings } from "./app-settings";

type NoticeVariant = "info" | "success" | "warning" | "error";

type Notice = {
  id: string;
  message: string;
  variant: NoticeVariant;
};

type NoticeOptions = {
  durationMs?: number;
  variant?: NoticeVariant;
};

type NoticeContextValue = {
  dismissNotice: (id: string) => void;
  showError: (message: string, options?: Omit<NoticeOptions, "variant">) => string | null;
  showInfo: (message: string, options?: Omit<NoticeOptions, "variant">) => string | null;
  showNotice: (message: string, options?: NoticeOptions) => string | null;
  showSuccess: (message: string, options?: Omit<NoticeOptions, "variant">) => string | null;
  showWarning: (message: string, options?: Omit<NoticeOptions, "variant">) => string | null;
};

const NoticeContext = createContext<NoticeContextValue | null>(null);

const MAX_VISIBLE_NOTICES = 4;
const DEFAULT_DURATION_BY_VARIANT: Record<NoticeVariant, number> = {
  info: 4500,
  success: 4200,
  warning: 5000,
  error: 6000,
};

const NOTICE_ICONS: Record<NoticeVariant, string> = {
  info: "fa-circle-info",
  success: "fa-circle-check",
  warning: "fa-triangle-exclamation",
  error: "fa-circle-exclamation",
};

function getNoticeToneClasses(theme: "light" | "dark", variant: NoticeVariant) {
  const isDarkTheme = theme === "dark";

  if (variant === "success") {
    return {
      panel: isDarkTheme
        ? "border-emerald-400/40 bg-slate-950/95 text-slate-50 shadow-black/30"
        : "border-emerald-200 bg-white/95 text-slate-900 shadow-slate-900/10",
      iconWrap: isDarkTheme ? "bg-emerald-500/15" : "bg-emerald-50",
      icon: isDarkTheme ? "text-emerald-200" : "text-emerald-700",
      rail: isDarkTheme ? "bg-emerald-400/70" : "bg-emerald-500/70",
    };
  }

  if (variant === "warning") {
    return {
      panel: isDarkTheme
        ? "border-amber-400/40 bg-slate-950/95 text-slate-50 shadow-black/30"
        : "border-amber-200 bg-white/95 text-slate-900 shadow-slate-900/10",
      iconWrap: isDarkTheme ? "bg-amber-500/15" : "bg-amber-50",
      icon: isDarkTheme ? "text-amber-200" : "text-amber-700",
      rail: isDarkTheme ? "bg-amber-400/70" : "bg-amber-500/70",
    };
  }

  if (variant === "error") {
    return {
      panel: isDarkTheme
        ? "border-red-400/40 bg-slate-950/95 text-slate-50 shadow-black/30"
        : "border-red-200 bg-white/95 text-slate-900 shadow-slate-900/10",
      iconWrap: isDarkTheme ? "bg-red-500/15" : "bg-red-50",
      icon: isDarkTheme ? "text-red-200" : "text-red-700",
      rail: isDarkTheme ? "bg-red-400/70" : "bg-red-500/70",
    };
  }

  return {
    panel: isDarkTheme
      ? "border-slate-600 bg-slate-950/95 text-slate-50 shadow-black/30"
      : "border-slate-200 bg-white/95 text-slate-900 shadow-slate-900/10",
    iconWrap: isDarkTheme ? "bg-slate-800" : "bg-slate-100",
    icon: isDarkTheme ? "text-slate-200" : "text-slate-700",
    rail: isDarkTheme ? "bg-slate-400/70" : "bg-slate-500/70",
  };
}

export function NoticeProvider({ children }: { children: ReactNode }) {
  const { copy, theme } = useAppSettings();
  const [notices, setNotices] = useState<Notice[]>([]);
  const nextIdRef = useRef(0);
  const timerMapRef = useRef<Record<string, number>>({});

  const clearNoticeTimer = useCallback((id: string) => {
    const timer = timerMapRef.current[id];
    if (typeof timer === "number") {
      window.clearTimeout(timer);
      delete timerMapRef.current[id];
    }
  }, []);

  const dismissNotice = useCallback(
    (id: string) => {
      clearNoticeTimer(id);
      setNotices((prev) => prev.filter((notice) => notice.id !== id));
    },
    [clearNoticeTimer]
  );

  const showNotice = useCallback(
    (message: string, options?: NoticeOptions) => {
      const trimmed = message.trim();
      if (!trimmed) return null;

      const variant = options?.variant ?? "info";
      const id = `notice-${++nextIdRef.current}`;
      const notice: Notice = { id, message: trimmed, variant };

      setNotices((prev) => {
        const next = [notice, ...prev];
        if (next.length <= MAX_VISIBLE_NOTICES) return next;

        const dropped = next.pop();
        if (dropped) clearNoticeTimer(dropped.id);
        return next;
      });

      const durationMs = options?.durationMs ?? DEFAULT_DURATION_BY_VARIANT[variant];
      timerMapRef.current[id] = window.setTimeout(() => {
        dismissNotice(id);
      }, durationMs);

      return id;
    },
    [clearNoticeTimer, dismissNotice]
  );

  const showInfo = useCallback(
    (message: string, options?: Omit<NoticeOptions, "variant">) =>
      showNotice(message, { ...options, variant: "info" }),
    [showNotice]
  );

  const showSuccess = useCallback(
    (message: string, options?: Omit<NoticeOptions, "variant">) =>
      showNotice(message, { ...options, variant: "success" }),
    [showNotice]
  );

  const showWarning = useCallback(
    (message: string, options?: Omit<NoticeOptions, "variant">) =>
      showNotice(message, { ...options, variant: "warning" }),
    [showNotice]
  );

  const showError = useCallback(
    (message: string, options?: Omit<NoticeOptions, "variant">) =>
      showNotice(message, { ...options, variant: "error" }),
    [showNotice]
  );

  useEffect(() => {
    return () => {
      for (const timer of Object.values(timerMapRef.current)) {
        window.clearTimeout(timer);
      }
      timerMapRef.current = {};
    };
  }, []);

  const value = useMemo<NoticeContextValue>(
    () => ({
      dismissNotice,
      showError,
      showInfo,
      showNotice,
      showSuccess,
      showWarning,
    }),
    [dismissNotice, showError, showInfo, showNotice, showSuccess, showWarning]
  );

  return (
    <NoticeContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed inset-x-0 top-20 z-[70] flex justify-center px-4 sm:top-24 sm:justify-end">
        <div className="flex w-full max-w-sm flex-col gap-3">
          {notices.map((notice) => {
            const tone = getNoticeToneClasses(theme, notice.variant);

            return (
              <div
                key={notice.id}
                aria-live={notice.variant === "error" ? "assertive" : "polite"}
                role={notice.variant === "error" ? "alert" : "status"}
                className={clsx(
                  "pointer-events-auto overflow-hidden rounded-[28px] border shadow-2xl backdrop-blur-xl",
                  tone.panel
                )}
              >
                <div className="flex items-start gap-3 p-4">
                  <div
                    className={clsx(
                      "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                      tone.iconWrap
                    )}
                  >
                    <i className={clsx("fa-solid text-base", NOTICE_ICONS[notice.variant], tone.icon)} />
                  </div>

                  <p className="flex-1 pt-0.5 text-sm leading-6">{notice.message}</p>

                  <button
                    type="button"
                    aria-label={copy.common.close}
                    onClick={() => dismissNotice(notice.id)}
                    className={clsx(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition",
                      theme === "dark"
                        ? "text-slate-400 hover:bg-white/10 hover:text-slate-100"
                        : "text-slate-500 hover:bg-slate-900/5 hover:text-slate-900"
                    )}
                  >
                    <i className="fa-solid fa-xmark" aria-hidden="true" />
                  </button>
                </div>

                <div className={clsx("h-1 w-full", tone.rail)} />
              </div>
            );
          })}
        </div>
      </div>
    </NoticeContext.Provider>
  );
}

export function useNotice() {
  const context = useContext(NoticeContext);
  if (!context) {
    throw new Error("useNotice must be used within NoticeProvider");
  }
  return context;
}
