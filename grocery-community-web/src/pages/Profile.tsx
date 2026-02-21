import type { SessionUser } from "../lib/auth";
import { Card } from "../components/Card";

export function Profile({ user }: { user: SessionUser }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <Card className="mt-5 p-5">
        <div className="text-sm font-semibold">Signed in as</div>
        <div className="mt-2 text-sm text-slate-700">{user.email ?? user.id}</div>

        <div className="mt-6 text-sm font-semibold">Next steps</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Bind your Figma Profile screen here.</li>
          <li>Use a <code className="rounded bg-slate-100 px-1">profiles</code> table if you need avatars/usernames.</li>
        </ul>
      </Card>
    </main>
  );
}
