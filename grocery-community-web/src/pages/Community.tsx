import { useEffect, useState } from "react";
import { Card } from "../components/Card";
import { useAppSettings } from "../lib/app-settings";
import type { SessionUser } from "../lib/auth";
import { supabase } from "../lib/supabase";

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

  const { copy, formatDateTime } = useAppSettings();
  const community = copy.community;
  const common = copy.common;

  async function load() {
    const { data } = await supabase.from("posts").select("*").order("created_at", { ascending: false });
    setPosts((data ?? []) as Post[]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createPost() {
    setBusy(true);
    const { error } = await supabase.from("posts").insert({ user_id: user.id, title, body });
    setBusy(false);
    if (!error) {
      setTitle("");
      setBody("");
      await load();
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{community.title}</h1>
          <p className="text-sm text-slate-600">{community.subtitle}</p>
        </div>
      </div>

      <Card className="mt-5 p-5">
        <div className="text-sm font-semibold">{community.createPost}</div>
        <div className="mt-3 grid gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-2xl border px-3 py-2 text-sm"
            placeholder={community.titlePlaceholder}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-[100px] rounded-2xl border px-3 py-2 text-sm"
            placeholder={community.bodyPlaceholder}
          />
          <button
            disabled={busy || !title.trim()}
            onClick={() => void createPost()}
            className="justify-self-end rounded-2xl bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            {busy ? common.working : community.post}
          </button>
        </div>
      </Card>

      <div className="mt-6 space-y-4">
        {posts.map((post) => (
          <Card key={post.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">{post.title}</div>
                <div className="text-xs text-slate-500">{formatDateTime(post.created_at)}</div>
              </div>
              {post.user_id === user.id ? (
                <span className="rounded-2xl bg-slate-100 px-2 py-1 text-xs">{common.you}</span>
              ) : null}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{post.body}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
