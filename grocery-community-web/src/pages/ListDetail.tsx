import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { SessionUser } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { Card } from "../components/Card";

type Product = {
  id: string;
  name: string;
  price_cents: number;
  category: string | null;
  image_url: string | null;
};

type ListItem = {
  id: string;
  list_id: string;
  user_id: string;
  product_id: string | null;
  name: string;
  price_cents: number | null;
  qty: number;
};

export function ListDetail({ user }: { user: SessionUser }) {
  const { id: listId } = useParams();
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);

  const money = useMemo(
    () => (cents: number) =>
      new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100),
    []
  );

  async function loadItems() {
    if (!listId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("shopping_list_items")
      .select("id,list_id,user_id,product_id,name,price_cents,qty")
      .eq("list_id", listId)
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (error) console.error(error);
    setItems((data ?? []) as any);
    setLoading(false);
  }

  useEffect(() => {
    void loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId]);

  // Product search (simple debounce)
  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }

    const t = setTimeout(async () => {
      setSearching(true);
      const { data, error } = await supabase
        .from("products")
        .select("id,name,price_cents,category,image_url")
        .ilike("name", `%${q.trim()}%`)
        .order("name")
        .limit(8);

      if (error) console.error(error);
      setResults((data ?? []) as any);
      setSearching(false);
    }, 250);

    return () => clearTimeout(t);
  }, [q]);

  async function addProduct(p: Product) {
    if (!listId) return;

    // If item exists, increment qty; else insert.
    const { data: existing, error: readErr } = await supabase
      .from("shopping_list_items")
      .select("id, qty")
      .eq("list_id", listId)
      .eq("user_id", user.id)
      .eq("product_id", p.id)
      .maybeSingle();

    if (readErr) {
      alert(readErr.message);
      return;
    }

    if (existing?.id) {
      const { error: updErr } = await supabase
        .from("shopping_list_items")
        .update({ qty: (existing.qty ?? 1) + 1 })
        .eq("id", existing.id);

      if (updErr) alert(updErr.message);
      await loadItems();
      return;
    }

    const { error: insErr } = await supabase.from("shopping_list_items").insert({
      list_id: listId,
      user_id: user.id,
      product_id: p.id,
      name: p.name,
      price_cents: p.price_cents,
      qty: 1,
    });

    if (insErr) alert(insErr.message);
    await loadItems();
  }

  async function setQty(itemId: string, nextQty: number) {
    if (Number.isNaN(nextQty)) return;

    // If qty <= 0, delete item
    if (nextQty <= 0) {
      const { error } = await supabase.from("shopping_list_items").delete().eq("id", itemId);
      if (error) alert(error.message);
      await loadItems();
      return;
    }

    const { error } = await supabase.from("shopping_list_items").update({ qty: nextQty }).eq("id", itemId);
    if (error) alert(error.message);
    await loadItems();
  }

  const subtotalCents = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.price_cents ?? 0) * (it.qty ?? 0), 0);
  }, [items]);

  const taxCents = Math.round(subtotalCents * 0.07);
  const totalCents = subtotalCents + taxCents;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Your list</h1>
        <p className="text-sm text-slate-600">Search products, add to cart, and update quantities.</p>
      </div>

      <Card className="p-4">
        <div className="text-sm font-semibold">Add items</div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products…"
          className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm"
        />

        {q.trim() ? (
          <div className="mt-3 space-y-2">
            {searching ? (
              <div className="text-sm text-slate-600">Searching…</div>
            ) : results.length === 0 ? (
              <div className="text-sm text-slate-600">No matches.</div>
            ) : (
              results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addProduct(p)}
                  className="flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left text-sm hover:bg-slate-50"
                >
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.category ?? "Uncategorized"}</div>
                  </div>
                  <div className="font-semibold">{money(p.price_cents)}</div>
                </button>
              ))
            )}
          </div>
        ) : null}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
        <Card className="p-4">
          <div className="text-sm font-semibold">Cart items</div>

          {loading ? (
            <div className="mt-3 text-sm text-slate-600">Loading…</div>
          ) : items.length === 0 ? (
            <div className="mt-3 text-sm text-slate-600">No items yet. Search above to add.</div>
          ) : (
            <div className="mt-3 space-y-3">
              {items.map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-3 rounded-2xl border px-3 py-3">
                  <div>
                    <div className="text-sm font-medium">{it.name}</div>
                    <div className="text-xs text-slate-500">
                      {it.price_cents != null ? money(it.price_cents) : "No price"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={it.qty}
                      onChange={(e) => setQty(it.id, Number(e.target.value))}
                      className="w-20 rounded-xl border px-2 py-1 text-sm"
                    />
                    <div className="w-24 text-right text-sm font-semibold">
                      {money((it.price_cents ?? 0) * it.qty)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="text-sm font-semibold">Order total</div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-semibold">{money(subtotalCents)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Tax (7%)</span>
              <span className="font-semibold">{money(taxCents)}</span>
            </div>
            <div className="h-px bg-slate-200" />
            <div className="flex items-center justify-between">
              <span className="text-slate-900">Total</span>
              <span className="text-lg font-semibold">{money(totalCents)}</span>
            </div>
          </div>

          <button
            disabled={items.length === 0}
            className="mt-4 w-full rounded-2xl bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
            onClick={() => alert("Next step: connect a real checkout/payment flow.")}
          >
            Proceed to checkout
          </button>
        </Card>
      </div>
    </main>
  );
}
