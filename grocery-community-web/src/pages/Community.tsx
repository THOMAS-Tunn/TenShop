import { useEffect, useState } from "react";
import { Card } from "../components/Card";
import { useAppSettings } from "../lib/app-settings";
import type { SessionUser } from "../lib/auth";
import { useNotice } from "../lib/notices";
import { supabase } from "../lib/supabase";

type Post = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  created_at: string;
};

type ProfileNameRow = {
  id: string;
  full_name: string | null;
};

const POST_DELETE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function Community({ user }: { user: SessionUser }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [authorNameMap, setAuthorNameMap] = useState<Record<string, string>>({});
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingPostIds, setDeletingPostIds] = useState<string[]>([]);

  const { copy, formatDateTime } = useAppSettings();
  const notice = useNotice();
  const community = copy.community;
  const common = copy.common;

  function getFallbackAuthorName(authorId: string) {
    if (authorId === user.id) {
      const emailName = user.email?.split("@")[0]?.trim();
      return emailName || common.you;
    }
    return common.customerId(authorId);
  }

  function getAuthorName(authorId: string) {
    return authorNameMap[authorId] ?? getFallbackAuthorName(authorId);
  }

  function canDeleteOwnPost(post: Post) {
    if (post.user_id !== user.id) return false;
    return new Date(post.created_at).getTime() + POST_DELETE_WINDOW_MS > Date.now();
  }

  async function load() {
    const { data, error } = await supabase
      .from("posts")
      .select("id, user_id, title, body, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      notice.showError(error.message);
      return;
    }

    const nextPosts = (data ?? []) as Post[];
    setPosts(nextPosts);
    setDeletingPostIds((current) => current.filter((id) => nextPosts.some((post) => post.id === id)));

    const userIds = Array.from(new Set([...nextPosts.map((post) => post.user_id), user.id]));
    if (userIds.length === 0) {
      setAuthorNameMap({});
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    if (profileError) {
      notice.showError(profileError.message);
      setAuthorNameMap({});
      return;
    }

    const nextAuthorMap: Record<string, string> = {};
    for (const profile of (profileData ?? []) as ProfileNameRow[]) {
      if (profile.full_name?.trim()) {
        nextAuthorMap[profile.id] = profile.full_name.trim();
      }
    }
    setAuthorNameMap(nextAuthorMap);
  }

  useEffect(() => {
    void load();

    const channel = supabase
      .channel("community-posts-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => {
        void load();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function createPost() {
    const nextTitle = title.trim();
    const nextBody = body.trim();

    if (!nextTitle) return;

    setBusy(true);
    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      title: nextTitle,
      body: nextBody,
    });
    setBusy(false);

    if (error) {
      notice.showError(error.message);
      return;
    }

    setTitle("");
    setBody("");
    notice.showSuccess(community.postCreated);
    await load();
  }

  async function deletePost(post: Post) {
    if (post.user_id !== user.id) {
      notice.showWarning(community.deletePostNotAllowed);
      return;
    }

    if (!canDeleteOwnPost(post)) {
      notice.showWarning(community.deleteWindowClosed);
      return;
    }

    const ok = await notice.confirm(community.confirmDeletePost(post.title), {
      cancelLabel: common.cancel,
      confirmLabel: common.delete,
      variant: "error",
    });
    if (!ok) return;

    const previousPosts = posts;
    setDeletingPostIds((current) => Array.from(new Set([...current, post.id])));
    setPosts((current) => current.filter((entry) => entry.id !== post.id));

    const { data: deletedRows, error } = await supabase
      .from("posts")
      .delete()
      .eq("id", post.id)
      .eq("user_id", user.id)
      .select("id");

    setDeletingPostIds((current) => current.filter((id) => id !== post.id));

    if (error) {
      setPosts(previousPosts);
      notice.showError(error.message);
      return;
    }

    if ((deletedRows ?? []).length !== 1) {
      setPosts(previousPosts);
      notice.showWarning(community.deleteWindowClosed);
      await load();
      return;
    }

    notice.showSuccess(community.postDeleted);
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
        {posts.map((post) => {
          const isOwnPost = post.user_id === user.id;
          const canDelete = canDeleteOwnPost(post);
          const isDeleting = deletingPostIds.includes(post.id);

          return (
            <Card key={post.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold">{post.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{getAuthorName(post.user_id)}</span>
                    <span className="text-slate-300">|</span>
                    <span>{formatDateTime(post.created_at)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {isOwnPost ? (
                    <span className="rounded-2xl bg-slate-100 px-2 py-1 text-xs">{common.you}</span>
                  ) : null}
                  {canDelete ? (
                    <button
                      type="button"
                      onClick={() => void deletePost(post)}
                      disabled={isDeleting}
                      className="rounded-2xl border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                    >
                      {isDeleting ? common.deleting : common.delete}
                    </button>
                  ) : null}
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{post.body}</p>
              {isOwnPost ? (
                <div className="mt-3 text-xs text-slate-500">
                  {canDelete ? community.deleteOwnPostHint : community.deleteWindowClosed}
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </main>
  );
}
