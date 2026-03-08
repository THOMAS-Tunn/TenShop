import { useEffect, useState } from "react";
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

export function Admin() {
  const [items, setItems] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number>(1);

  async function load() {
    const { data } = await supabase.from("products").select("*").order("name");
    setItems((data ?? []) as Product[]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();

    await supabase.from("products").insert({
      name,
      price_cents: Math.round(price * 100),
      in_stock: true,
    });

    setName("");
    setPrice(1);
    await load();
  }

  async function deleteItem(id: string) {
    await supabase.from("products").delete().eq("id", id);
    await load();
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
            Admin Dashboard
          </h1>
          <p className="mt-3 text-slate-600">
            Manage your product catalog, add new items, and remove products that
            are no longer available.
          </p>

          <Card className="mt-6 p-6">
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
        </div>

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
                      ${(item.price_cents / 100).toFixed(2)} •{" "}
                      {item.in_stock ? "In stock" : "Out of stock"}
                    </div>
                  </div>

                  <button
                    onClick={() => deleteItem(item.id)}
                    className="shrink-0 rounded-2xl border px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-xs text-slate-600">
            Tip: keep admin actions visually simple and consistent with the
            storefront so the app feels cohesive.
          </div>
        </Card>
      </div>
    </main>
  );
}
