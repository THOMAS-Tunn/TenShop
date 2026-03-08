import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "../components/Card";
import type { SessionUser } from "../lib/auth";
import { supabase } from "../lib/supabase";

type Order = {
  id: string;
  status: string;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  customer_note: string | null;
  address_id: string;
  created_at: string;
  admin_deleted_at: string | null;
  admin_deleted_by: string | null;
};

type OrderItem = {
  id: string;
  name: string;
  price_cents: number;
  qty: number;
};

type Address = {
  id: string;
  label: string | null;
  recipient_name: string | null;
  phone: string | null;
  street_1: string;
  street_2: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
  delivery_notes: string | null;
};

type OrderMessage = {
  id: string;
  order_id: string;
  sender_user_id: string;
  message_type: "text" | "address" | "system";
  body: string | null;
  address_id: string | null;
  created_at: string;
};

export function OrderDetail({ user }: { user: SessionUser }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [addressMap, setAddressMap] = useState<Record<string, Address>>({});
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingChat, setDeletingChat] = useState(false);

  const money = useMemo(
    () => (cents: number) =>
      new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100),
    []
  );

  async function loadAll() {
    if (!id) return;

    const [{ data: orderData }, { data: itemData }, { data: msgData }, { data: savedAddrData }] =
      await Promise.all([
        supabase.from("orders").select("*").eq("id", id).single(),
        supabase.from("order_items").select("*").eq("order_id", id).order("name"),
        supabase.from("order_messages").select("*").eq("order_id", id).order("created_at"),
        supabase
          .from("user_addresses")
          .select("*")
          .eq("user_id", user.id)
          .order("is_default", { ascending: false }),
      ]);

    setOrder(orderData as Order);
    setItems((itemData ?? []) as OrderItem[]);
    setMessages((msgData ?? []) as OrderMessage[]);
    setSavedAddresses((savedAddrData ?? []) as Address[]);

    const addressIds = new Set<string>();
    if (orderData?.address_id) addressIds.add(orderData.address_id);
    for (const m of msgData ?? []) {
      if (m.address_id) addressIds.add(m.address_id);
    }

    if (addressIds.size > 0) {
      const { data: addresses } = await supabase
        .from("user_addresses")
        .select("*")
        .in("id", Array.from(addressIds));

      const map: Record<string, Address> = {};
      for (const a of addresses ?? []) map[a.id] = a as Address;
      setAddressMap(map);
    } else {
      setAddressMap({});
    }
  }

  useEffect(() => {
    void loadAll();
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`customer-order-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        void loadAll();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_messages" }, () => {
        void loadAll();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !body.trim()) return;

    setSending(true);
    const { error } = await supabase.from("order_messages").insert({
      order_id: id,
      sender_user_id: user.id,
      message_type: "text",
      body: body.trim(),
    });
    setSending(false);

    if (error) {
      alert(error.message);
      return;
    }

    setBody("");
    await loadAll();
  }

  async function sendAddress(addressId: string) {
    if (!id) return;

    const { error } = await supabase.from("order_messages").insert({
      order_id: id,
      sender_user_id: user.id,
      message_type: "address",
      address_id: addressId,
      body: null,
    });

    if (error) {
      alert(error.message);
      return;
    }

    await loadAll();
  }

  async function deleteChat() {
    if (!id) return;

    const ok = window.confirm("Are you sure you want to delete this chat?");
    if (!ok) return;

    setDeletingChat(true);

    const { error: messageError } = await supabase
      .from("order_messages")
      .delete()
      .eq("order_id", id);

    if (messageError) {
      setDeletingChat(false);
      alert(messageError.message);
      return;
    }

    const { error: itemError } = await supabase
      .from("order_items")
      .delete()
      .eq("order_id", id);

    if (itemError) {
      setDeletingChat(false);
      alert(itemError.message);
      return;
    }

    const { error: orderError } = await supabase
      .from("orders")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    setDeletingChat(false);

    if (orderError) {
      alert(orderError.message);
      return;
    }

    navigate("/chat");
  }

  function renderAddress(addressId: string | null | undefined) {
    if (!addressId) return null;
    const a = addressMap[addressId];
    if (!a) return null;

    return (
      <div className="rounded-2xl border bg-slate-50 px-4 py-3 text-sm">
        <div className="font-medium">Delivery address</div>
        <div className="mt-2">{a.recipient_name ?? "No recipient"}</div>
        <div>{a.street_1}</div>
        {a.street_2 ? <div>{a.street_2}</div> : null}
        <div>
          {a.city}
          {a.state ? `, ${a.state}` : ""} {a.postal_code ?? ""}
        </div>
        <div>{a.country}</div>
        {a.delivery_notes ? <div className="mt-2 text-slate-500">Notes: {a.delivery_notes}</div> : null}
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="text-sm font-semibold">Order summary</div>
            {order ? (
              <div className="mt-3 text-sm text-slate-700">
                <div>Status: {order.status}</div>
                <div className="mt-1">Placed: {new Date(order.created_at).toLocaleString()}</div>
                <div className="mt-4 space-y-2">
                  {items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between">
                      <span>{it.name} × {it.qty}</span>
                      <span className="font-medium">{money(it.price_cents * it.qty)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-2 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <span>Subtotal</span>
                    <span>{money(order.subtotal_cents)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Tax</span>
                    <span>{money(order.tax_cents)}</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold">
                    <span>Total</span>
                    <span>{money(order.total_cents)}</span>
                  </div>
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="p-5">
            <div className="text-sm font-semibold">Selected delivery address</div>
            <div className="mt-3">{renderAddress(order?.address_id)}</div>
          </Card>
        </div>

        <Card className="p-5">
          <div className="text-sm font-semibold">Order chat</div>

          {order?.admin_deleted_at ? (
            <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4">
              <div className="text-sm font-semibold text-amber-900">
                This chat was deleted by admin.
              </div>
              <p className="mt-1 text-sm text-amber-800">
                You can still review it here. Do you want to delete it too?
              </p>
              <button
                type="button"
                onClick={deleteChat}
                disabled={deletingChat}
                className="mt-3 rounded-2xl border border-red-300 bg-red-100 px-4 py-2 text-sm font-semibold text-red-900 hover:bg-red-200 disabled:opacity-60"
              >
                {deletingChat ? "Deleting..." : "Delete this chat"}
              </button>
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {messages.map((m) => (
              <div key={m.id} className="rounded-2xl border px-4 py-3">
                <div className="text-xs text-slate-500">
                  {m.sender_user_id === user.id ? "You" : "Admin"} •{" "}
                  {new Date(m.created_at).toLocaleString()}
                </div>

                <div className="mt-2">
                  {m.message_type === "address" ? renderAddress(m.address_id) : null}
                  {m.message_type !== "address" ? (
                    <div className="text-sm text-slate-800">{m.body}</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <div className="mb-2 flex flex-wrap gap-2">
              {savedAddresses.map((a) => (
                <button
                  key={a.id}
                  onClick={() => sendAddress(a.id)}
                  className="rounded-full border px-3 py-2 text-xs hover:bg-slate-50"
                  title="Send this address into chat"
                >
                  📍 {a.label ?? "Address"}
                </button>
              ))}
            </div>

            <form onSubmit={sendMessage} className="flex gap-2">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type a message..."
                className="w-full rounded-2xl border px-3 py-2 text-sm"
              />
              <button
                disabled={sending}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                Send
              </button>
            </form>
          </div>
        </Card>
      </div>
    </main>
  );
}
