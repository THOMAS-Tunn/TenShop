import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "../components/Card";
import { useAppSettings } from "../lib/app-settings";
import type { SessionUser } from "../lib/auth";
import { useNotice } from "../lib/notices";
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
  const { copy, formatCurrency, formatDateTime, formatStatus, formatStoredMessage } =
    useAppSettings();
  const notice = useNotice();
  const common = copy.common;
  const page = copy.orderDetail;

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [addressMap, setAddressMap] = useState<Record<string, Address>>({});
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingChat, setDeletingChat] = useState(false);

  const shippingCents = useMemo(
    () => (order ? Math.max(0, order.total_cents - order.subtotal_cents - order.tax_cents) : 0),
    [order]
  );

  function getStatusClasses(status: string) {
    if (status === "pending") return "bg-amber-100 text-amber-800 border border-amber-200";
    if (status === "confirmed") return "bg-blue-100 text-blue-800 border border-blue-200";
    if (status === "packaging") return "bg-orange-100 text-orange-800 border border-orange-200";
    if (status === "shipped" || status === "out_for_delivery") {
      return "bg-cyan-100 text-cyan-800 border border-cyan-200";
    }
    if (status === "delivered") return "bg-emerald-100 text-emerald-800 border border-emerald-200";
    if (status === "cancelled") return "bg-red-100 text-red-800 border border-red-200";
    if (status === "archived") return "bg-slate-200 text-slate-800 border border-slate-300";
    return "bg-slate-100 text-slate-700 border border-slate-200";
  }

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
    for (const message of msgData ?? []) {
      if (message.address_id) addressIds.add(message.address_id);
    }

    if (addressIds.size > 0) {
      const { data: addresses } = await supabase
        .from("user_addresses")
        .select("*")
        .in("id", Array.from(addressIds));

      const nextMap: Record<string, Address> = {};
      for (const address of addresses ?? []) nextMap[address.id] = address as Address;
      setAddressMap(nextMap);
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
      notice.showError(error.message);
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
      notice.showError(error.message);
      return;
    }

    await loadAll();
  }

  async function deleteChat() {
    if (!id) return;

    const ok = await notice.confirm(page.deleteConfirm, {
      cancelLabel: common.cancel,
      confirmLabel: common.delete,
      variant: "error",
    });
    if (!ok) return;

    setDeletingChat(true);

    const { error: messageError } = await supabase.from("order_messages").delete().eq("order_id", id);

    if (messageError) {
      setDeletingChat(false);
      notice.showError(messageError.message);
      return;
    }

    const { error: itemError } = await supabase.from("order_items").delete().eq("order_id", id);

    if (itemError) {
      setDeletingChat(false);
      notice.showError(itemError.message);
      return;
    }

    const { error: orderError } = await supabase
      .from("orders")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    setDeletingChat(false);

    if (orderError) {
      notice.showError(orderError.message);
      return;
    }

    navigate("/chat");
  }

  function renderAddress(addressId: string | null | undefined) {
    if (!addressId) return null;
    const address = addressMap[addressId];
    if (!address) return null;

    return (
      <div className="rounded-2xl border bg-slate-50 px-4 py-3 text-sm">
        <div className="font-medium">{common.deliveryAddress}</div>
        <div className="mt-2">{address.recipient_name ?? common.noRecipient}</div>
        <div>{address.street_1}</div>
        {address.street_2 ? <div>{address.street_2}</div> : null}
        <div>
          {address.city}
          {address.state ? `, ${address.state}` : ""} {address.postal_code ?? ""}
        </div>
        <div>{address.country}</div>
        {address.delivery_notes ? (
          <div className="mt-2 text-slate-500">{common.notesValue(address.delivery_notes)}</div>
        ) : null}
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="text-sm font-semibold">{page.orderSummary}</div>
            {order ? (
              <div className="mt-3 text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <span>{common.status}:</span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                      order.status
                    )}`}
                  >
                    {formatStatus(order.status)}
                  </span>
                </div>
                <div className="mt-1">
                  {common.placed}: {formatDateTime(order.created_at)}
                </div>
                <div className="mt-4 space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <span>
                        {item.name} x {item.qty}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(item.price_cents * item.qty)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-2 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <span>{common.subtotal}</span>
                    <span>{formatCurrency(order.subtotal_cents)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{common.tax}</span>
                    <span>{formatCurrency(order.tax_cents)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{common.shipping}</span>
                    <span>{formatCurrency(shippingCents)}</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold">
                    <span>{common.total}</span>
                    <span>{formatCurrency(order.total_cents)}</span>
                  </div>
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="p-5">
            <div className="text-sm font-semibold">{page.selectedDeliveryAddress}</div>
            <div className="mt-3">{renderAddress(order?.address_id)}</div>
          </Card>
        </div>

        <Card className="p-5">
          <div className="text-sm font-semibold">{page.orderChat}</div>

          {order?.admin_deleted_at ? (
            <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4">
              <div className="text-sm font-semibold text-amber-900">{page.adminDeletedTitle}</div>
              <p className="mt-1 text-sm text-amber-800">{page.adminDeletedBody}</p>
              <button
                type="button"
                onClick={() => void deleteChat()}
                disabled={deletingChat}
                className="mt-3 rounded-2xl border border-red-300 bg-red-100 px-4 py-2 text-sm font-semibold text-red-900 hover:bg-red-200 disabled:opacity-60"
              >
                {deletingChat ? common.deleting : page.deleteThisChat}
              </button>
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-600">
                {page.noMessagesYet}
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="rounded-2xl border px-4 py-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold ${
                        message.sender_user_id === user.id
                          ? "bg-slate-200 text-slate-800"
                          : "bg-blue-100 text-blue-900"
                      }`}
                    >
                      {message.sender_user_id === user.id ? common.you : common.admin}
                    </span>
                    <span className="text-slate-600">{formatDateTime(message.created_at)}</span>
                  </div>

                  <div className="mt-2">
                    {message.message_type === "address" ? renderAddress(message.address_id) : null}
                    {message.message_type !== "address" ? (
                      <div className="text-sm text-slate-800">
                        {formatStoredMessage(message.message_type, message.body)}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-5">
            <div className="mb-2 flex flex-wrap gap-2">
              {savedAddresses.map((address) => (
                <button
                  key={address.id}
                  onClick={() => void sendAddress(address.id)}
                  className="rounded-full border px-3 py-2 text-xs hover:bg-slate-50"
                  title={page.sendAddressTitle}
                >
                  {page.addressChip(address.label ?? common.address)}
                </button>
              ))}
            </div>

            <form onSubmit={sendMessage} className="flex gap-2">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={page.typeMessage}
                className="w-full rounded-2xl border px-3 py-2 text-sm"
              />
              <button
                disabled={sending}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {sending ? common.sending : common.send}
              </button>
            </form>
          </div>
        </Card>
      </div>
    </main>
  );
}
