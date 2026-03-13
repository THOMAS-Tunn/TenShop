import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "../components/Card";
import { useAppSettings } from "../lib/app-settings";
import type { SessionUser } from "../lib/auth";
import { useNotice } from "../lib/notices";
import { supabase } from "../lib/supabase";

type ShoppingList = {
  id: string;
  name: string;
  created_at: string;
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
  phone: string | null;
  street_1: string;
  street_2: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
  delivery_notes: string | null;
  is_default: boolean;
};

type PendingItemAction = {
  id: string;
  action: "inc" | "dec" | "remove";
};

const SHIPPING_FEE_CENTS = 499;

export function Cart({ user }: { user: SessionUser }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { copy, formatCurrency, formatDateTime } = useAppSettings();
  const notice = useNotice();
  const common = copy.common;
  const shop = copy.shop;
  const page = copy.cartDetail;
  const selectedListId = searchParams.get("selected");

  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [listItems, setListItems] = useState<CartItem[]>([]);
  const [listName, setListName] = useState(shop.defaultCartName);
  const [creatingList, setCreatingList] = useState(false);
  const [cartSearch, setCartSearch] = useState("");
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [pendingItemAction, setPendingItemAction] = useState<PendingItemAction | null>(null);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [productImageById, setProductImageById] = useState<Record<string, string>>({});
  const [productImageByName, setProductImageByName] = useState<Record<string, string>>({});

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);

  function updateSelectedCart(listId: string | null) {
    const nextParams = new URLSearchParams(searchParams);

    if (listId) nextParams.set("selected", listId);
    else nextParams.delete("selected");

    setSearchParams(nextParams, { replace: true });
  }

  function mergeProductImages(products: Array<Pick<Product, "id" | "name" | "image_url">>) {
    setProductImageById((current) => {
      const next = { ...current };
      for (const product of products) {
        if (product.image_url) {
          next[product.id] = product.image_url;
        }
      }
      return next;
    });

    setProductImageByName((current) => {
      const next = { ...current };
      for (const product of products) {
        if (product.image_url && !(product.name in next)) {
          next[product.name] = product.image_url;
        }
      }
      return next;
    });
  }

  async function syncItemImages(items: Array<Pick<CartItem, "product_id" | "name">>) {
    const missingIds = Array.from(
      new Set(items.map((item) => item.product_id).filter((id): id is string => !!id && !productImageById[id]))
    );
    const missingNames = Array.from(
      new Set(
        items
          .map((item) => item.name.trim())
          .filter((name) => !!name && !(name in productImageByName))
      )
    );

    const productRows: Array<Pick<Product, "id" | "name" | "image_url">> = [];

    if (missingIds.length > 0) {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,image_url")
        .in("id", missingIds);

      if (!error) {
        productRows.push(...((data ?? []) as Array<Pick<Product, "id" | "name" | "image_url">>));
      }
    }

    if (missingNames.length > 0) {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,image_url")
        .in("name", missingNames);

      if (!error) {
        productRows.push(...((data ?? []) as Array<Pick<Product, "id" | "name" | "image_url">>));
      }
    }

    if (productRows.length > 0) {
      mergeProductImages(productRows);
    }
  }

  function getItemImageUrl(item: Pick<CartItem, "product_id" | "name">) {
    if (item.product_id && productImageById[item.product_id]) {
      return productImageById[item.product_id];
    }

    return productImageByName[item.name] ?? null;
  }

  async function loadLists() {
    setLoadingLists(true);

    const { data, error } = await supabase
      .from("shopping_lists")
      .select("id,name,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setLoadingLists(false);
      notice.showError(error.message);
      setLists([]);
      return [];
    }

    const next = (data ?? []) as ShoppingList[];
    setLists(next);
    setLoadingLists(false);

    if (selectedListId && !next.some((list) => list.id === selectedListId)) {
      updateSelectedCart(null);
    }

    return next;
  }

  async function loadListItems(listId: string | null) {
    if (!listId) {
      setListItems([]);
      setLoadingItems(false);
      return;
    }

    setLoadingItems(true);

    const { data, error } = await supabase
      .from("shopping_list_items")
      .select("id,list_id,user_id,product_id,name,price_cents,qty")
      .eq("list_id", listId)
      .eq("user_id", user.id)
      .order("name");

    if (error) {
      setLoadingItems(false);
      notice.showError(error.message);
      setListItems([]);
      return;
    }

    const nextItems = (data ?? []) as CartItem[];
    setListItems(nextItems);
    await syncItemImages(nextItems);
    setLoadingItems(false);
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

    setSelectedAddressId((current) => {
      if (current && next.some((address) => address.id === current)) return current;
      const defaultAddress = next.find((address) => address.is_default);
      return defaultAddress?.id ?? next[0]?.id ?? "";
    });
  }

  useEffect(() => {
    void loadLists();
    void loadAddresses();
  }, [user.id]);

  useEffect(() => {
    void loadListItems(selectedListId);
    setQ("");
    setResults([]);
    setCustomerNote("");
  }, [selectedListId, user.id]);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);

      const { data, error } = await supabase
        .from("products")
        .select("id,name,price_cents,category,image_url")
        .ilike("name", `%${q.trim()}%`)
        .order("name")
        .limit(8);

      if (error) {
        notice.showError(error.message);
        setSearching(false);
        return;
      }

      const nextResults = (data ?? []) as Product[];
      setResults(nextResults);
      mergeProductImages(nextResults);
      setSearching(false);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [notice, q]);

  const filteredLists = useMemo(() => {
    const query = cartSearch.trim().toLowerCase();
    if (!query) return lists;

    return lists.filter((list) => list.name.toLowerCase().includes(query));
  }, [cartSearch, lists]);

  const selectedList = lists.find((list) => list.id === selectedListId) ?? null;
  const subtotalCents = useMemo(
    () => listItems.reduce((sum, item) => sum + (item.price_cents ?? 0) * item.qty, 0),
    [listItems]
  );
  const selectedItemCount = useMemo(
    () => listItems.reduce((sum, item) => sum + item.qty, 0),
    [listItems]
  );
  const taxCents = Math.round(subtotalCents * 0.09);
  const shippingCents = listItems.length > 0 ? SHIPPING_FEE_CENTS : 0;
  const totalCents = subtotalCents + taxCents + shippingCents;

  function renderAddress(addressId: string | null | undefined) {
    if (!addressId) return null;

    const address = addresses.find((entry) => entry.id === addressId);
    if (!address) return null;

    return (
      <div className="rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <div className="font-medium text-slate-900">
          {address.label ?? common.deliveryAddress}
        </div>
        <div className="mt-2">{address.recipient_name ?? common.noRecipient}</div>
        <div>{address.street_1}</div>
        {address.street_2 ? <div>{address.street_2}</div> : null}
        <div>
          {address.city}
          {address.state ? `, ${address.state}` : ""} {address.postal_code ?? ""}
        </div>
        <div>{address.country}</div>
        {address.phone ? <div className="mt-2">{common.phoneValue(address.phone)}</div> : null}
        {address.delivery_notes ? (
          <div className="mt-2 text-slate-500">{common.notesValue(address.delivery_notes)}</div>
        ) : null}
      </div>
    );
  }

  async function createList() {
    const nextName = listName.trim() || shop.defaultCartName;
    setCreatingList(true);

    const { data, error } = await supabase
      .from("shopping_lists")
      .insert({ user_id: user.id, name: nextName })
      .select("id")
      .single();

    setCreatingList(false);

    if (error) {
      notice.showError(error.message);
      return;
    }

    setListName(shop.defaultCartName);
    await loadLists();

    if (data?.id) {
      updateSelectedCart(data.id);
    }
  }

  function startSelecting() {
    setIsSelecting(true);
    setSelectedBulkIds([]);
  }

  function cancelSelecting() {
    setIsSelecting(false);
    setSelectedBulkIds([]);
  }

  function toggleBulkSelection(listId: string) {
    setSelectedBulkIds((prev) =>
      prev.includes(listId) ? prev.filter((id) => id !== listId) : [...prev, listId]
    );
  }

  async function deleteSelectedLists() {
    if (selectedBulkIds.length === 0) {
      notice.showWarning(shop.selectCartFirst);
      return;
    }

    const idsToDelete = [...selectedBulkIds];
    const ok = await notice.confirm(shop.confirmDeleteSelectedCarts(idsToDelete.length), {
      cancelLabel: common.cancel,
      confirmLabel: common.delete,
      variant: "error",
    });
    if (!ok) return;

    setDeletingSelected(true);

    const { error: itemsError } = await supabase
      .from("shopping_list_items")
      .delete()
      .in("list_id", idsToDelete)
      .eq("user_id", user.id);

    if (itemsError) {
      setDeletingSelected(false);
      notice.showError(itemsError.message);
      return;
    }

    const { error: listsError } = await supabase
      .from("shopping_lists")
      .delete()
      .in("id", idsToDelete)
      .eq("user_id", user.id);

    setDeletingSelected(false);

    if (listsError) {
      notice.showError(listsError.message);
      return;
    }

    if (selectedListId && idsToDelete.includes(selectedListId)) {
      updateSelectedCart(null);
    }

    cancelSelecting();
    await loadLists();
  }

  async function addProduct(product: Product) {
    if (!selectedListId) {
      notice.showWarning(shop.selectCartFirst);
      return;
    }

    setAddingId(product.id);

    const { data: existing, error: readErr } = await supabase
      .from("shopping_list_items")
      .select("id, qty")
      .eq("list_id", selectedListId)
      .eq("user_id", user.id)
      .eq("product_id", product.id)
      .maybeSingle();

    if (readErr) {
      setAddingId(null);
      notice.showError(readErr.message);
      return;
    }

    if (existing?.id) {
      const nextQty = (existing.qty ?? 1) + 1;

      setListItems((prev) =>
        prev.map((item) => (item.id === existing.id ? { ...item, qty: nextQty } : item))
      );

      const { error: updateError } = await supabase
        .from("shopping_list_items")
        .update({ qty: nextQty })
        .eq("id", existing.id)
        .eq("user_id", user.id);

      setAddingId(null);

      if (updateError) {
        notice.showError(updateError.message);
        await loadListItems(selectedListId);
      }

      return;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("shopping_list_items")
      .insert({
        list_id: selectedListId,
        user_id: user.id,
        product_id: product.id,
        name: product.name,
        price_cents: product.price_cents,
        qty: 1,
      })
      .select("id,list_id,user_id,product_id,name,price_cents,qty")
      .single();

    setAddingId(null);

    if (insertError) {
      notice.showError(insertError.message);
      return;
    }

    mergeProductImages([product]);
    setListItems((prev) =>
      [...prev, inserted as CartItem].sort((left, right) => left.name.localeCompare(right.name))
    );
  }

  async function removeItem(itemId: string) {
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

  async function updateListItemQty(item: CartItem, nextQty: number) {
    if (nextQty <= 0) {
      await removeItem(item.id);
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

  async function submitOrder() {
    if (!selectedListId) return;

    if (listItems.length === 0) {
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
        list_id: selectedListId,
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

    const orderItemsPayload = listItems.map((item) => ({
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
        body: `order_created:${listItems.length}`,
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

  function renderListPanel({ mobile = false }: { mobile?: boolean } = {}) {
    return (
      <Card
        className={clsx(
          "flex flex-col overflow-hidden p-0",
          mobile
            ? "min-h-[calc(100vh-11rem)]"
            : "h-[calc(100vh-12rem)] min-h-[620px] max-h-[860px]"
        )}
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-900">{shop.yourCarts}</div>
              <div className="mt-1 text-sm text-slate-600">{shop.chooseCartToView}</div>
            </div>

            {!isSelecting ? (
              <button
                type="button"
                onClick={startSelecting}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {copy.admin.select}
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={cancelSelecting}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {common.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => void deleteSelectedLists()}
                  disabled={deletingSelected}
                  className="rounded-2xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                >
                  {deletingSelected ? common.deleting : common.delete}
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <input
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
              placeholder={shop.cartName}
            />
            <button
              type="button"
              disabled={creatingList}
              onClick={() => void createList()}
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {creatingList ? common.working : common.add}
            </button>
          </div>

          <div className="mt-4">
            <input
              value={cartSearch}
              onChange={(e) => setCartSearch(e.target.value)}
              placeholder={shop.searchCartsPlaceholder}
              className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none transition focus:border-slate-400"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingLists ? (
            <div className="flex h-full items-center justify-center px-6 text-sm text-slate-600">
              {common.loading}
            </div>
          ) : lists.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-600">
              {shop.noCartsYet}
            </div>
          ) : filteredLists.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-600">
              {shop.noCartsMatch}
            </div>
          ) : (
            filteredLists.map((list) => {
              const isActive = selectedListId === list.id;
              const isChecked = selectedBulkIds.includes(list.id);

              return (
                <div
                  key={list.id}
                  className={clsx(
                    "flex items-start gap-3 border-b border-slate-200 px-5 py-4 transition",
                    isActive ? "bg-slate-100" : "bg-transparent hover:bg-slate-50"
                  )}
                >
                  {isSelecting ? (
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleBulkSelection(list.id)}
                      className="mt-1 h-4 w-4 rounded accent-slate-700"
                    />
                  ) : null}

                  <button
                    type="button"
                    onClick={() => {
                      if (isSelecting) {
                        toggleBulkSelection(list.id);
                        return;
                      }

                      updateSelectedCart(list.id);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate text-[15px] font-semibold text-slate-900">
                        {list.name}
                      </div>
                      <div className="shrink-0 text-xs text-slate-500">
                        {formatDateTime(list.created_at)}
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      {isActive ? (
                        <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">
                          {shop.selectedCart}
                        </span>
                      ) : null}
                      <span className="text-slate-500">
                        {common.placed}: {formatDateTime(list.created_at)}
                      </span>
                    </div>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </Card>
    );
  }

  function renderSelectedCartContent({ mobile = false }: { mobile?: boolean } = {}) {
    if (!selectedList) {
      if (!mobile) return null;

      return (
        <Card className="flex min-h-[calc(100vh-11rem)] items-center justify-center p-6 text-center">
          <div className="max-w-sm text-sm text-slate-600">{shop.chooseCartToView}</div>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-2xl font-semibold text-slate-900">{selectedList.name}</div>
              <div className="mt-2 text-sm text-slate-600">
                {common.placed}: {formatDateTime(selectedList.created_at)}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-slate-900 px-3 py-1 font-semibold text-white">
                  {shop.selectedCart}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-semibold text-slate-700">
                  {selectedItemCount} {common.items.toLowerCase()}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => updateSelectedCart(null)}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {common.close}
              </button>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 2xl:grid-cols-[0.92fr_1.08fr]">
          <div className="space-y-4">
            <Card className="p-5">
              <div className="text-sm font-semibold">{copy.orderDetail.orderSummary}</div>

              <div className="mt-3 text-sm text-slate-700">
                <div>
                  {common.items}: {selectedItemCount}
                </div>
                <div className="mt-1">
                  {common.total}: <span className="font-semibold">{formatCurrency(totalCents)}</span>
                </div>

                {listItems.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-600">
                    {shop.cartIsEmpty}
                  </div>
                ) : (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {common.items}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {listItems.map((item) => (
                        <span
                          key={item.id}
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                        >
                          {item.name} x {item.qty}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
                  <div className="flex items-center justify-between">
                    <span>{common.subtotal}</span>
                    <span>{formatCurrency(subtotalCents)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{common.tax}</span>
                    <span>{formatCurrency(taxCents)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{common.shipping}</span>
                    <span>{formatCurrency(shippingCents)}</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold text-slate-900">
                    <span>{common.total}</span>
                    <span>{formatCurrency(totalCents)}</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <div className="text-sm font-semibold">{page.deliveryAddress}</div>

              <div className="mt-3">
                <select
                  value={selectedAddressId}
                  onChange={(e) => setSelectedAddressId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                >
                  <option value="">{page.selectAddress}</option>
                  {addresses.map((address) => (
                    <option key={address.id} value={address.id}>
                      {page.addressOption(
                        address.label ?? common.address,
                        address.street_1,
                        address.city
                      )}
                    </option>
                  ))}
                </select>
              </div>

              {selectedAddressId ? (
                <div className="mt-3">{renderAddress(selectedAddressId)}</div>
              ) : (
                <div className="mt-3 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-600">
                  {page.selectAddress}
                </div>
              )}

              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {page.noteToAdmin}
                </label>
                <textarea
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder={page.notePlaceholder}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                  rows={4}
                />
              </div>

              <button
                type="button"
                disabled={listItems.length === 0 || submittingOrder}
                onClick={() => void submitOrder()}
                className="mt-4 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submittingOrder ? page.sendingOrder : page.sendOrderRequest}
              </button>
            </Card>
          </div>

          <Card className={clsx("flex flex-col p-5", mobile ? "min-h-[520px]" : "min-h-[620px]")}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{page.cartItems}</div>
                <div className="mt-1 text-xs text-slate-500">{selectedList.name}</div>
              </div>
              <div className="text-sm font-semibold text-slate-900">{formatCurrency(totalCents)}</div>
            </div>

            <div className="mt-4">
              <div className="text-xs font-medium text-slate-600">{page.addItems}</div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={page.searchProducts}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
              />

              {q.trim() ? (
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
                  {searching ? (
                    <div className="px-2 py-1 text-sm text-slate-600">{common.searching}</div>
                  ) : results.length === 0 ? (
                    <div className="px-2 py-1 text-sm text-slate-600">{page.noMatches}</div>
                  ) : (
                    results.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => void addProduct(product)}
                        disabled={addingId === product.id}
                        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left text-sm transition hover:bg-slate-50 disabled:opacity-60"
                      >
                        <div>
                          <div className="font-medium text-slate-900">{product.name}</div>
                          <div className="text-xs text-slate-500">
                            {product.category ?? page.uncategorized}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-slate-900">
                            {formatCurrency(product.price_cents)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {addingId === product.id ? common.adding : shop.addToCart}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
              {loadingItems ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-600">
                  {common.loading}
                </div>
              ) : listItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-600">
                  {page.noItemsYet}
                </div>
              ) : (
                <div className="space-y-3">
                  {listItems.map((item) => {
                    const isPending = pendingItemAction?.id === item.id;
                    const itemImageUrl = getItemImageUrl(item);

                    return (
                      <div key={item.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                        <div className="flex items-start gap-3">
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                            {itemImageUrl ? (
                              <img
                                src={itemImageUrl}
                                alt={item.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center px-2 text-center text-[11px] font-medium text-slate-400">
                                {common.noImage}
                              </div>
                            )}
                          </div>

                          <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-slate-900">
                                {item.name}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {item.price_cents != null
                                  ? formatCurrency(item.price_cents)
                                  : page.noPrice}{" "}
                                {shop.each}
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-sm font-semibold text-slate-900">
                                {formatCurrency((item.price_cents ?? 0) * item.qty)}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">{shop.inCart(item.qty)}</div>
                            </div>
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
                            disabled={isPending}
                            onClick={() => void removeItem(item.id)}
                            className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                          >
                            {page.remove}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold leading-tight md:text-4xl">{shop.yourCarts}</h1>
          <p className="mt-2 text-sm text-slate-600">{shop.manageCartsSubtitle}</p>
        </div>

        <div className="text-xs text-slate-500">
          {common.shownCount(filteredLists.length, lists.length)}
        </div>
      </div>

      <div className="mt-6 xl:hidden">
        <div className="overflow-hidden">
          <div
            className={clsx(
              "flex w-[200%] transition-transform duration-300 ease-out",
              selectedList ? "-translate-x-1/2" : "translate-x-0"
            )}
          >
            <div className="w-1/2 shrink-0 pr-2">{renderListPanel({ mobile: true })}</div>
            <div className="w-1/2 shrink-0 pl-2">{renderSelectedCartContent({ mobile: true })}</div>
          </div>
        </div>
      </div>

      <div
        className={clsx(
          "mt-6 hidden xl:grid xl:gap-6",
          selectedList ? "xl:grid-cols-[360px_minmax(0,1fr)]" : "xl:grid-cols-1"
        )}
      >
        {renderListPanel()}
        {renderSelectedCartContent()}
      </div>
    </main>
  );
}
