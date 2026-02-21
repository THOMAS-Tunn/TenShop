import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { SessionUser } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { Card } from "../components/Card";

type Item = {
  id: string;
  name: string;
  qty: number;
  is_done: boolean;
};

export function ListDetail({ user }: { user: SessionUser }) {
  const { id } = useParams();
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);

  async function load() {
    const { data } = await supabase
      .from("shopping_list_items")
      .select("id,name,qty,is_done")
      .eq("list_id", id!)
      .order("created_at", { ascending: true });
    setItems((data ?? []) as any);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function addItem() {
    if (!name.trim()) return;
    await supabase.from("shopping_list_items").insert({ list_id: id, user_id: user.id, name, qty });
    setName("");
    setQty(1);
    load();
  }

  async function toggle(item: Item) {
    await supabase.from("shopping_list_items").update({ is_done: !item.is_done }).eq("id", item.id);
    load();
  }

  async function remove(item: Item) {
    await supabase.from("shopping_list_items").delete().eq("id", item.id);
    load();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">List</h1>
      <p className="text-sm text-slate-600">Private to you (RLS policy in SQL script).</p>

      <Card className="mt-5 p-5">
        <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-2xl border px-3 py-2 text-sm"
            placeholder="Add item (e.g., bananas)"
          />
          <input
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value || 1)))}
            type="number"
            className="rounded-2xl border px-3 py-2 text-sm"
            min={1}
          />
          <button
            onClick={addItem}
            className="rounded-2xl bg-slate-900 px-3 py-2 text-sm text-white hover:opacity-90"
          >
            Add
          </button>
        </div>
      </Card>

      <div className="mt-5 space-y-2">
        {items.map((it) => (
          <Card key={it.id} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <button
                className="flex items-center gap-3 text-left"
                onClick={() => toggle(it)}
                title="Toggle done"
              >
                <div className={"h-6 w-6 rounded-xl border " + (it.is_done ? "bg-slate-900" : "bg-white")} />
                <div>
                  <div className={"text-sm font-medium " + (it.is_done ? "line-through text-slate-500" : "")}>
                    {it.name}
                  </div>
                  <div className="text-xs text-slate-500">Qty: {it.qty}</div>
                </div>
              </button>
              <button
                className="rounded-2xl border px-3 py-2 text-sm hover:bg-slate-50"
                onClick={() => remove(it)}
              >
                Remove
              </button>
            </div>
          </Card>
        ))}
        {items.length === 0 ? <div className="text-sm text-slate-600">No items yet.</div> : null}
      </div>
    </main>
  );
}
