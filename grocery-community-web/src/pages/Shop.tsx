import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/Card";
import { useAppSettings } from "../lib/app-settings";
import type { SessionUser } from "../lib/auth";
import { useNotice } from "../lib/notices";
import { supabase } from "../lib/supabase";

type Product = {
  id: string;
  name: string;
  price_cents: number;
  image_url: string | null;
  category: string | null;
  description: string | null;
  properties: string[] | null;
};

type List = {
  id: string;
  name: string;
  created_at: string;
};

type ListItem = {
  id: string;
  name: string;
  qty: number;
  price_cents: number;
};

type PendingItemAction = {
  id: string;
  action: "inc" | "dec" | "remove";
};

export function Shop({ user }: { user: SessionUser }) {
  const { copy, formatCurrency, formatDateTime } = useAppSettings();
  const notice = useNotice();
  const common = copy.common;
  const shop = copy.shop;

  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [lists, setLists] = useState<List[]>([]);
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [listName, setListName] = useState(shop.defaultCartName);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [deletingListId, setDeletingListId] = useState<string | null>(null);
  const [pendingItemAction, setPendingItemAction] = useState<PendingItemAction | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    supabase
      .from("products")
      .select("*")
      .order("name")
      .then(({ data, error }) => {
        if (error) console.error(error);
        setProducts((data ?? []) as Product[]);
      });
  }, []);

  async function loadLists() {
    const { data, error } = await supabase
      .from("shopping_lists")
      .select("id,name,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setLists([]);
      return [] as List[];
    }

    const next = (data ?? []) as List[];
    setLists(next);

    if (next.length === 0) {
      setSelectedListId(null);
      return next;
    }

    setSelectedListId((current) => {
      if (current && next.some((list) => list.id === current)) return current;
      return next[0].id;
    });

    return next;
  }

  async function loadListItems(listId: string | null) {
    if (!listId) {
      setListItems([]);
      return;
    }

    const { data, error } = await supabase
      .from("shopping_list_items")
      .select("id,name,qty,price_cents")
      .eq("list_id", listId)
      .eq("user_id", user.id)
      .order("name");

    if (error) {
      console.error(error);
      setListItems([]);
      return;
    }

    setListItems((data ?? []) as ListItem[]);
  }

  useEffect(() => {
    void loadLists();
  }, []);

  useEffect(() => {
    void loadListItems(selectedListId);
  }, [selectedListId]);

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return products;

    return products.filter((product) => {
      const haystack = [
        product.name,
        product.category ?? "",
        product.description ?? "",
        (product.properties ?? []).join(" "),
        (product.price_cents / 100).toFixed(2),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [products, productSearch]);

  async function createList() {
    setBusy(true);
    const { data, error } = await supabase
      .from("shopping_lists")
      .insert({ user_id: user.id, name: listName })
      .select("id")
      .single();
    setBusy(false);

    if (error) {
      notice.showError(error.message);
      return;
    }

    await loadLists();
    if (data?.id) setSelectedListId(data.id);
  }

  async function deleteList(listId: string) {
    const target = lists.find((list) => list.id === listId);
    const ok = window.confirm(shop.deleteCartConfirm(target?.name ?? shop.selectedCartFallback));
    if (!ok) return;

    setDeletingListId(listId);

    const { error: itemsError } = await supabase
      .from("shopping_list_items")
      .delete()
      .eq("list_id", listId)
      .eq("user_id", user.id);

    if (itemsError) {
      setDeletingListId(null);
      notice.showError(itemsError.message);
      return;
    }

    const { error: listError } = await supabase
      .from("shopping_lists")
      .delete()
      .eq("id", listId)
      .eq("user_id", user.id);

    setDeletingListId(null);

    if (listError) {
      notice.showError(listError.message);
      return;
    }

    const nextLists = await loadLists();
    if (!nextLists.some((list) => list.id === listId) && selectedListId === listId) {
      setSelectedListId(nextLists[0]?.id ?? null);
    }
  }

  async function updateListItemQty(item: ListItem, nextQty: number) {
    if (nextQty <= 0) {
      await removeListItem(item.id);
      return;
    }

    const previousItems = listItems;
    setPendingItemAction({ id: item.id, action: nextQty > item.qty ? "inc" : "dec" });
    setListItems((current) =>
      current.map((entry) => (entry.id === item.id ? { ...entry, qty: nextQty } : entry))
    );

    const { error } = await supabase
      .from("shopping_list_items")
      .update({ qty: nextQty })
      .eq("id", item.id)
      .eq("user_id", user.id);

    setPendingItemAction(null);

    if (error) {
      setListItems(previousItems);
      notice.showError(error.message);
    }
  }

  async function removeListItem(itemId: string) {
    const previousItems = listItems;
    setPendingItemAction({ id: itemId, action: "remove" });
    setListItems((current) => current.filter((entry) => entry.id !== itemId));

    const { error } = await supabase
      .from("shopping_list_items")
      .delete()
      .eq("id", itemId)
      .eq("user_id", user.id);

    setPendingItemAction(null);

    if (error) {
      setListItems(previousItems);
      notice.showError(error.message);
    }
  }

  async function addProductToList(product: Product) {
    if (!selectedListId) {
      notice.showWarning(shop.createOrSelectCartFirst);
      return;
    }

    setAddingId(product.id);

    const { data: existing, error: readErr } = await supabase
      .from("shopping_list_items")
      .select("id, qty")
      .eq("list_id", selectedListId)
      .eq("user_id", user.id)
      .eq("name", product.name)
      .maybeSingle();

    if (readErr) {
      setAddingId(null);
      notice.showError(readErr.message);
      return;
    }

    if (existing?.id) {
      const { error: updErr } = await supabase
        .from("shopping_list_items")
        .update({ qty: (existing.qty ?? 1) + 1 })
        .eq("id", existing.id);

      setAddingId(null);
      if (updErr) {
        notice.showError(updErr.message);
        return;
      }

      await loadListItems(selectedListId);
      return;
    }

    const { error: insErr } = await supabase.from("shopping_list_items").insert({
      list_id: selectedListId,
      user_id: user.id,
      product_id: product.id,
      name: product.name,
      price_cents: product.price_cents,
      qty: 1,
    });

    setAddingId(null);
    if (insErr) {
      notice.showError(insErr.message);
      return;
    }

    await loadListItems(selectedListId);
  }

  const selectedList = lists.find((list) => list.id === selectedListId) ?? null;
  const selectedListTotal = listItems.reduce((sum, item) => sum + item.price_cents * item.qty, 0);

  return (
    <>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold">{shop.title}</h1>
                <p className="text-sm text-slate-600">{shop.subtitle}</p>
              </div>
              <div className="text-xs text-slate-500">
                {common.shownCount(filteredProducts.length, products.length)}
              </div>
            </div>

            <div className="mb-4">
              <input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder={shop.searchPlaceholder}
                className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none transition focus:border-slate-400"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.length === 0 ? (
                <Card className="p-5 text-sm text-slate-600 sm:col-span-2 lg:col-span-3">
                  {shop.noProductsAvailable}
                </Card>
              ) : filteredProducts.length === 0 ? (
                <Card className="p-5 text-sm text-slate-600 sm:col-span-2 lg:col-span-3">
                  {shop.noProductsMatch}
                </Card>
              ) : (
                filteredProducts.map((product) => (
                  <Card
                    key={product.id}
                    className="cursor-pointer p-4 transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(product)}
                      className="w-full text-left"
                    >
                      <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-slate-100">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-full w-full rounded-2xl object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-slate-400">
                            {common.noImage}
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{product.name}</div>
                          <div className="text-xs text-slate-500">
                            {product.category ?? shop.itemDetails}
                          </div>
                        </div>
                        <div className="text-sm font-semibold">
                          {formatCurrency(product.price_cents)}
                        </div>
                      </div>

                      {product.properties?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {product.properties.slice(0, 3).map((property) => (
                            <span
                              key={property}
                              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                            >
                              {property}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </button>

                    <button
                      disabled={addingId === product.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        void addProductToList(product);
                      }}
                      className="mt-3 w-full rounded-2xl bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
                    >
                      {addingId === product.id ? common.adding : shop.addToCart}
                    </button>

                    {selectedListId ? (
                      <div className="mt-2 text-xs text-slate-500">
                        {shop.addsTo}{" "}
                        <span className="font-medium">
                          {lists.find((list) => list.id === selectedListId)?.name ??
                            shop.selectedCartFallback}
                        </span>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-slate-500">{shop.createCartToStart}</div>
                    )}
                  </Card>
                ))
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <Card className="p-5">
              <div className="text-sm font-semibold">{shop.yourCarts}</div>

              <div className="mt-3">
                <div className="text-xs font-medium text-slate-600">{shop.selectedCart}</div>
                <select
                  value={selectedListId ?? ""}
                  onChange={(e) => setSelectedListId(e.target.value)}
                  className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm"
                >
                  <option value="" disabled>
                    {shop.selectACart}
                  </option>
                  {lists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  className="w-full rounded-2xl border px-3 py-2 text-sm"
                  placeholder={shop.cartName}
                />
                <button
                  disabled={busy}
                  onClick={() => void createList()}
                  className="rounded-2xl bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
                >
                  {common.add}
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {lists.length === 0 ? (
                  <div className="text-sm text-slate-600">{shop.noCartsYet}</div>
                ) : (
                  lists.map((list) => {
                    const isSelected = list.id === selectedListId;

                    return (
                      <div
                        key={list.id}
                        className={`rounded-2xl border px-3 py-3 transition ${
                          isSelected ? "border-slate-900 bg-slate-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedListId(list.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="font-medium">{list.name}</div>
                            <div className="text-xs text-slate-500">
                              {formatDateTime(list.created_at)}
                            </div>
                          </button>

                          <button
                            type="button"
                            aria-label={common.deleteCartAria(list.name)}
                            title={shop.deleteCartTitle}
                            disabled={deletingListId === list.id}
                            onClick={() => void deleteList(list.id)}
                            className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="h-4 w-4"
                            >
                              <path
                                fillRule="evenodd"
                                d="M9 3.75A2.25 2.25 0 0 1 11.25 1.5h1.5A2.25 2.25 0 0 1 15 3.75V4.5h3.75a.75.75 0 0 1 0 1.5h-.52l-.76 12.1A2.25 2.25 0 0 1 15.22 20.25H8.78a2.25 2.25 0 0 1-2.25-2.15L5.77 6H5.25a.75.75 0 0 1 0-1.5H9v-.75ZM10.5 4.5h3v-.75a.75.75 0 0 0-.75-.75h-1.5a.75.75 0 0 0-.75.75v.75ZM9.75 9a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-1.5 0v-6A.75.75 0 0 1 9.75 9Zm4.5 0a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 1 .75-.75Z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </div>

                        <Link
                          to={`/carts/${list.id}`}
                          className="mt-3 inline-flex text-xs font-medium text-slate-600 underline-offset-2 hover:underline"
                        >
                          {shop.openFullCart}
                        </Link>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{shop.cartItems}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {selectedList ? selectedList.name : shop.chooseCartToView}
                  </div>
                </div>
                {selectedList ? (
                  <div className="text-sm font-semibold text-slate-900">
                    {formatCurrency(selectedListTotal)}
                  </div>
                ) : null}
              </div>

              {!selectedList ? (
                <div className="mt-4 text-sm text-slate-600">{shop.noCartSelected}</div>
              ) : listItems.length === 0 ? (
                <div className="mt-4 text-sm text-slate-600">{shop.cartIsEmpty}</div>
              ) : (
                <div className="mt-4 space-y-3">
                  {listItems.map((item) => {
                    const isPending = pendingItemAction?.id === item.id;

                    return (
                      <div key={item.id} className="rounded-2xl border border-slate-200 px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-900">
                              {item.name}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {formatCurrency(item.price_cents)} {shop.each}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-slate-900">
                              {formatCurrency(item.price_cents * item.qty)}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">{shop.inCart(item.qty)}</div>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white">
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => void updateListItemQty(item, item.qty - 1)}
                              className="px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                            >
                              -
                            </button>
                            <div className="min-w-[3rem] px-3 text-center text-sm font-semibold text-slate-900">
                              {item.qty}
                            </div>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => void updateListItemQty(item, item.qty + 1)}
                              className="px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            aria-label={common.removeItemAria(item.name)}
                            title={copy.cartDetail.remove}
                            disabled={isPending}
                            onClick={() => void removeListItem(item.id)}
                            className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="h-4 w-4"
                            >
                              <path
                                fillRule="evenodd"
                                d="M9 3.75A2.25 2.25 0 0 1 11.25 1.5h1.5A2.25 2.25 0 0 1 15 3.75V4.5h3.75a.75.75 0 0 1 0 1.5h-.52l-.76 12.1A2.25 2.25 0 0 1 15.22 20.25H8.78a2.25 2.25 0 0 1-2.25-2.15L5.77 6H5.25a.75.75 0 0 1 0-1.5H9v-.75ZM10.5 4.5h3v-.75a.75.75 0 0 0-.75-.75h-1.5a.75.75 0 0 0-.75.75v.75ZM9.75 9a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-1.5 0v-6A.75.75 0 0 1 9.75 9Zm4.5 0a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 1 .75-.75Z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </aside>
        </div>
      </main>

      {selectedProduct ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">{selectedProduct.name}</h2>
                <div className="mt-2 text-lg font-semibold text-slate-900">
                  {formatCurrency(selectedProduct.price_cents)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                {shop.close}
              </button>
            </div>

            <div className="mt-5 grid gap-6 md:grid-cols-[1.05fr_0.95fr]">
              <div className="overflow-hidden rounded-3xl bg-slate-100">
                {selectedProduct.image_url ? (
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-400">
                    {common.noImageAvailable}
                  </div>
                )}
              </div>

              <div>
                {selectedProduct.properties?.length ? (
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{common.properties}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedProduct.properties.map((property) => (
                        <span
                          key={property}
                          className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700"
                        >
                          {property}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 text-sm font-semibold text-slate-900">{common.description}</div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                  {selectedProduct.description?.trim() || common.noDescriptionYet}
                </p>

                <button
                  type="button"
                  disabled={addingId === selectedProduct.id}
                  onClick={() => void addProductToList(selectedProduct)}
                  className="mt-6 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white disabled:opacity-60"
                >
                  {addingId === selectedProduct.id ? common.adding : shop.addToCart}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
