import clsx from "clsx";
import { Link } from "react-router-dom";
import { Card } from "../components/Card";
import { useAppSettings } from "../lib/app-settings";
import type { SessionUser } from "../lib/auth";

export function AboutUs({ user }: { user: SessionUser | null }) {
  const { copy, theme } = useAppSettings();
  const home = copy.home;
  const layout = copy.layout;
  const isDark = theme === "dark";
  const aboutFacts = [
    { title: home.aboutFactStartedTitle, value: home.aboutFactStartedValue },
    { title: home.aboutFactFlexibleTitle, value: home.aboutFactFlexibleValue },
    { title: home.aboutFactFutureTitle, value: home.aboutFactFutureValue },
  ];

  const palette = {
    hero: isDark
      ? "border-slate-800/80 bg-gradient-to-br from-slate-950/95 via-slate-900/92 to-slate-800/88 text-slate-100 shadow-[0_32px_90px_-48px_rgba(2,6,23,0.9)]"
      : "border-white/70 bg-gradient-to-br from-white/96 via-sky-50/92 to-orange-50/88 text-slate-900 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.26)]",
    glowA: isDark ? "bg-cyan-400/14" : "bg-sky-200/60",
    glowB: isDark ? "bg-emerald-400/10" : "bg-orange-200/44",
    badge: isDark
      ? "border-rose-400/20 bg-rose-400/10 text-rose-100"
      : "border-white/80 bg-white/84 text-rose-700",
    title: isDark ? "text-slate-50" : "text-slate-950",
    body: isDark ? "text-slate-300" : "text-slate-600",
    backLink: isDark
      ? "border-slate-700 bg-slate-950/70 text-slate-100 hover:bg-slate-900"
      : "border-slate-200/80 bg-white/85 text-slate-800 hover:bg-white",
    primaryLink: isDark
      ? "bg-gradient-to-r from-cyan-300 to-sky-200 text-slate-950 hover:from-cyan-200 hover:to-sky-100"
      : "bg-slate-950 text-white hover:opacity-95",
    storyCard: isDark
      ? "border-slate-800/80 bg-slate-950/72 text-slate-100 shadow-[0_28px_70px_-42px_rgba(2,6,23,0.85)]"
      : "border-white/70 bg-white/82 text-slate-900 shadow-[0_24px_60px_-38px_rgba(15,23,42,0.18)]",
    subTitle: isDark ? "text-slate-100" : "text-slate-900",
    subBody: isDark ? "text-slate-400" : "text-slate-600",
    factCard: isDark
      ? "border-slate-800 bg-slate-950/55"
      : "border-white/80 bg-white/84",
    factTitle: isDark ? "text-slate-400" : "text-slate-500",
    factValue: isDark ? "text-slate-100" : "text-slate-900",
    contactCard: isDark
      ? "border-emerald-400/15 bg-emerald-400/8"
      : "border-emerald-200/80 bg-white/84",
    contactLink: isDark
      ? "text-emerald-200 hover:text-emerald-100"
      : "text-emerald-700 hover:text-emerald-900",
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
      <section
        className={clsx(
          "relative overflow-hidden rounded-[32px] border px-6 py-10 md:px-10 md:py-14",
          palette.hero
        )}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className={clsx("absolute -right-12 -top-16 h-64 w-64 rounded-full blur-3xl", palette.glowA)} />
          <div className={clsx("absolute -bottom-20 -left-12 h-64 w-64 rounded-full blur-3xl", palette.glowB)} />
        </div>

        <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div
              className={clsx(
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold shadow-sm",
                palette.badge
              )}
            >
              {home.aboutBadge}
            </div>

            <h1 className={clsx("mt-4 max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl", palette.title)}>
              {home.aboutTitle}
            </h1>

            <p className={clsx("mt-4 max-w-3xl text-sm leading-7 md:text-base", palette.body)}>
              {home.aboutIntro}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/" className={clsx("rounded-2xl border px-5 py-3 text-sm font-medium transition", palette.backLink)}>
                {layout.nav.home}
              </Link>
              <Link to="/shop" className={clsx("rounded-2xl px-5 py-3 text-sm font-medium shadow-sm transition", palette.primaryLink)}>
                {user ? home.startShopping : home.signInToStart}
              </Link>
            </div>
          </div>

          <Card className={clsx("rounded-[28px] p-6 backdrop-blur", palette.storyCard)}>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {aboutFacts.map((fact) => (
                <div key={fact.title} className={clsx("rounded-2xl border px-4 py-4", palette.factCard)}>
                  <div className={clsx("text-xs font-semibold uppercase tracking-[0.2em]", palette.factTitle)}>
                    {fact.title}
                  </div>
                  <div className={clsx("mt-2 text-sm font-semibold leading-6", palette.factValue)}>
                    {fact.value}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className={clsx("rounded-[28px] p-6 md:p-7", palette.storyCard)}>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h2 className={clsx("text-sm font-semibold", palette.subTitle)}>{home.aboutStoryTitle}</h2>
              <p className={clsx("mt-3 text-sm leading-7", palette.subBody)}>{home.aboutStoryBody}</p>
            </div>

            <div>
              <h2 className={clsx("text-sm font-semibold", palette.subTitle)}>{home.aboutVisionTitle}</h2>
              <p className={clsx("mt-3 text-sm leading-7", palette.subBody)}>{home.aboutVisionBody}</p>
            </div>
          </div>

          <div className="mt-6">
            <h2 className={clsx("text-sm font-semibold", palette.subTitle)}>{home.aboutCommunityTitle}</h2>
            <p className={clsx("mt-3 text-sm leading-7", palette.subBody)}>{home.aboutCommunityBody}</p>
          </div>
        </Card>

        <Card className={clsx("rounded-[28px] p-6 md:p-7", palette.contactCard)}>
          <h2 className={clsx("text-sm font-semibold", palette.subTitle)}>{home.aboutContactTitle}</h2>

          <div className="mt-5 space-y-4 text-sm">
            <div>
              <div className={clsx("text-xs font-semibold uppercase tracking-[0.2em]", palette.factTitle)}>
                {home.aboutPhoneLabel}
              </div>
              <a
                href="tel:+18326144159"
                className={clsx("mt-1 inline-block font-semibold transition", palette.contactLink)}
              >
                1 832 614 4159
              </a>
            </div>

            <div>
              <div className={clsx("text-xs font-semibold uppercase tracking-[0.2em]", palette.factTitle)}>
                {home.aboutEmailLabel}
              </div>
              <a
                href="mailto:thienthomas369@gmail.com"
                className={clsx("mt-1 inline-block break-all font-semibold transition", palette.contactLink)}
              >
                thienthomas369@gmail.com
              </a>
            </div>
          </div>

          <p className={clsx("mt-5 text-sm leading-7", palette.subBody)}>{home.aboutSupportNote}</p>
        </Card>
      </section>
    </main>
  );
}
