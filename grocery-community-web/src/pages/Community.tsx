import { useEffect, useState } from "react";
import type { SessionUser } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { Card } from "../components/Card";

type Post = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  created_at: string;
};

export function Community({ user }: { user: SessionUser }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from("posts").select("*").order("created_at", { ascending: false });
    setPosts((data ?? []) as any);
  }

  useEffect(() => {
    load();
  }, []);

  async function createPost() {
    setBusy(true);
    const { error } = await supabase.from("posts").insert({ user_id: user.id, title, body });
    setBusy(false);
    if (!error) {
      setTitle("");
      setBody("");
      load();
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Community</h1>
          <p className="text-sm text-slate-600">Public posts. Add comments/likes once your Figma flow is wired.</p>
        </div>
      </div>

      <Card className="mt-5 p-5">
        <div className="text-sm font-semibold">Create post</div>
        <div className="mt-3 grid gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-2xl border px-3 py-2 text-sm"
            placeholder="Title"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-[100px] rounded-2xl border px-3 py-2 text-sm"
            placeholder="Share a tip, recipe, or deal…"
          />
          <button
            disabled={busy || !title.trim()}
            onClick={createPost}
            className="justify-self-end rounded-2xl bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            Post
          </button>
        </div>
      </Card>

      <div className="mt-6 space-y-4">
        {posts.map((p) => (
          <Card key={p.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">{p.title}</div>
                <div className="text-xs text-slate-500">{new Date(p.created_at).toLocaleString()}</div>
              </div>
              {p.user_id === user.id ? (
                <span className="rounded-2xl bg-slate-100 px-2 py-1 text-xs">You</span>
              ) : null}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{p.body}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
