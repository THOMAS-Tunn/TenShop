import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/Card";
import type { SessionUser } from "../lib/auth";
import { supabase } from "../lib/supabase";

type OrderRow = {
  id: string;
  user_id: string;
  status: string;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  customer_note: string | null;
  created_at: string;
};

type OrderMessage = {
  id: string;
  order_id: string;
  sender_user_id: string;
  message_type: "text" | "address" | "system";
  body: string | null;
  created_at: string;
};

export function Chat({ user }: { user: SessionUser }) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [lastMessageMap, setLastMessageMap] = useState<Record<string, OrderMessage | null>>({});
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  function getStatusClasses(status: string) {
    if (status === "pending") {
      return "bg-amber-100 text-amber-800 border border-amber-200";
    }

    if (status === "confirmed") {
      return "bg-blue-100 text-blue-800 border border-blue-200";
    }

    if (status === "shipped" || status === "out_for_delivery") {
      return "bg-emerald-100 text-emerald-800 border border-emerald-200";
    }

    if (status === "delivered") {
      return "bg-slate-200 text-slate-800 border border-slate-300";
    }

    if (status === "cancelled") {
      return "bg-red-100 text-red-800 border border-red-200";
    }

    return "bg-slate-100 text-slate-700 border border-slate-200";
  }

  function getPreview(order: OrderRow) {
    const lastMessage = lastMessageMap[order.id];

    if (!lastMessage) {
      return order.customer_note?.trim() || "Order request created.";
    }

    if (lastMessage.message_type === "address") {
      return "Delivery address shared";
    }

    return lastMessage.body?.trim() || "New update";
  }

  async function loadChats() {
    setLoading(true);

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("id,user_id,status,subtotal_cents,tax_cents,total_cents,customer_note,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (orderError) {
      alert(orderError.message);
      setLoading(false);
      return;
    }

    const nextOrders = (orderData ?? []) as OrderRow[];
    setOrders(nextOrders);

    if (nextOrders.length === 0) {
      setLastMessageMap({});
      setLoading(false);
      return;
    }

    const orderIds = nextOrders.map((order) => order.id);

    const { data: messageData, error: messageError } = await supabase
      .from("order_messages")
      .select("id,order_id,sender_user_id,message_type,body,created_at")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false });

    if (messageError) {
      alert(messageError.message);
      setLoading(false);
      return;
    }

    const nextMap: Record<string, OrderMessage | null> = {};
    for (const order of nextOrders) {
      nextMap[order.id] = null;
    }

    for (const msg of (messageData ?? []) as OrderMessage[]) {
      if (!nextMap[msg.order_id]) {
        nextMap[msg.order_id] = msg;
      }
    }

    setLastMessageMap(nextMap);
    setLoading(false);
  }

  async function deleteChat(orderId: string) {
    const ok = window.confirm("Are you sure you want to delete this chat?");
    if (!ok) return;

    setDeletingId(orderId);

    const { error: messageError } = await supabase
      .from("order_messages")
      .delete()
      .eq("order_id", orderId);

    if (messageError) {
      setDeletingId(null);
      alert(messageError.message);
      return;
    }

    const { error: itemError } = await supabase
      .from("order_items")
      .delete()
      .eq("order_id", orderId);

    if (itemError) {
      setDeletingId(null);
      alert(itemError.message);
      return;
    }

    const { error: orderError } = await supabase
      .from("orders")
      .delete()
      .eq("id", orderId)
      .eq("user_id", user.id);

    setDeletingId(null);

    if (orderError) {
      alert(orderError.message);
      return;
    }

    await loadChats();
  }

  useEffect(() => {
    void loadChats();

    const channel = supabase
      .channel(`customer-chats-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          void loadChats();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_messages" },
        () => {
          void loadChats();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user.id]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Chat</h1>
          <p className="mt-1 text-sm text-slate-600">
            View your order chats and delete older ones.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {loading ? (
          <Card className="p-5">
            <div className="text-sm text-slate-600">Loading chats...</div>
          </Card>
        ) : orders.length === 0 ? (
          <Card className="p-5">
            <div className="text-sm font-medium text-slate-900">No chats yet</div>
            <p className="mt-2 text-sm text-slate-600">
              Once you send an order request, it will appear here.
            </p>
          </Card>
        ) : (
          orders.map((order) => (
            <Card key={order.id} className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-base font-semibold text-slate-900">
                      Order #{order.id.slice(0, 8)}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClasses(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>
                  </div>

                  <div className="mt-2 text-sm text-slate-500">
                    Created {formatTime(order.created_at)}
                  </div>

                  <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {getPreview(order)}
                  </div>

                  <div className="mt-3 text-sm text-slate-700">
                    Total: <span className="font-semibold">{money(order.total_cents)}</span>
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  <Link
                    to={`/orders/${order.id}`}
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white hover:opacity-90"
                  >
                    Open chat
                  </Link>

                  <button
                    type="button"
                    onClick={() => deleteChat(order.id)}
                    disabled={deletingId === order.id}
                    className="rounded-2xl border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 hover:bg-red-100 disabled:opacity-60"
                  >
                    {deletingId === order.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </main>
  );
}
