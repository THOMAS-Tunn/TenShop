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
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("products")
      .select("*")
      .order("name")
      .then(({ data, error }) => {
        if (error) console.error(error);
        setProducts((data ?? []) as any);
      });
  }, []);

  async function loadLists() {
    const { data, error } = await supabase
      .from("shopping_lists")
      .select("id,name,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setLists([]);
      return;
    }

    const next = (data ?? []) as any;
    setLists(next);

    // Pick a default list when available
    if (!selectedListId && next.length > 0) {
      setSelectedListId(next[0].id);
    }
  }

  useEffect(() => {
    void loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const money = useMemo(
    () => (cents: number) =>
      new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(
        cents / 100
      ),
    []
  );

  async function createList() {
    setBusy(true);
    const { data, error } = await supabase
      .from("shopping_lists")
      .insert({ user_id: user.id, name: listName })
      .select("id")
      .single();
    setBusy(false);

    if (error) {
      alert(error.message);
      return;
    }

    await loadLists();
    if (data?.id) setSelectedListId(data.id);
  }

  async function addProductToList(p: Product) {
    if (!selectedListId) {
      alert("Create/select a list first (right panel) before adding items.");
      return;
    }

    setAddingId(p.id);

    // If item already exists in this list, increment qty; else insert new.
    const { data: existing, error: readErr } = await supabase
      .from("shopping_list_items")
      .select("id, qty")
      .eq("list_id", selectedListId)
      .eq("user_id", user.id)
      .eq("name", p.name)
      .maybeSingle();

    if (readErr) {
      setAddingId(null);
      alert(readErr.message);
      return;
    }

    if (existing?.id) {
      const { error: updErr } = await supabase
        .from("shopping_list_items")
        .update({ qty: (existing.qty ?? 1) + 1 })
        .eq("id", existing.id);

      setAddingId(null);
      if (updErr) alert(updErr.message);
      return;
    }

    const { error: insErr } = await supabase.from("shopping_list_items").insert({
      list_id: selectedListId,
      user_id: user.id,
      name: p.name,
      qty: 1,
    });

    setAddingId(null);
    if (insErr) alert(insErr.message);
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

                <button
                  disabled={addingId === p.id}
                  onClick={() => addProductToList(p)}
                  className="mt-3 w-full rounded-2xl bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
                >
                  {addingId === p.id ? "Adding…" : "Add to list"}
                </button>

                {selectedListId ? (
                  <div className="mt-2 text-xs text-slate-500">
                    Adds to:{" "}
                    <span className="font-medium">
                      {lists.find((l) => l.id === selectedListId)?.name ?? "Selected list"}
                    </span>
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-slate-500">Create a list to start adding items.</div>
                )}
              </Card>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <Card className="p-5">
            <div className="text-sm font-semibold">Your lists</div>

            <div className="mt-3">
              <div className="text-xs font-medium text-slate-600">Selected list</div>
              <select
                value={selectedListId ?? ""}
                onChange={(e) => setSelectedListId(e.target.value)}
                className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Select a list…
                </option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

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
                    <div className="text-xs text-slate-500">{new Date(l.created_at).toLocaleString()}</div>
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
