import clsx from "clsx";
import { Link } from "react-router-dom";
import { Card } from "../components/Card";
import { useAppSettings } from "../lib/app-settings";
import type { SessionUser } from "../lib/auth";

export function Home({ user }: { user: SessionUser | null }) {
  const { copy, theme } = useAppSettings();
  const home = copy.home;
  const isDark = theme === "dark";
  const palette = {
    section: isDark
      ? "border-slate-800/80 bg-gradient-to-br from-slate-950/95 via-slate-900/92 to-slate-800/88 shadow-[0_32px_90px_-48px_rgba(2,6,23,0.9)]"
      : "border-white/70 bg-gradient-to-br from-white/95 via-sky-50/92 to-orange-50/90 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.28)]",
    glowA: isDark ? "bg-cyan-400/14" : "bg-sky-200/55",
    glowB: isDark ? "bg-amber-300/10" : "bg-orange-200/45",
    badge: isDark
      ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-100"
      : "border-white/70 bg-white/80 text-slate-700",
    title: isDark ? "text-slate-50" : "text-slate-950",
    body: isDark ? "text-slate-300" : "text-slate-600",
    primaryCta: isDark
      ? "bg-gradient-to-r from-cyan-300 to-sky-200 text-slate-950 shadow-[0_18px_32px_-20px_rgba(34,211,238,0.75)] hover:from-cyan-200 hover:to-sky-100"
      : "bg-slate-950 text-white hover:opacity-95",
    secondaryCta: isDark
      ? "border-slate-700 bg-slate-950/65 text-slate-100 hover:bg-slate-900"
      : "border-slate-200/80 bg-white/85 text-slate-800 hover:bg-white",
    statCard: isDark
      ? "border-slate-800/80 bg-slate-950/52"
      : "border-white/75 bg-white/76",
    statTitle: isDark ? "text-slate-100" : "text-slate-900",
    statBody: isDark ? "text-slate-400" : "text-slate-600",
    flowCard: isDark
      ? "border-slate-800/80 bg-slate-950/72 text-slate-100 shadow-[0_28px_70px_-42px_rgba(2,6,23,0.85)]"
      : "border-white/65 bg-white/78 text-slate-900 shadow-[0_24px_60px_-38px_rgba(15,23,42,0.22)]",
    flowTitle: isDark ? "text-slate-100" : "text-slate-900",
    flowBody: isDark ? "text-slate-400" : "text-slate-600",
    livePill: isDark
      ? "bg-gradient-to-r from-amber-300 to-orange-200 text-slate-950"
      : "bg-slate-950 text-white",
    stepCard: isDark
      ? "border-slate-800 bg-slate-900/68"
      : "border-white/75 bg-white/86",
    stepBubble: isDark
      ? "bg-gradient-to-br from-amber-300 to-orange-200 text-slate-950"
      : "bg-gradient-to-br from-slate-900 to-slate-700 text-white",
    stepTitle: isDark ? "text-slate-100" : "text-slate-900",
    stepBody: isDark ? "text-slate-400" : "text-slate-600",
    miniCard: isDark
      ? "border-slate-800 bg-slate-950/46"
      : "border-slate-200/80 bg-white/74",
    miniTitle: isDark ? "text-slate-100" : "text-slate-900",
    miniBody: isDark ? "text-slate-400" : "text-slate-500",
    quickTitle: isDark ? "text-slate-100" : "text-slate-900",
    quickBody: isDark ? "text-slate-400" : "text-slate-600",
  };
  const statItems = [
    { title: home.statFastTitle, description: home.statFastDesc },
    { title: home.statSimpleTitle, description: home.statSimpleDesc },
    { title: home.statSocialTitle, description: home.statSocialDesc },
  ];
  const flowSteps = [
    { title: home.step1Title, description: home.step1Desc },
    { title: home.step2Title, description: home.step2Desc },
    { title: home.step3Title, description: home.step3Desc },
  ];
  const quickLinks = [
    {
      to: user ? "/shop" : "/auth",
      title: home.card1Title,
      description: home.card1Desc,
      icon: "fa-solid fa-store",
      cardClass: isDark
        ? "border-amber-400/15 bg-gradient-to-br from-amber-400/10 via-slate-950/88 to-slate-950/72 shadow-[0_22px_60px_-40px_rgba(245,158,11,0.3)] group-hover:border-amber-300/35"
        : "border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-orange-50 shadow-[0_20px_48px_-34px_rgba(245,158,11,0.28)] group-hover:border-amber-300",
      iconClass: isDark
        ? "bg-gradient-to-br from-amber-300 to-orange-200 text-slate-950"
        : "bg-gradient-to-br from-amber-400 to-orange-300 text-slate-950",
      arrowClass: isDark
        ? "text-amber-200/60 group-hover:text-amber-100"
        : "text-amber-500/70 group-hover:text-amber-700",
    },
    {
      to: user ? "/community" : "/auth",
      title: home.card2Title,
      description: home.card2Desc,
      icon: "fa-solid fa-users",
      cardClass: isDark
        ? "border-cyan-400/15 bg-gradient-to-br from-cyan-400/10 via-slate-950/88 to-slate-950/72 shadow-[0_22px_60px_-40px_rgba(34,211,238,0.26)] group-hover:border-cyan-300/35"
        : "border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-cyan-50 shadow-[0_20px_48px_-34px_rgba(14,165,233,0.24)] group-hover:border-sky-300",
      iconClass: isDark
        ? "bg-gradient-to-br from-cyan-300 to-sky-200 text-slate-950"
        : "bg-gradient-to-br from-sky-400 to-cyan-300 text-slate-950",
      arrowClass: isDark
        ? "text-cyan-200/60 group-hover:text-cyan-100"
        : "text-sky-500/70 group-hover:text-sky-700",
    },
    {
      to: user ? "/chat" : "/auth",
      title: home.card3Title,
      description: home.card3Desc,
      icon: "fa-solid fa-comments",
      cardClass: isDark
        ? "border-emerald-400/15 bg-gradient-to-br from-emerald-400/10 via-slate-950/88 to-slate-950/72 shadow-[0_22px_60px_-40px_rgba(16,185,129,0.24)] group-hover:border-emerald-300/35"
        : "border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-teal-50 shadow-[0_20px_48px_-34px_rgba(16,185,129,0.24)] group-hover:border-emerald-300",
      iconClass: isDark
        ? "bg-gradient-to-br from-emerald-300 to-teal-200 text-slate-950"
        : "bg-gradient-to-br from-emerald-400 to-teal-300 text-slate-950",
      arrowClass: isDark
        ? "text-emerald-200/60 group-hover:text-emerald-100"
        : "text-emerald-500/70 group-hover:text-emerald-700",
    },
    {
      to: "/aboutus",
      title: home.aboutBadge,
      description: home.aboutIntro,
      icon: "fa-solid fa-circle-info",
      cardClass: isDark
        ? "border-rose-400/15 bg-gradient-to-br from-rose-400/10 via-slate-950/88 to-slate-950/72 shadow-[0_22px_60px_-40px_rgba(244,63,94,0.24)] group-hover:border-rose-300/35"
        : "border-rose-200/80 bg-gradient-to-br from-rose-50 via-white to-orange-50 shadow-[0_20px_48px_-34px_rgba(244,63,94,0.2)] group-hover:border-rose-300",
      iconClass: isDark
        ? "bg-gradient-to-br from-rose-300 to-orange-200 text-slate-950"
        : "bg-gradient-to-br from-rose-400 to-orange-300 text-slate-950",
      arrowClass: isDark
        ? "text-rose-200/60 group-hover:text-rose-100"
        : "text-rose-500/70 group-hover:text-rose-700",
    },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
      <section
        className={clsx(
          "relative overflow-hidden rounded-[32px] border px-6 py-10 shadow-sm md:px-10 md:py-14",
          palette.section
        )}
      >
        <div className="pointer-events-none absolute inset-0">
          <div
            className={clsx(
              "absolute -right-10 -top-16 h-56 w-56 rounded-full blur-3xl",
              palette.glowA
            )}
          />
          <div
            className={clsx(
              "absolute -bottom-20 -left-10 h-56 w-56 rounded-full blur-3xl",
              palette.glowB
            )}
          />
        </div>

        <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className={clsx("inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium shadow-sm", palette.badge)}>
              {home.heroBadge}
            </div>

            <h1 className={clsx("mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl", palette.title)}>
              {home.heroTitle}
            </h1>

            <p className={clsx("mt-4 max-w-2xl text-base leading-7 md:text-lg", palette.body)}>
              {home.heroDescription}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={user ? "/shop" : "/auth"}
                className={clsx("rounded-2xl px-5 py-3 text-sm font-medium shadow-sm transition hover:-translate-y-0.5", palette.primaryCta)}
              >
                {user ? home.startShopping : home.signInToStart}
              </Link>

              <Link
                to={user ? "/community" : "/auth"}
                className={clsx("rounded-2xl border px-5 py-3 text-sm font-medium transition", palette.secondaryCta)}
              >
                {home.exploreCommunity}
              </Link>
            </div>

            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              {statItems.map((item) => (
                <div
                  key={item.title}
                  className={clsx("rounded-2xl border px-4 py-3 shadow-sm backdrop-blur", palette.statCard)}
                >
                  <div className={clsx("text-lg font-semibold", palette.statTitle)}>{item.title}</div>
                  <div className={clsx("mt-1 text-sm", palette.statBody)}>{item.description}</div>
                </div>
              ))}
            </div>
          </div>

          <Card className={clsx("rounded-[28px] p-6 shadow-xl backdrop-blur", palette.flowCard)}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className={clsx("text-sm font-semibold", palette.flowTitle)}>{home.flowTitle}</div>
                <p className={clsx("mt-1 max-w-sm text-sm leading-6", palette.flowBody)}>
                  {home.flowDescription}
                </p>
              </div>
              <div className={clsx("rounded-full px-3 py-1 text-xs font-semibold shadow-sm", palette.livePill)}>{home.live}</div>
            </div>

            <div className="mt-6 space-y-3">
              {flowSteps.map((step, index) => (
                <div key={step.title} className={clsx("flex items-start gap-3 rounded-2xl border p-4", palette.stepCard)}>
                  <div className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold shadow-sm", palette.stepBubble)}>
                    {index + 1}
                  </div>
                  <div>
                    <div className={clsx("text-sm font-semibold", palette.stepTitle)}>{step.title}</div>
                    <p className={clsx("mt-1 text-sm leading-6", palette.stepBody)}>{step.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className={clsx("rounded-2xl border p-3 text-center", palette.miniCard)}>
                <div className={clsx("text-lg font-semibold", palette.miniTitle)}>{home.cartsTitle}</div>
                <div className={clsx("mt-1 text-xs", palette.miniBody)}>{home.cartsDesc}</div>
              </div>
              <div className={clsx("rounded-2xl border p-3 text-center", palette.miniCard)}>
                <div className={clsx("text-lg font-semibold", palette.miniTitle)}>{home.shopTitle}</div>
                <div className={clsx("mt-1 text-xs", palette.miniBody)}>{home.shopDesc}</div>
              </div>
              <div className={clsx("rounded-2xl border p-3 text-center", palette.miniCard)}>
                <div className={clsx("text-lg font-semibold", palette.miniTitle)}>{home.postsTitle}</div>
                <div className={clsx("mt-1 text-xs", palette.miniBody)}>{home.postsDesc}</div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {quickLinks.map((item) => (
          <Link key={item.title} to={item.to} className="group block h-full">
            <Card className={clsx("h-full p-5 transition duration-300 group-hover:-translate-y-1", item.cardClass)}>
              <div className="flex items-start justify-between gap-4">
                <div className={clsx("flex h-11 w-11 items-center justify-center rounded-2xl text-sm shadow-sm", item.iconClass)}>
                  <i className={item.icon} aria-hidden="true" />
                </div>
                <div className={clsx("text-sm transition duration-300 group-hover:translate-x-1", item.arrowClass)}>
                  <i className="fa-solid fa-arrow-right" aria-hidden="true" />
                </div>
              </div>

              <div className={clsx("mt-5 text-lg font-semibold", palette.quickTitle)}>{item.title}</div>
              <p className={clsx("mt-2 text-sm leading-6", palette.quickBody)}>{item.description}</p>
            </Card>
          </Link>
        ))}
      </section>
    </main>
  );
}
