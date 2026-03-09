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
  properties: string[] | null;
};

type OrderRow = {
  id: string;
  user_id: string;
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

function parseProperties(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function Admin() {
  const [items, setItems] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number>(1);
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [propertiesInput, setPropertiesInput] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState<number>(1);
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPropertiesInput, setEditPropertiesInput] = useState("");

  const [threads, setThreads] = useState<OrderRow[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);

  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
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

  function getCustomerLabel(order: OrderRow) {
    const profile = profileMap[order.user_id];
    if (profile?.full_name?.trim()) return profile.full_name;
    return `Customer ${order.user_id.slice(0, 8)}`;
  }

  function getStatusClasses(status: string) {
    if (status === "pending") {
      return "bg-amber-300 text-amber-950 ring-1 ring-amber-400";
    }
    if (status === "shipped") {
      return "bg-emerald-200 text-emerald-950 ring-1 ring-emerald-400";
    }
    if (status === "confirmed") {
      return "bg-blue-200 text-blue-950 ring-1 ring-blue-400";
    }
    if (status === "delivered") {
      return "bg-slate-200 text-slate-900 ring-1 ring-slate-300";
    }
    if (status === "cancelled") {
      return "bg-red-200 text-red-950 ring-1 ring-red-400";
    }
    return "bg-white/20 text-white ring-1 ring-white/25";
  }

  async function loadProducts() {
    const { data, error } = await supabase.from("products").select("*").order("name");

    if (error) {
      alert(error.message);
      return;
    }

    setItems((data ?? []) as Product[]);
  }

  async function loadThreads() {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id,user_id,status,subtotal_cents,tax_cents,total_cents,customer_note,address_id,created_at,admin_deleted_at,admin_deleted_by"
      )
      .is("admin_deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    const next = (data ?? []) as OrderRow[];
    setThreads(next);

    const userIds = Array.from(new Set(next.map((x) => x.user_id).filter(Boolean)));

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", userIds);

      const nextProfileMap: Record<string, Profile> = {};
      for (const p of profiles ?? []) {
        nextProfileMap[p.id] = p as Profile;
      }
      setProfileMap(nextProfileMap);
    } else {
      setProfileMap({});
    }

    if (!selectedChatId && next[0]) {
      setSelectedChatId(next[0].id);
    }

    if (selectedChatId && !next.some((x) => x.id === selectedChatId)) {
      closeChat();
    }
  }

  async function loadSelectedOrder(orderId: string) {
    setLoadingChat(true);

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select(
        "id,user_id,status,subtotal_cents,tax_cents,total_cents,customer_note,address_id,created_at,admin_deleted_at,admin_deleted_by"
      )
      .eq("id", orderId)
      .single();

    if (orderError) {
      alert(orderError.message);
      setLoadingChat(false);
      return;
    }

    const [{ data: itemData, error: itemError }, { data: messageData, error: messageError }] =
      await Promise.all([
        supabase.from("order_items").select("*").eq("order_id", orderId).order("name"),
        supabase.from("order_messages").select("*").eq("order_id", orderId).order("created_at"),
      ]);

    if (itemError) {
      alert(itemError.message);
      setLoadingChat(false);
      return;
    }

    if (messageError) {
      alert(messageError.message);
      setLoadingChat(false);
      return;
    }

    const order = orderData as OrderRow;
    const messages = (messageData ?? []) as OrderMessage[];

    setSelectedOrder(order);
    setSelectedItems((itemData ?? []) as OrderItem[]);
    setSelectedMessages(messages);

    const addressIds = new Set<string>();
    if (order.address_id) addressIds.add(order.address_id);

    for (const m of messages) {
      if (m.address_id) addressIds.add(m.address_id);
    }

    if (addressIds.size > 0) {
      const { data: addresses } = await supabase
        .from("user_addresses")
        .select("*")
        .in("id", Array.from(addressIds));

      const nextAddressMap: Record<string, Address> = {};
      for (const a of addresses ?? []) {
        nextAddressMap[a.id] = a as Address;
      }
      setAddressMap(nextAddressMap);
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
        () => {
          void loadThreads();
          if (selectedChatId) {
            void loadSelectedOrder(selectedChatId);
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
      image_url: imageUrl.trim() || null,
      description: description.trim() || null,
      properties: parseProperties(propertiesInput),
      in_stock: true,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setName("");
    setPrice(1);
    setImageUrl("");
    setDescription("");
    setPropertiesInput("");
    await loadProducts();
  }

  function startEditing(item: Product) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditPrice(item.price_cents / 100);
    setEditImageUrl(item.image_url ?? "");
    setEditDescription(item.description ?? "");
    setEditPropertiesInput((item.properties ?? []).join(", "));
  }

  function cancelEditing() {
    setEditingId(null);
    setEditName("");
    setEditPrice(1);
    setEditImageUrl("");
    setEditDescription("");
    setEditPropertiesInput("");
  }

  async function saveItem(id: string) {
    const { error } = await supabase
      .from("products")
      .update({
        name: editName,
        price_cents: Math.round(editPrice * 100),
        image_url: editImageUrl.trim() || null,
        description: editDescription.trim() || null,
        properties: parseProperties(editPropertiesInput),
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    cancelEditing();
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

  function toggleBulkSelection(orderId: string) {
    setSelectedBulkIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  }

  function startSelecting() {
    setIsSelecting(true);
    setSelectedBulkIds([]);
  }

  function cancelSelecting() {
    setIsSelecting(false);
    setSelectedBulkIds([]);
  }

  async function markSelectedAsShipped() {
    if (selectedBulkIds.length === 0) {
      alert("Select at least one chat first.");
      return;
    }

    const ok = window.confirm("Are you sure you want to mark the selected chats as shipped?");
    if (!ok) return;

    const { error } = await supabase
      .from("orders")
      .update({ status: "shipped" })
      .in("id", selectedBulkIds);

    if (error) {
      alert(error.message);
      return;
    }

    if (selectedChatId && selectedBulkIds.includes(selectedChatId)) {
      await loadSelectedOrder(selectedChatId);
    }

    cancelSelecting();
    await loadThreads();
  }

  async function hideSelectedChatsForAdmin() {
    if (selectedBulkIds.length === 0) {
      alert("Select at least one chat first.");
      return;
    }

    const ok = window.confirm(
      "Are you sure you want to remove the selected chats from the admin board only?"
    );
    if (!ok) return;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      alert("Could not find the signed-in admin.");
      return;
    }

    const { error } = await supabase
      .from("orders")
      .update({
        admin_deleted_at: new Date().toISOString(),
        admin_deleted_by: user.id,
      })
      .in("id", selectedBulkIds);

    if (error) {
      alert(error.message);
      return;
    }

    if (selectedChatId && selectedBulkIds.includes(selectedChatId)) {
      closeChat();
    }

    cancelSelecting();
    await loadThreads();
  }

  async function markCurrentAsShipped() {
    if (!selectedChatId) return;

    const ok = window.confirm("Are you sure you want to mark this order as shipped?");
    if (!ok) return;

    const { error } = await supabase
      .from("orders")
      .update({ status: "shipped" })
      .eq("id", selectedChatId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadThreads();
    await loadSelectedOrder(selectedChatId);
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedChatId || !replyBody.trim()) return;

    setSendingReply(true);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setSendingReply(false);
      alert("Could not find the signed-in admin.");
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

  function closeChat() {
    setSelectedChatId(null);
    setSelectedOrder(null);
    setSelectedItems([]);
    setSelectedMessages([]);
    setReplyBody("");
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
        {a.delivery_notes ? (
          <div className="mt-2 text-slate-500">Notes: {a.delivery_notes}</div>
        ) : null}
      </div>
    );
  }

  const selectedOrderShippingCents = selectedOrder
    ? Math.max(0, selectedOrder.total_cents - selectedOrder.subtotal_cents - selectedOrder.tax_cents)
    : 0;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
              Admin Dashboard
            </h1>
            <p className="mt-3 text-slate-600">
              Manage products and real customer order chats.
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
                  Image URL
                </label>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2 outline-none transition focus:border-slate-400"
                  placeholder="https://..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
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

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Tags
                </label>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2 outline-none transition focus:border-slate-400"
                  placeholder="Fresh, Organic, 1 lb"
                  value={propertiesInput}
                  onChange={(e) => setPropertiesInput(e.target.value)}
                />
                <div className="mt-1 text-xs text-slate-500">
                  Separate each property with a comma.
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Description
                </label>
                <textarea
                  className="min-h-[120px] w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
                  placeholder="One description for this item"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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
            <div className="text-sm font-semibold">Products</div>

            <div className="mt-4 space-y-4">
              {items.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  No products yet.
                </div>
              ) : (
                items.map((item) => {
                  const isEditing = editingId === item.id;

                  return (
                    <div
                      key={item.id}
                      className="rounded-3xl border border-slate-200 px-4 py-4"
                    >
                      {isEditing ? (
                        <div className="grid gap-4">
                          <div className="grid gap-4 md:grid-cols-[140px_1fr]">
                            <div className="aspect-square overflow-hidden rounded-2xl bg-slate-100">
                              {editImageUrl ? (
                                <img
                                  src={editImageUrl}
                                  alt={editName || item.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : null}
                            </div>

                            <div className="grid gap-3">
                              <input
                                className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="Product name"
                              />
                              <input
                                className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                                type="number"
                                min="0"
                                step="0.01"
                                value={editPrice}
                                onChange={(e) => setEditPrice(Number(e.target.value))}
                                placeholder="Price"
                              />
                              <input
                                className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                                value={editImageUrl}
                                onChange={(e) => setEditImageUrl(e.target.value)}
                                placeholder="Image URL"
                              />
                              <input
                                className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                                value={editPropertiesInput}
                                onChange={(e) => setEditPropertiesInput(e.target.value)}
                                placeholder="Fresh, Organic, 1 lb"
                              />
                            </div>
                          </div>

                          <textarea
                            className="min-h-[120px] w-full rounded-2xl border border-slate-200 px-4 py-3"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            placeholder="Product description"
                          />

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => saveItem(item.id)}
                              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="flex min-w-0 gap-4">
                            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : null}
                            </div>

                            <div className="min-w-0">
                              <div className="truncate font-medium text-slate-900">{item.name}</div>
                              <div className="mt-1 text-sm text-slate-600">
                                {money(item.price_cents)} • {item.in_stock ? "In stock" : "Out of stock"}
                              </div>
                              {item.properties?.length ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {item.properties.map((property) => (
                                    <span
                                      key={property}
                                      className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                                    >
                                      {property}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                              {item.description ? (
                                <p className="mt-2 line-clamp-3 text-sm text-slate-600">
                                  {item.description}
                                </p>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => startEditing(item)}
                              className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteItem(item.id)}
                              className="rounded-2xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden border border-slate-800 bg-[#0b0b0c] p-0 text-white shadow-2xl">
            <div className="border-b border-slate-800 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold ">Customer Chats</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    All pending requests and all chats.
                  </p>
                </div>

                {!isSelecting ? (
                  <button
                    type="button"
                    onClick={startSelecting}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
                  >
                    Select
                  </button>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={cancelSelecting}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={markSelectedAsShipped}
                      className="rounded-xl border border-emerald-300 bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-900 shadow-sm hover:bg-emerald-200"
                    >
                      Mark shipped
                    </button>
                    <button
                      type="button"
                      onClick={hideSelectedChatsForAdmin}
                      className="rounded-xl border border-red-300 bg-red-100 px-3 py-2 text-xs font-semibold text-red-900 shadow-sm hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="max-h-[360px] divide-y divide-slate-800 overflow-y-auto">
              {threads.length === 0 ? (
                <div className="px-5 py-6 text-sm text-slate-400">No order chats yet.</div>
              ) : (
                threads.map((thread) => {
                  const active = selectedChatId === thread.id;
                  const checked = selectedBulkIds.includes(thread.id);

                  return (
                    <div
                      key={thread.id}
                      className={`flex items-start gap-3 px-5 py-4 transition ${
                        active ? "bg-white/10" : "bg-transparent hover:bg-white/5"
                      }`}
                    >
                      {isSelecting ? (
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleBulkSelection(thread.id)}
                          className="mt-1 h-4 w-4 rounded accent-slate-700"
                        />
                      ) : null}

                      <button
                        type="button"
                        onClick={() => setSelectedChatId(thread.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="truncate text-[15px] font-semibold text-white">
                            {getCustomerLabel(thread)}
                          </div>
                          <div className="shrink-0 text-xs text-slate-400">
                            {formatTime(thread.created_at)}
                          </div>
                        </div>

                        <div className="mt-1 truncate text-sm text-slate-300">
                          {thread.customer_note || `Order total ${money(thread.total_cents)}`}
                        </div>

                        <div className="mt-2 flex items-center gap-2 text-xs">
                          <span
                            className={`rounded-full px-2.5 py-1 font-semibold ${getStatusClasses(
                              thread.status
                            )}`}
                          >
                            {thread.status}
                          </span>
                          <span className="text-slate-500">
                            Order #{thread.id.slice(0, 8)}
                          </span>
                        </div>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-800 bg-white p-5 text-slate-900">
              {!selectedChatId ? (
                <div className="text-sm text-slate-600">Select a chat.</div>
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
                        Order #{selectedOrder.id.slice(0, 8)}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                            selectedOrder.status
                          )}`}
                        >
                          {selectedOrder.status}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatTime(selectedOrder.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={markCurrentAsShipped}
                        className="rounded-2xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        Mark shipped
                      </button>
                      <button
                        type="button"
                        onClick={closeChat}
                        className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <div className="mb-2 text-sm font-semibold">Order items</div>
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

                      <div className="mt-3 rounded-2xl border bg-slate-50 px-4 py-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span>Subtotal</span>
                          <span>{money(selectedOrder.subtotal_cents)}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span>Tax</span>
                          <span>{money(selectedOrder.tax_cents)}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span>Shipping</span>
                          <span>{money(selectedOrderShippingCents)}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between font-semibold">
                          <span>Total</span>
                          <span>{money(selectedOrder.total_cents)}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-sm font-semibold">Delivery address</div>
                      {renderAddress(selectedOrder.address_id)}
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 text-sm font-semibold">Conversation</div>

                    <div className="max-h-[300px] space-y-3 overflow-y-auto rounded-2xl border bg-slate-50 p-3">
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
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
