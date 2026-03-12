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

type NoticeOptions = {
  dismissLabel?: string;
  durationMs?: number;
  variant?: NoticeVariant;
};

type ConfirmOptions = {
  cancelLabel?: string;
  confirmLabel?: string;
  variant?: NoticeVariant;
};

type NoticeDialog = {
  id: string;
  kind: "notice";
  message: string;
  variant: NoticeVariant;
  durationMs?: number;
  dismissLabel?: string;
};

type ConfirmDialog = {
  id: string;
  kind: "confirm";
  message: string;
  variant: NoticeVariant;
  cancelLabel: string;
  confirmLabel: string;
};

type Dialog = NoticeDialog | ConfirmDialog;

type NoticeContextValue = {
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  dismissNotice: (id: string) => void;
  showError: (message: string, options?: Omit<NoticeOptions, "variant">) => string | null;
  showInfo: (message: string, options?: Omit<NoticeOptions, "variant">) => string | null;
  showNotice: (message: string, options?: NoticeOptions) => string | null;
  showSuccess: (message: string, options?: Omit<NoticeOptions, "variant">) => string | null;
  showWarning: (message: string, options?: Omit<NoticeOptions, "variant">) => string | null;
};

const NoticeContext = createContext<NoticeContextValue | null>(null);

const DEFAULT_DURATION_BY_VARIANT: Record<NoticeVariant, number> = {
  info: 3200,
  success: 2600,
  warning: 4500,
  error: 5200,
};

const NOTICE_ICONS: Record<NoticeVariant, string> = {
  info: "fa-circle-info",
  success: "fa-circle-check",
  warning: "fa-triangle-exclamation",
  error: "fa-circle-exclamation",
};

function getDialogToneClasses(theme: "light" | "dark", variant: NoticeVariant) {
  const isDarkTheme = theme === "dark";

  if (variant === "success") {
    return {
      accent: isDarkTheme ? "border-emerald-400/35" : "border-emerald-200/80",
      iconWrap: isDarkTheme ? "bg-emerald-400/12" : "bg-emerald-50",
      icon: isDarkTheme ? "text-emerald-200" : "text-emerald-700",
    };
  }

  if (variant === "warning") {
    return {
      accent: isDarkTheme ? "border-amber-300/35" : "border-amber-200/80",
      iconWrap: isDarkTheme ? "bg-amber-300/12" : "bg-amber-50",
      icon: isDarkTheme ? "text-amber-200" : "text-amber-700",
    };
  }

  if (variant === "error") {
    return {
      accent: isDarkTheme ? "border-red-400/35" : "border-red-200/80",
      iconWrap: isDarkTheme ? "bg-red-400/12" : "bg-red-50",
      icon: isDarkTheme ? "text-red-200" : "text-red-700",
    };
  }

  return {
    accent: isDarkTheme ? "border-slate-700/80" : "border-slate-200/80",
    iconWrap: isDarkTheme ? "bg-slate-800/90" : "bg-slate-100",
    icon: isDarkTheme ? "text-slate-200" : "text-slate-700",
  };
}

function getPrimaryActionClasses(theme: "light" | "dark", variant: NoticeVariant) {
  if (variant === "error") {
    return theme === "dark"
      ? "bg-red-400 text-slate-950 hover:bg-red-300"
      : "bg-red-600 text-white hover:bg-red-700";
  }

  if (variant === "success") {
    return theme === "dark"
      ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
      : "bg-emerald-600 text-white hover:bg-emerald-700";
  }

  return theme === "dark"
    ? "bg-slate-100 text-slate-950 hover:bg-white"
    : "bg-slate-900 text-white hover:opacity-92";
}

function getSecondaryActionClasses(theme: "light" | "dark") {
  return theme === "dark"
    ? "border-slate-700 bg-slate-900/70 text-slate-100 hover:bg-slate-800"
    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100";
}

