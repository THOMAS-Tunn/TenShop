import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/Card";
import { supabase } from "../lib/supabase";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  in_stock: boolean;
};

type AdminThread = {
  id: string;
  user_id: string;
  status: string;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  customer_note: string | null;
  address_id: string;
  created_at: string;
};

type OrderItem = {
  id: string;
  order_id: string;
  name: string;
  price_cents: number;
  qty: number;
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

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

export function Admin() {
  const [items, setItems] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number>(1);

  const [threads, setThreads] = useState<AdminThread[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const [selectedOrder, setSelectedOrder] = useState<AdminThread | null>(null);
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  const [selectedMessages, setSelectedMessages] = useState<OrderMessage[]>([]);
  const [addressMap, setAddressMap] = useState<Record<string, Address>>({});
  const [profileMap, setProfileMap] = useState<Record<string, Profile>>({});

  const [replyBody, setReplyBody] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);

  const money = useMemo(
    () => (cents: number) =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
      }).format(cents / 100),
    []
  );

  function formatTime(value: string) {
    return new Date(value).toLocaleString();
  }

  function getCustomerLabel(thread: AdminThread) {
    const profile = profileMap[thread.user_id];
    if (profile?.full_name?.trim()) return profile.full_name;
    return `Customer ${thread.user_id.slice(0, 8)}`;
  }

  function getLastMessagePreview(threadId: string) {
    const messages = selectedChatId === threadId ? selectedMessages : [];
    const latest = messages[messages.length - 1];

    if (!latest) {
      const thread = threads.find((t) => t.id === threadId);
      return thread?.customer_note || "New order request";
    }

    if (latest.message_type === "address") {
      return "Shared a delivery address";
    }

    if (latest.message_type === "system") {
      return latest.body || "System update";
    }

    return latest.body || "Message";
  }

  async function loadProducts() {
    const { data, error } = await supabase.from("products").select("*").order("name");

    if (error) {
      console.error(error);
      return;
    }

    setItems((data ?? []) as Product[]);
  }

  async function loadThreads() {
    const { data, error } = await supabase
      .from("orders")
      .select("id,user_id,status,subtotal_cents,tax_cents,total_cents,customer_note,address_id,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    const next = (data ?? []) as AdminThread[];
    setThreads(next);

    if (!selectedChatId && next[0]) {
      setSelectedChatId(next[0].id);
    }

    const uniqueUserIds = Array.from(new Set(next.map((t) => t.user_id).filter(Boolean)));

    if (uniqueUserIds.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id,full_name,phone")
        .in("id", uniqueUserIds);

      if (profileError) {
        console.error(profileError);
      } else {
        const nextProfileMap: Record<string, Profile> = {};
        for (const p of profiles ?? []) {
          nextProfileMap[p.id] = p as Profile;
        }
        setProfileMap(nextProfileMap);
      }
    }
  }

  async function loadSelectedOrder(orderId: string) {
    setLoadingChat(true);

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("id,user_id,status,subtotal_cents,tax_cents,total_cents,customer_note,address_id,created_at")
      .eq("id", orderId)
      .single();

    if (orderError) {
      console.error(orderError);
      setLoadingChat(false);
      return;
    }

    const [{ data: itemData, error: itemError }, { data: msgData, error: msgError }] =
      await Promise.all([
        supabase.from("order_items").select("*").eq("order_id", orderId).order("name"),
        supabase.from("order_messages").select("*").eq("order_id", orderId).order("created_at"),
      ]);

    if (itemError) console.error(itemError);
    if (msgError) console.error(msgError);

    const order = orderData as AdminThread;
    const items = (itemData ?? []) as OrderItem[];
    const messages = (msgData ?? []) as OrderMessage[];

    setSelectedOrder(order);
    setSelectedItems(items);
    setSelectedMessages(messages);

    const addressIds = new Set<string>();
    if (order.address_id) addressIds.add(order.address_id);

    for (const msg of messages) {
      if (msg.address_id) addressIds.add(msg.address_id);
    }

    if (addressIds.size > 0) {
      const { data: addresses, error: addressError } = await supabase
        .from("user_addresses")
        .select("*")
        .in("id", Array.from(addressIds));

      if (addressError) {
        console.error(addressError);
      } else {
        const nextAddressMap: Record<string, Address> = {};
        for (const a of addresses ?? []) {
          nextAddressMap[a.id] = a as Address;
        }
        setAddressMap(nextAddressMap);
      }
    } else {
      setAddressMap({});
    }

    setLoadingChat(false);
  }

  useEffect(() => {
    void loadProducts();
    void loadThreads();
  }, []);

  useEffect(() => {
    if (!selectedChatId) return;
    void loadSelectedOrder(selectedChatId);
  }, [selectedChatId]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-orders-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          void loadThreads();
          if (selectedChatId) {
            void loadSelectedOrder(selectedChatId);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_messages" },
        (payload) => {
          void loadThreads();

          const orderId =
            typeof payload.new === "object" && payload.new && "order_id" in payload.new
              ? String(payload.new.order_id)
              : selectedChatId;

          if (orderId) {
            void loadSelectedOrder(orderId);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedChatId]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();

    const { error } = await supabase.from("products").insert({
      name,
      price_cents: Math.round(price * 100),
      in_stock: true,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setName("");
    setPrice(1);
    await loadProducts();
  }

  async function deleteItem(id: string) {
    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadProducts();
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedChatId || !replyBody.trim()) return;

    setSendingReply(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setSendingReply(false);
      alert("Could not find the current admin user.");
      return;
    }

    const { error } = await supabase.from("order_messages").insert({
      order_id: selectedChatId,
      sender_user_id: user.id,
      message_type: "text",
      body: replyBody.trim(),
    });

    setSendingReply(false);

    if (error) {
      alert(error.message);
      return;
    }

    setReplyBody("");
    await loadSelectedOrder(selectedChatId);
    await loadThreads();
  }

  function renderAddress(addressId: string | null | undefined) {
    if (!addressId) return null;

    const a = addressMap[addressId];
    if (!a) return null;

    return (
      <div className="rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <div className="font-medium text-slate-900">{a.label ?? "Delivery address"}</div>
        <div className="mt-2">{a.recipient_name ?? "No recipient"}</div>
        <div>{a.street_1}</div>
        {a.street_2 ? <div>{a.street_2}</div> : null}
        <div>
          {a.city}
          {a.state ? `, ${a.state}` : ""} {a.postal_code ?? ""}
        </div>
        <div>{a.country}</div>
        {a.phone ? <div className="mt-2">Phone: {a.phone}</div> : null}
        {a.delivery_notes ? <div className="mt-2 text-slate-500">Notes: {a.delivery_notes}</div> : null}
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
              Admin Dashboard
            </h1>
            <p className="mt-3 text-slate-600">
              Manage products and view real customer orders and messages.
            </p>
          </div>

          <Card className="p-6">
            <div className="text-sm font-semibold">Add product</div>

            <form onSubmit={addItem} className="mt-4 grid gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Product name
                </label>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2 outline-none transition focus:border-slate-400"
                  placeholder="Product name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Price (USD)
                </label>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2 outline-none transition focus:border-slate-400"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  required
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-white hover:opacity-90"
                >
                  Add Product
                </button>
              </div>
            </form>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Products</div>
                <p className="mt-1 text-sm text-slate-600">
                  {items.length} item{items.length === 1 ? "" : "s"} in catalog
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {items.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  No products yet. Add your first item to get started.
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">
                        {item.name}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {(item.price_cents / 100).toFixed(2)} USD •{" "}
                        {item.in_stock ? "In stock" : "Out of stock"}
                      </div>
                    </div>

<button
  type="button"
  onClick={() => deleteItem(item.id)}
  className="shrink-0 rounded-2xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100"
>
  Delete
</button>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden border border-slate-800 bg-[#0b0b0c] p-0 text-white shadow-2xl">
            <div className="border-b border-slate-800 px-5 py-4">
              <h2 className="text-lg font-semibold">Customer Chats</h2>
              <p className="mt-1 text-sm text-slate-400">
                Real orders from Supabase will appear here.
              </p>
            </div>

            <div className="max-h-[360px] divide-y divide-slate-800 overflow-y-auto">
              {threads.length === 0 ? (
                <div className="px-5 py-6 text-sm text-slate-400">
                  No order chats yet.
                </div>
              ) : (
                threads.map((thread) => {
                  const active = selectedChatId === thread.id;

                  return (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => setSelectedChatId(thread.id)}
                      className={`flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition ${
                        active ? "bg-white/10" : "bg-transparent hover:bg-white/5"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-semibold text-white">
                          {getCustomerLabel(thread)}
                        </div>
                        <div className="mt-1 truncate text-sm text-slate-400">
                          {thread.customer_note || getLastMessagePreview(thread.id)}
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          Order #{thread.id.slice(0, 8)} • {thread.status}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold text-white">
                          {money(thread.total_cents)}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {formatTime(thread.created_at)}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Card>

          <Card className="p-5">
            {!selectedChatId ? (
              <div className="text-sm text-slate-600">
                Select an order chat to view the conversation.
              </div>
            ) : loadingChat ? (
              <div className="text-sm text-slate-600">Loading chat…</div>
            ) : !selectedOrder ? (
              <div className="text-sm text-slate-600">Order not found.</div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {getCustomerLabel(selectedOrder)}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      Order #{selectedOrder.id.slice(0, 8)} • {selectedOrder.status}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Placed {formatTime(selectedOrder.created_at)}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm text-slate-600">Total</div>
                    <div className="text-lg font-semibold text-slate-900">
                      {money(selectedOrder.total_cents)}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 text-sm font-semibold text-slate-900">
                      Order items
                    </div>
                    <div className="space-y-2">
                      {selectedItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-2xl border px-3 py-3 text-sm"
                        >
                          <div>
                            {item.name} × {item.qty}
                          </div>
                          <div className="font-medium">
                            {money(item.price_cents * item.qty)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-sm font-semibold text-slate-900">
                      Delivery address
                    </div>
                    {renderAddress(selectedOrder.address_id)}
                  </div>
                </div>

                <div className="mt-5">
                  <div className="mb-2 text-sm font-semibold text-slate-900">
                    Conversation
                  </div>

                  <div className="max-h-[320px] space-y-3 overflow-y-auto rounded-2xl border bg-slate-50 p-3">
                    {selectedMessages.length === 0 ? (
                      <div className="text-sm text-slate-600">No messages yet.</div>
                    ) : (
                      selectedMessages.map((message) => {
                        const isAddress = message.message_type === "address";

                        return (
                          <div
                            key={message.id}
                            className="rounded-2xl bg-white px-4 py-3 text-sm shadow-sm"
                          >
                            <div className="text-xs text-slate-500">
                              {message.sender_user_id === selectedOrder.user_id
                                ? getCustomerLabel(selectedOrder)
                                : "Admin"}{" "}
                              • {formatTime(message.created_at)}
                            </div>

                            <div className="mt-2">
                              {isAddress ? renderAddress(message.address_id) : null}
                              {!isAddress ? (
                                <div className="text-slate-800">
                                  {message.body || "Empty message"}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <form onSubmit={sendReply} className="mt-4 flex gap-2">
                    <input
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="Reply to customer..."
                      className="w-full rounded-2xl border px-3 py-2 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={sendingReply || !replyBody.trim()}
                      className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
                    >
                      {sendingReply ? "Sending..." : "Send"}
                    </button>
                  </form>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}

