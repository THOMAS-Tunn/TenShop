import { useEffect, useState } from "react";
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
  const [price, setPrice] = useState<number>(100);

  async function load() {
    const { data } = await supabase.from("products").select("*");
    setItems((data ?? []) as Product[]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();

    await supabase.from("products").insert({
      name,
      price_cents: price,
      in_stock: true,
    });

    setName("");
    setPrice(100);
    await load();
  }

  async function deleteItem(id: string) {
    await supabase.from("products").delete().eq("id", id);
    await load();
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Admin Dashboard</h1>

      <form onSubmit={addItem}>
        <input
          placeholder="Product name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          required
        />
        <button type="submit">Add</button>
      </form>

      <hr />

      {items.map((item) => (
        <div key={item.id} style={{ marginBottom: 10 }}>
          {item.name} — ${(item.price_cents / 100).toFixed(2)}
          <button onClick={() => deleteItem(item.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}