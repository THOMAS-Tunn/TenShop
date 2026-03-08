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
  description: string | null;
  properties: string[] | null;
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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    supabase
      .from("products")
      .select("*")
      .order("name")
      .then(({ data, error }) => {
        if (error) console.error(error);
        setProducts((data ?? []) as Product[]);
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

    const next = (data ?? []) as List[];
    setLists(next);

    if (!selectedListId && next.length > 0) {
      setSelectedListId(next[0].id);
    }
  }

  useEffect(() => {
    void loadLists();
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
      product_id: p.id,
      name: p.name,
      price_cents: p.price_cents,
      qty: 1,
    });

    setAddingId(null);
    if (insErr) alert(insErr.message);
  }

  return (
    <>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold">Shop</h1>
                <p className="text-sm text-slate-600">Click any item to view full details.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <Card
                  key={p.id}
                  className="cursor-pointer p-4 transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(p)}
                    className="w-full text-left"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-slate-100">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="h-full w-full rounded-2xl object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-slate-400">
                          No image
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{p.name}</div>
                        <div className="text-xs text-slate-500">{p.category ?? "Item details"}</div>
                      </div>
                      <div className="text-sm font-semibold">{money(p.price_cents)}</div>
                    </div>

                    {p.properties?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {p.properties.slice(0, 3).map((property) => (
                          <span
                            key={property}
                            className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                          >
                            {property}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </button>

                  <button
                    disabled={addingId === p.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      void addProductToList(p);
                    }}
                    className="mt-3 w-full rounded-2xl bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
                  >
                    {addingId === p.id ? "Adding…" : "Add to cart"}
                  </button>

                  {selectedListId ? (
                    <div className="mt-2 text-xs text-slate-500">
                      Adds to: <span className="font-medium">{lists.find((l) => l.id === selectedListId)?.name ?? "Selected list"}</span>
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
          </aside>
        </div>
      </main>

      {selectedProduct ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">{selectedProduct.name}</h2>
                <div className="mt-2 text-lg font-semibold text-slate-900">{money(selectedProduct.price_cents)}</div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-6 md:grid-cols-[1.05fr_0.95fr]">
              <div className="overflow-hidden rounded-3xl bg-slate-100">
                {selectedProduct.image_url ? (
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-400">
                    No image available
                  </div>
                )}
              </div>

              <div>
                {selectedProduct.properties?.length ? (
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Properties</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedProduct.properties.map((property) => (
                        <span
                          key={property}
                          className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700"
                        >
                          {property}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 text-sm font-semibold text-slate-900">Description</div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                  {selectedProduct.description?.trim() || "No description added yet."}
                </p>

                <button
                  type="button"
                  disabled={addingId === selectedProduct.id}
                  onClick={() => void addProductToList(selectedProduct)}
                  className="mt-6 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white disabled:opacity-60"
                >
                  {addingId === selectedProduct.id ? "Adding…" : "Add to cart"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
