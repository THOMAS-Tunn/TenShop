import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

type Address = {
  id: string;
  label: string | null;
  recipient_name: string | null;
  street_1: string;
  street_2: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
  is_default: boolean;
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
  const navigate = useNavigate();

  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [customerNote, setCustomerNote] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const money = useMemo(
    () => (cents: number) =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
      }).format(cents / 100),
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

    if (error) {
      console.error(error);
    }

    setItems((data ?? []) as ListItem[]);
    setLoading(false);
  }

  async function loadAddresses() {
    const { data, error } = await supabase
      .from("user_addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    const next = (data ?? []) as Address[];
    setAddresses(next);

    const defaultAddress = next.find((a) => a.is_default);
    if (defaultAddress) {
      setSelectedAddressId(defaultAddress.id);
    } else if (next[0]) {
      setSelectedAddressId(next[0].id);
    } else {
      setSelectedAddressId("");
    }
  }

  useEffect(() => {
    void loadItems();
    void loadAddresses();
  }, [listId]);

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

      if (error) {
        console.error(error);
      }

      setResults((data ?? []) as Product[]);
      setSearching(false);
    }, 250);

    return () => clearTimeout(t);
  }, [q]);

  async function addProduct(p: Product) {
    if (!listId) return;

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
      const nextQty = (existing.qty ?? 1) + 1;

      setItems((prev) =>
        prev.map((it) => (it.id === existing.id ? { ...it, qty: nextQty } : it))
      );

      const { error: updErr } = await supabase
        .from("shopping_list_items")
        .update({ qty: nextQty })
        .eq("id", existing.id);

      if (updErr) {
        alert(updErr.message);
        await loadItems();
      }

      return;
    }

    const { data: inserted, error: insErr } = await supabase
      .from("shopping_list_items")
      .insert({
        list_id: listId,
        user_id: user.id,
        product_id: p.id,
        name: p.name,
        price_cents: p.price_cents,
        qty: 1,
      })
      .select("id,list_id,user_id,product_id,name,price_cents,qty")
      .single();

    if (insErr) {
      alert(insErr.message);
      return;
    }

    setItems((prev) =>
      [...prev, inserted as ListItem].sort((a, b) => a.name.localeCompare(b.name))
    );
  }

  async function changeQty(itemId: string, delta: number) {
    const current = items.find((it) => it.id === itemId);
    if (!current) return;

    const nextQty = current.qty + delta;

    if (nextQty <= 0) {
      await removeItem(itemId);
      return;
    }

    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, qty: nextQty } : it))
    );

    const { error } = await supabase
      .from("shopping_list_items")
      .update({ qty: nextQty })
      .eq("id", itemId);

    if (error) {
      alert(error.message);
      await loadItems();
    }
  }

  async function removeItem(itemId: string) {
    const previous = items;
    setItems((prev) => prev.filter((it) => it.id !== itemId));

    const { error } = await supabase
      .from("shopping_list_items")
      .delete()
      .eq("id", itemId);

    if (error) {
      alert(error.message);
      setItems(previous);
    }
  }

  const subtotalCents = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.price_cents ?? 0) * (it.qty ?? 0), 0);
  }, [items]);

  const taxCents = Math.round(subtotalCents * 0.09);
  const totalCents = subtotalCents + taxCents;

  async function submitOrder() {
    if (!listId) return;

    if (items.length === 0) {
      alert("Your list is empty.");
      return;
    }

    if (!selectedAddressId) {
      alert("Please add or select a delivery address first.");
      return;
    }

    setSubmittingOrder(true);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        list_id: listId,
        address_id: selectedAddressId,
        subtotal_cents: subtotalCents,
        tax_cents: taxCents,
        total_cents: totalCents,
        customer_note: customerNote.trim() || null,
        status: "pending",
      })
      .select("id")
      .single();

    if (orderError || !order) {
      setSubmittingOrder(false);
      alert(orderError?.message ?? "Could not create order.");
      return;
    }

    const orderItemsPayload = items.map((it) => ({
      order_id: order.id,
      product_id: it.product_id,
      name: it.name,
      price_cents: it.price_cents ?? 0,
      qty: it.qty,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItemsPayload);

    if (itemsError) {
      setSubmittingOrder(false);
      alert(itemsError.message);
      return;
    }

    const messagesPayload: Array<{
      order_id: string;
      sender_user_id: string;
      message_type: "system" | "address" | "text";
      body: string | null;
      address_id?: string;
    }> = [
      {
        order_id: order.id,
        sender_user_id: user.id,
        message_type: "system",
        body: `Order created with ${items.length} item(s).`,
      },
      {
        order_id: order.id,
        sender_user_id: user.id,
        message_type: "address",
        address_id: selectedAddressId,
        body: null,
      },
    ];

    if (customerNote.trim()) {
      messagesPayload.push({
        order_id: order.id,
        sender_user_id: user.id,
        message_type: "text",
        body: customerNote.trim(),
      });
    }

    const { error: messagesError } = await supabase
      .from("order_messages")
      .insert(messagesPayload);

    setSubmittingOrder(false);

    if (messagesError) {
      alert(messagesError.message);
      return;
    }

    navigate(`/orders/${order.id}`);
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Your list</h1>
        <p className="text-sm text-slate-600">
          Search products, add to cart, and update quantities.
        </p>
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
                  type="button"
                  onClick={() => addProduct(p)}
                  className="flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left text-sm hover:bg-slate-50"
                >
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-slate-500">
                      {p.category ?? "Uncategorized"}
                    </div>
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
            <div className="mt-3 text-sm text-slate-600">
              No items yet. Search above to add.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border px-3 py-3"
                >
                  <div>
                    <div className="text-sm font-medium">{it.name}</div>
                    <div className="text-xs text-slate-500">
                      {it.price_cents != null ? money(it.price_cents) : "No price"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => changeQty(it.id, -1)}
                      className="h-9 w-9 rounded-xl border text-sm font-semibold hover:bg-slate-50"
                    >
                      -
                    </button>

                    <div className="w-10 text-center text-sm font-medium">{it.qty}</div>

                    <button
                      type="button"
                      onClick={() => changeQty(it.id, 1)}
                      className="h-9 w-9 rounded-xl border text-sm font-semibold hover:bg-slate-50"
                    >
                      +
                    </button>

                    <button
                      type="button"
                      onClick={() => removeItem(it.id)}
                      className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                    >
                      Remove
                    </button>

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
              <span className="text-slate-600">Tax (9%. <a href="https://www.google.com/search?q=columbus+georgia+local+tax+rate&sca_esv=6ed2f101db008005&rlz=1C1RXQR_enUS1110US1110&biw=1920&bih=929&ei=J3mtaYGuA8yap84PmfqYsAI&ved=0ahUKEwjB3ZDvs5CTAxVMzckDHRk9BiYQ4dUDCBQ&uact=5&oq=columbus+georgia+local+tax+rate&gs_lp=Egxnd3Mtd2l6LXNlcnAiH2NvbHVtYnVzIGdlb3JnaWEgbG9jYWwgdGF4IHJhdGUyBRAAGO8FMggQABiABBiiBDIIEAAYgAQYogQyCBAAGIAEGKIEMgUQABjvBUjWMVDqE1jhLnAFeAGQAQCYAXGgAaAGqgEDNy4yuAEDyAEA-AEBmAINoAL6BcICChAAGLADGNYEGEfCAgUQABiABMICBhAAGAcYHsICBhAAGAgYHsICCxAAGIAEGIYDGIoFwgIKECEYoAEYwwQYCpgDAIgGAZAGCJIHBDExLjKgB5kfsgcDNi4yuAftBcIHBTMuOC4yyAcWgAgA&sclient=gws-wiz-serp&safe=active&ssui=on">Columbus Georgia Tax Rate</a>)</span>
              <span className="font-semibold">{money(taxCents)}</span>
            </div>
            <div className="h-px bg-slate-200" />
            <div className="flex items-center justify-between">
              <span className="text-slate-900">Total</span>
              <span className="text-lg font-semibold">{money(totalCents)}</span>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Delivery address
            </label>
            <select
              value={selectedAddressId}
              onChange={(e) => setSelectedAddressId(e.target.value)}
              className="w-full rounded-2xl border px-3 py-2 text-sm"
            >
              <option value="">Select address…</option>
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {(a.label ?? "Address")} — {a.street_1}, {a.city}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Note to admin
            </label>
            <textarea
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              placeholder="Optional note about delivery, substitutions, timing..."
              className="w-full rounded-2xl border px-3 py-2 text-sm"
              rows={4}
            />
          </div>

          <button
            type="button"
            disabled={items.length === 0 || submittingOrder}
            className="mt-4 w-full rounded-2xl bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
            onClick={submitOrder}
          >
            {submittingOrder ? "Sending order..." : "Send order request"}
          </button>
        </Card>
      </div>
    </main>
  );
}
