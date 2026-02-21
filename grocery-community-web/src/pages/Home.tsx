import { Link } from "react-router-dom";
import { Card } from "../components/Card";
import type { SessionUser } from "../lib/auth";

export function Home({ user }: { user: SessionUser | null }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
            Grocery shopping, with a community layer.
          </h1>
          <p className="mt-3 text-slate-600">
            This is a production-ready starter built for Netlify + Supabase. Swap in your Figma styles and
            components, then deploy.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to={user ? "/shop" : "/auth"}
              className="rounded-2xl bg-slate-900 px-4 py-2 text-white hover:opacity-90"
            >
              {user ? "Go to Shop" : "Sign in"}
            </Link>
            <Link
              to={user ? "/community" : "/auth"}
              className="rounded-2xl border px-4 py-2 hover:bg-slate-50"
            >
              Explore Community
            </Link>
          </div>
        </div>

        <Card className="p-6">
          <div className="text-sm font-semibold">What you get</div>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>• Email/password auth</li>
            <li>• Products grid (public)</li>
            <li>• Personal shopping lists (private)</li>
            <li>• Community posts (public)</li>
            <li>• Netlify-ready SPA routing</li>
          </ul>
          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-xs text-slate-600">
            Tip: Export your Figma design tokens (colors, radius, typography) and map them into Tailwind theme
            settings.
          </div>
        </Card>
      </div>
    </main>
  );
}
