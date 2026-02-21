import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/Card";
import type { SessionUser } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";

type Product = {
  id: string;
  name: string;
  price_cents: number;
  image_url: string | null;
  category: string | null;
};

type List = {
  id: string;
  name: string;
  created_at: string;
};

export function Shop({ user }: { user: SessionUser }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [listName, setListName] = useState("My List");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("products").select("*").order("name").then(({ data }) => setProducts((data ?? []) as any));
  }, []);

  async function loadLists() {
    const { data } = await supabase
      .from("shopping_lists")
      .select("id,name,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setLists((data ?? []) as any);
  }

  useEffect(() => {
    loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const money = useMemo(
    () => (cents: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100),
    []
  );

  async function createList() {
    setBusy(true);
    const { error } = await supabase.from("shopping_lists").insert({ user_id: user.id, name: listName });
    setBusy(false);
    if (!error) loadLists();
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Shop</h1>
              <p className="text-sm text-slate-600">Public products list (seed it in Supabase).</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="aspect-[4/3] w-full rounded-2xl bg-slate-100">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-full w-full rounded-2xl object-cover" />
                  ) : null}
                </div>
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.category ?? "Uncategorized"}</div>
                  </div>
                  <div className="text-sm font-semibold">{money(p.price_cents)}</div>
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  Hook this up to “Add to list” once your Figma cart/list flow is wired.
                </div>
              </Card>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <Card className="p-5">
            <div className="text-sm font-semibold">Your lists</div>
            <div className="mt-3 flex gap-2">
              <input
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                className="w-full rounded-2xl border px-3 py-2 text-sm"
                placeholder="List name"
              />
              <button
                disabled={busy}
                onClick={createList}
                className="rounded-2xl bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
              >
                Add
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {lists.length === 0 ? (
                <div className="text-sm text-slate-600">No lists yet.</div>
              ) : (
                lists.map((l) => (
                  <Link
                    key={l.id}
                    to={`/lists/${l.id}`}
                    className="block rounded-2xl border px-3 py-3 text-sm hover:bg-slate-50"
                  >
                    <div className="font-medium">{l.name}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(l.created_at).toLocaleString()}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-semibold">Figma mapping checklist</div>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
              <li>Export colors/typography → Tailwind theme.</li>
              <li>Rebuild key components (buttons, cards, nav).</li>
              <li>Match spacing + corner radius tokens.</li>
              <li>Replace dummy Shop + Lists screens.</li>
            </ol>
          </Card>
        </aside>
      </div>
    </main>
  );
}