export function NoticeProvider({ children }: { children: ReactNode }) {
  const { copy, theme } = useAppSettings();
  const [dialogs, setDialogs] = useState<Dialog[]>([]);
  const nextIdRef = useRef(0);
  const confirmResolverMapRef = useRef<Record<string, (value: boolean) => void>>({});
  const actionButtonRef = useRef<HTMLButtonElement | null>(null);

  const activeDialog = dialogs[0] ?? null;
  const activeTone = activeDialog ? getDialogToneClasses(theme, activeDialog.variant) : null;

  const settleConfirm = useCallback((id: string, value: boolean) => {
    const resolver = confirmResolverMapRef.current[id];
    if (resolver) {
      resolver(value);
      delete confirmResolverMapRef.current[id];
    }
  }, []);

  const dismissNotice = useCallback(
    (id: string) => {
      settleConfirm(id, false);
      setDialogs((prev) => prev.filter((dialog) => dialog.id !== id));
    },
    [settleConfirm]
  );

  const confirmNotice = useCallback(
    (id: string) => {
      settleConfirm(id, true);
      setDialogs((prev) => prev.filter((dialog) => dialog.id !== id));
    },
    [settleConfirm]
  );

  const showNotice = useCallback((message: string, options?: NoticeOptions) => {
    const trimmed = message.trim();
    if (!trimmed) return null;

    const id = `notice-${++nextIdRef.current}`;
    const nextDialog: NoticeDialog = {
      id,
      kind: "notice",
      message: trimmed,
      variant: options?.variant ?? "info",
      durationMs: options?.durationMs,
      dismissLabel: options?.dismissLabel,
    };

    setDialogs((prev) => [...prev, nextDialog]);
    return id;
  }, []);

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

  const confirm = useCallback(
    (message: string, options?: ConfirmOptions) => {
      const trimmed = message.trim();
      if (!trimmed) return Promise.resolve(false);

      const id = `confirm-${++nextIdRef.current}`;
      const nextDialog: ConfirmDialog = {
        id,
        kind: "confirm",
        message: trimmed,
        variant: options?.variant ?? "warning",
        confirmLabel: options?.confirmLabel ?? copy.common.done,
        cancelLabel: options?.cancelLabel ?? copy.common.cancel,
      };

      setDialogs((prev) => [...prev, nextDialog]);

      return new Promise<boolean>((resolve) => {
        confirmResolverMapRef.current[id] = resolve;
      });
    },
    [copy.common.cancel, copy.common.done]
  );

  useEffect(() => {
    if (!activeDialog) return;

    const durationMs =
      activeDialog.kind === "notice"
        ? activeDialog.durationMs ?? DEFAULT_DURATION_BY_VARIANT[activeDialog.variant]
        : null;

    if (durationMs === null || durationMs <= 0) return;

    const timer = window.setTimeout(() => {
      dismissNotice(activeDialog.id);
    }, durationMs);

    return () => window.clearTimeout(timer);
  }, [activeDialog, dismissNotice]);

  useEffect(() => {
    if (!activeDialog) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        dismissNotice(activeDialog.id);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeDialog, dismissNotice]);

  useEffect(() => {
    if (!activeDialog) return;

    const frame = window.requestAnimationFrame(() => {
      actionButtonRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeDialog]);

  useEffect(() => {
    if (!activeDialog) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [activeDialog]);

  useEffect(() => {
    return () => {
      for (const resolver of Object.values(confirmResolverMapRef.current)) {
        resolver(false);
      }
      confirmResolverMapRef.current = {};
    };
  }, []);

  const value = useMemo<NoticeContextValue>(
    () => ({
      confirm,
      dismissNotice,
      showError,
      showInfo,
      showNotice,
      showSuccess,
      showWarning,
    }),
    [confirm, dismissNotice, showError, showInfo, showNotice, showSuccess, showWarning]
  );

  return (
    <NoticeContext.Provider value={value}>
      {children}

      {activeDialog ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
          <div
            aria-hidden="true"
            onClick={() => dismissNotice(activeDialog.id)}
            className={clsx(
              "absolute inset-0 transition-opacity duration-200",
              theme === "dark" ? "bg-slate-950/90 backdrop-blur-[4px]" : "bg-slate-200/90 backdrop-blur-[3px]"
            )}
          />

          <div
            aria-live={
              activeDialog.kind === "confirm"
                ? undefined
                : activeDialog.variant === "error"
                  ? "assertive"
                  : "polite"
            }
            aria-modal="true"
            role={
              activeDialog.kind === "confirm"
                ? "alertdialog"
                : activeDialog.variant === "error"
                  ? "alert"
                  : "dialog"
            }
            className={clsx(
              "relative w-full max-w-md overflow-hidden rounded-[30px] border shadow-[0_32px_90px_-32px_rgba(15,23,42,0.45)]",
              theme === "dark" ? "bg-slate-950/96 text-slate-50" : "bg-white/96 text-slate-900",
              activeTone?.accent
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div
                  className={clsx(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                    activeTone?.iconWrap
                  )}
                >
                  <i
                    className={clsx(
                      "fa-solid text-base",
                      NOTICE_ICONS[activeDialog.variant],
                      activeTone?.icon
                    )}
                    aria-hidden="true"
                  />
                </div>

                <div className="min-w-0 flex-1 pt-0.5">
                  <p
                    className={clsx(
                      "text-[15px] leading-7 sm:text-base",
                      theme === "dark" ? "text-slate-100" : "text-slate-800"
                    )}
                  >
                    {activeDialog.message}
                  </p>
                </div>

                <button
                  type="button"
                  aria-label={copy.common.close}
                  onClick={() => dismissNotice(activeDialog.id)}
                  className={clsx(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition",
                    theme === "dark"
                      ? "text-slate-400 hover:bg-white/10 hover:text-slate-100"
                      : "text-slate-500 hover:bg-slate-900/5 hover:text-slate-900"
                  )}
                >
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {activeDialog.kind === "confirm" ? (
                  <>
                    <button
                      ref={actionButtonRef}
                      type="button"
                      onClick={() => dismissNotice(activeDialog.id)}
                      className={clsx(
                        "rounded-2xl border px-4 py-2.5 text-sm font-semibold transition",
                        getSecondaryActionClasses(theme)
                      )}
                    >
                      {activeDialog.cancelLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmNotice(activeDialog.id)}
                      className={clsx(
                        "rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
                        getPrimaryActionClasses(theme, activeDialog.variant)
                      )}
                    >
                      {activeDialog.confirmLabel}
                    </button>
                  </>
                ) : (
                  <button
                    ref={actionButtonRef}
                    type="button"
                    onClick={() => dismissNotice(activeDialog.id)}
                    className={clsx(
                      "rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
                      getPrimaryActionClasses(theme, activeDialog.variant)
                    )}
                  >
                    {activeDialog.dismissLabel ?? copy.common.close}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
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
