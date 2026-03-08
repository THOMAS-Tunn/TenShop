import { Link } from "react-router-dom";
import { Card } from "../components/Card";
import type { SessionUser } from "../lib/auth";
import siteLogo from "../assets/logo.png";

export function Home({ user }: { user: SessionUser | null }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 px-6 py-10 shadow-sm md:px-10 md:py-14">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-16 -right-10 h-56 w-56 rounded-full bg-slate-200/50 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-slate-300/30 blur-3xl" />
        </div>

        <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
              Smart grocery planning for everyday life
            </div>

            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-5xl">
              Grocery shopping that feels organized, social, and actually useful.
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
              Build shopping lists, browse products, and share ideas with your
              community in one clean experience. Less friction, fewer forgotten
              items, and a better way to plan meals together.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={user ? "/shop" : "/auth"}
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:opacity-95"
              >
                {user ? "Start Shopping" : "Sign in to Start"}
              </Link>

              <Link
                to={user ? "/community" : "/auth"}
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
              >
                Explore Community
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-6 text-sm text-slate-600">
              <div>
                <div className="text-xl font-semibold text-slate-900">Fast</div>
                <div>Quick list building</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-slate-900">Simple</div>
                <div>Clean product browsing</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-slate-900">Social</div>
                <div>Community-driven ideas</div>
              </div>
            </div>
          </div>

          <Card className="rounded-[28px] border-white/60 bg-white/90 p-6 shadow-xl shadow-slate-200/50 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  This week’s flow
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  A better shopping experience from planning to checkout.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                Live
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-900">
                  1. Discover products
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Browse a clean product grid and add items in seconds.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-900">
                  2. Build your list
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Keep your grocery plan organized with personal shopping lists.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-900">
                  3. Learn from community
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Share recipes, tips, and local finds with other shoppers.
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-200 p-3 text-center">
                <div className="text-lg font-semibold text-slate-900">Lists</div>
                <div className="mt-1 text-xs text-slate-500">Stay organized</div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-3 text-center">
                <div className="text-lg font-semibold text-slate-900">Shop</div>
                <div className="mt-1 text-xs text-slate-500">Browse faster</div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-3 text-center">
                <div className="text-lg font-semibold text-slate-900">Posts</div>
                <div className="mt-1 text-xs text-slate-500">Share ideas</div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="mt-8 grid gap-6 md:grid-cols-3">
        <Card className="p-6">
          <div className="text-sm font-semibold text-slate-900">
            Smarter shopping
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Turn scattered grocery notes into a clear list you can actually use.
          </p>
        </Card>

        <Card className="p-6">
          <div className="text-sm font-semibold text-slate-900">
            Community layer
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Discover recipes, recommendations, and ideas from people shopping
            like you.
          </p>
        </Card>

        <Card className="p-6">
          <div className="text-sm font-semibold text-slate-900">
            Ready to grow
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            A strong base for richer branding, categories, promotions, and real
            product storytelling.
          </p>
        </Card>
      </section>
    </main>
  );
}
