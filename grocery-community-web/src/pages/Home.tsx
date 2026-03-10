import { Link } from "react-router-dom";
import { Card } from "../components/Card";
import { useAppSettings } from "../lib/app-settings";
import type { SessionUser } from "../lib/auth";

export function Home({ user }: { user: SessionUser | null }) {
  const { copy } = useAppSettings();
  const home = copy.home;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 px-6 py-10 shadow-sm md:px-10 md:py-14">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-slate-200/50 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-slate-300/30 blur-3xl" />
        </div>

        <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
              {home.heroBadge}
            </div>

            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-5xl">
              {home.heroTitle}
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
              {home.heroDescription}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={user ? "/shop" : "/auth"}
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:opacity-95"
              >
                {user ? home.startShopping : home.signInToStart}
              </Link>

              <Link
                to={user ? "/community" : "/auth"}
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
              >
                {home.exploreCommunity}
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-6 text-sm text-slate-600">
              <div>
                <div className="text-xl font-semibold text-slate-900">{home.statFastTitle}</div>
                <div>{home.statFastDesc}</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-slate-900">{home.statSimpleTitle}</div>
                <div>{home.statSimpleDesc}</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-slate-900">{home.statSocialTitle}</div>
                <div>{home.statSocialDesc}</div>
              </div>
            </div>
          </div>

          <Card className="rounded-[28px] border-white/60 bg-white/90 p-6 shadow-xl shadow-slate-200/50 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">{home.flowTitle}</div>
                <p className="mt-1 text-sm text-slate-600">{home.flowDescription}</p>
              </div>
              <div className="rounded-2xl bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                {home.live}
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-900">{home.step1Title}</div>
                <p className="mt-1 text-sm text-slate-600">{home.step1Desc}</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-900">{home.step2Title}</div>
                <p className="mt-1 text-sm text-slate-600">{home.step2Desc}</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-900">{home.step3Title}</div>
                <p className="mt-1 text-sm text-slate-600">{home.step3Desc}</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-200 p-3 text-center">
                <div className="text-lg font-semibold text-slate-900">{home.listsTitle}</div>
                <div className="mt-1 text-xs text-slate-500">{home.listsDesc}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-3 text-center">
                <div className="text-lg font-semibold text-slate-900">{home.shopTitle}</div>
                <div className="mt-1 text-xs text-slate-500">{home.shopDesc}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-3 text-center">
                <div className="text-lg font-semibold text-slate-900">{home.postsTitle}</div>
                <div className="mt-1 text-xs text-slate-500">{home.postsDesc}</div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="mt-8 grid gap-6 md:grid-cols-3">
        <Card className="p-6">
          <div className="text-sm font-semibold text-slate-900">{home.card1Title}</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{home.card1Desc}</p>
        </Card>

        <Card className="p-6">
          <div className="text-sm font-semibold text-slate-900">{home.card2Title}</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{home.card2Desc}</p>
        </Card>

        <Card className="p-6">
          <div className="text-sm font-semibold text-slate-900">{home.card3Title}</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{home.card3Desc}</p>
        </Card>
      </section>
    </main>
  );
}
