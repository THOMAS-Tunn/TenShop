import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "../components/Card";
import { useAppSettings } from "../lib/app-settings";
import type { SessionUser } from "../lib/auth";
import { useNotice } from "../lib/notices";
import { supabase } from "../lib/supabase";

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

type CartItem = {
  id: string;
  list_id: string;
  user_id: string;
  product_id: string | null;
  name: string;
  price_cents: number | null;
  qty: number;
};

const SHIPPING_FEE_CENTS = 499;

export function CartDetail({ user }: { user: SessionUser }) {
  const { id: cartId } = useParams();
  const navigate = useNavigate();
  const { copy, formatCurrency } = useAppSettings();
  const notice = useNotice();
  const common = copy.common;
  const page = copy.cartDetail;

  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [customerNote, setCustomerNote] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);

  async function loadItems() {
    if (!cartId) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("shopping_list_items")
      .select("id,list_id,user_id,product_id,name,price_cents,qty")
      .eq("list_id", cartId)
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
    }

    setItems((data ?? []) as CartItem[]);
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
      notice.showError(error.message);
      return;
    }

    const next = (data ?? []) as Address[];
    setAddresses(next);

    const defaultAddress = next.find((address) => address.is_default);
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
  }, [cartId]);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
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

    return () => clearTimeout(timer);
  }, [q]);

  async function addProduct(product: Product) {
    if (!cartId) return;

    const { data: existing, error: readErr } = await supabase
      .from("shopping_list_items")
      .select("id, qty")
      .eq("list_id", cartId)
      .eq("user_id", user.id)
      .eq("product_id", product.id)
      .maybeSingle();

    if (readErr) {
      notice.showError(readErr.message);
      return;
    }

    if (existing?.id) {
      const nextQty = (existing.qty ?? 1) + 1;

      setItems((prev) => prev.map((item) => (item.id === existing.id ? { ...item, qty: nextQty } : item)));

      const { error: updErr } = await supabase
        .from("shopping_list_items")
        .update({ qty: nextQty })
        .eq("id", existing.id);

      if (updErr) {
        notice.showError(updErr.message);
        await loadItems();
      }

      return;
    }

    const { data: inserted, error: insErr } = await supabase
      .from("shopping_list_items")
      .insert({
        list_id: cartId,
        user_id: user.id,
        product_id: product.id,
        name: product.name,
        price_cents: product.price_cents,
        qty: 1,
      })
      .select("id,list_id,user_id,product_id,name,price_cents,qty")
      .single();

    if (insErr) {
      notice.showError(insErr.message);
      return;
    }

    setItems((prev) =>
      [...prev, inserted as CartItem].sort((left, right) => left.name.localeCompare(right.name))
    );
  }

  async function changeQty(itemId: string, delta: number) {
    const current = items.find((item) => item.id === itemId);
    if (!current) return;

    const nextQty = current.qty + delta;

    if (nextQty <= 0) {
      await removeItem(itemId);
      return;
    }

    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, qty: nextQty } : item)));

    const { error } = await supabase.from("shopping_list_items").update({ qty: nextQty }).eq("id", itemId);

    if (error) {
      notice.showError(error.message);
      await loadItems();
    }
  }

  async function removeItem(itemId: string) {
    const previous = items;
    setItems((prev) => prev.filter((item) => item.id !== itemId));

    const { error } = await supabase.from("shopping_list_items").delete().eq("id", itemId);

    if (error) {
      notice.showError(error.message);
      setItems(previous);
    }
  }

  const subtotalCents = useMemo(
    () => items.reduce((sum, item) => sum + (item.price_cents ?? 0) * (item.qty ?? 0), 0),
    [items]
  );
  const taxCents = Math.round(subtotalCents * 0.09);
  const shippingCents = items.length > 0 ? SHIPPING_FEE_CENTS : 0;
  const totalCents = subtotalCents + taxCents + shippingCents;

  async function submitOrder() {
    if (!cartId) return;

    if (items.length === 0) {
      notice.showWarning(page.cartEmptyAlert);
      return;
    }

    if (!selectedAddressId) {
      notice.showWarning(page.addressRequiredAlert);
      return;
    }

    setSubmittingOrder(true);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        list_id: cartId,
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
      notice.showError(orderError?.message ?? page.couldNotCreateOrder);
      return;
    }

    const orderItemsPayload = items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      name: item.name,
      price_cents: item.price_cents ?? 0,
      qty: item.qty,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(orderItemsPayload);

    if (itemsError) {
      setSubmittingOrder(false);
      notice.showError(itemsError.message);
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
        body: `order_created:${items.length}`,
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

    const { error: messagesError } = await supabase.from("order_messages").insert(messagesPayload);

    setSubmittingOrder(false);

    if (messagesError) {
      notice.showError(messagesError.message);
      return;
    }

    navigate(`/orders/${order.id}`);
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">{page.title}</h1>
        <p className="text-sm text-slate-600">{page.subtitle}</p>
      </div>

      <Card className="p-4">
        <div className="text-sm font-semibold">{page.addItems}</div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={page.searchProducts}
          className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm"
        />

        {q.trim() ? (
          <div className="mt-3 space-y-2">
            {searching ? (
              <div className="text-sm text-slate-600">{common.searching}</div>
            ) : results.length === 0 ? (
              <div className="text-sm text-slate-600">{page.noMatches}</div>
            ) : (
              results.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => void addProduct(product)}
                  className="flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left text-sm hover:bg-slate-50"
                >
                  <div>
                    <div className="font-medium">{product.name}</div>
                    <div className="text-xs text-slate-500">
                      {product.category ?? page.uncategorized}
                    </div>
                  </div>
                  <div className="font-semibold">{formatCurrency(product.price_cents)}</div>
                </button>
              ))
            )}
          </div>
        ) : null}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
        <Card className="p-4">
          <div className="text-sm font-semibold">{page.cartItems}</div>

          {loading ? (
            <div className="mt-3 text-sm text-slate-600">{common.loading}</div>
          ) : items.length === 0 ? (
            <div className="mt-3 text-sm text-slate-600">{page.noItemsYet}</div>
          ) : (
            <div className="mt-3 space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border px-3 py-3"
                >
                  <div>
                    <div className="text-sm font-medium">{item.name}</div>
                    <div className="text-xs text-slate-500">
                      {item.price_cents != null ? formatCurrency(item.price_cents) : page.noPrice}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void changeQty(item.id, -1)}
                      className="h-9 w-9 rounded-xl border text-sm font-semibold hover:bg-slate-50"
                    >
                      -
                    </button>

                    <div className="w-10 text-center text-sm font-medium">{item.qty}</div>

                    <button
                      type="button"
                      onClick={() => void changeQty(item.id, 1)}
                      className="h-9 w-9 rounded-xl border text-sm font-semibold hover:bg-slate-50"
                    >
                      +
                    </button>

                    <button
                      type="button"
                      onClick={() => void removeItem(item.id)}
                      className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                    >
                      {page.remove}
                    </button>

                    <div className="w-24 text-right text-sm font-semibold">
                      {formatCurrency((item.price_cents ?? 0) * item.qty)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="text-sm font-semibold">{page.orderTotal}</div>

          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">{common.subtotal}</span>
              <span className="font-semibold">{formatCurrency(subtotalCents)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">
                {page.taxRate}{" "}
                <a
                  href="https://www.google.com/search?q=columbus+georgia+local+tax+rate&sca_esv=6ed2f101db008005&rlz=1C1RXQR_enUS1110US1110&biw=1920&bih=929&ei=J3mtaYGuA8yap84PmfqYsAI&ved=0ahUKEwjB3ZDvs5CTAxVMzckDHRk9BiYQ4dUDCBQ&uact=5&oq=columbus+georgia+local+tax+rate&gs_lp=Egxnd3Mtd2l6LXNlcnAiH2NvbHVtYnVzIGdlb3JnaWEgbG9jYWwgdGF4IHJhdGUyBRAAGO8FMggQABiABBiiBDIIEAAYgAQYogQyCBAAGIAEGKIEMgUQABjvBUjWMVDqE1jhLnAFeAGQAQCYAXGgAaAGqgEDNy4yuAEDyAEA-AEBmAINoAL6BcICChAAGLADGNYEGEfCAgUQABiABMICBhAAGAcYHsICBhAAGAgYHsICCxAAGIAEGIYDGIoFwgIKECEYoAEYwwQYCpgDAIgGAZAGCJIHBDExLjKgB5kfsgcDNi4yuAftBcIHBTMuOC4yyAcWgAgA&sclient=gws-wiz-serp&safe=active&ssui=on"
                  target="_blank"
                  rel="noreferrer"
                >
                  <u>
                    <i>(?)</i>
                  </u>
                </a>
              </span>
              <span className="font-semibold">{formatCurrency(taxCents)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">{common.shipping}</span>
              <span className="font-semibold">{formatCurrency(shippingCents)}</span>
            </div>
            <div className="h-px bg-slate-200" />
            <div className="flex items-center justify-between">
              <span className="text-slate-900">{common.total}</span>
              <span className="text-lg font-semibold">{formatCurrency(totalCents)}</span>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {page.deliveryAddress}
            </label>
            <select
              value={selectedAddressId}
              onChange={(e) => setSelectedAddressId(e.target.value)}
              className="w-full rounded-2xl border px-3 py-2 text-sm"
            >
              <option value="">{page.selectAddress}</option>
              {addresses.map((address) => (
                <option key={address.id} value={address.id}>
                  {page.addressOption(address.label ?? common.address, address.street_1, address.city)}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">{page.noteToAdmin}</label>
            <textarea
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              placeholder={page.notePlaceholder}
              className="w-full rounded-2xl border px-3 py-2 text-sm"
              rows={4}
            />
          </div>

          <button
            type="button"
            disabled={items.length === 0 || submittingOrder}
            className="mt-4 w-full rounded-2xl bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
            onClick={() => void submitOrder()}
          >
            {submittingOrder ? page.sendingOrder : page.sendOrderRequest}
          </button>
        </Card>
      </div>
    </main>
  );
}
