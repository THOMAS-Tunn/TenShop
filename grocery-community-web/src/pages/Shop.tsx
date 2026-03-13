import { useEffect, useMemo, useRef, useState } from "react";
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
  product_id: string | null;
  name: string;
  qty: number;
  price_cents: number;
};

type PendingItemAction = {
  id: string;
  action: "inc" | "dec" | "remove";
};

const PRODUCTS_PER_PAGE = 12;
const MOBILE_RECENT_CARTS_PER_PAGE = 5;
const MOBILE_PREVIEW_SHIPPING_CENTS = 499;
const MOBILE_BUBBLE_SIZE = 56;
const MOBILE_BUBBLE_MARGIN = 20;

function buildQuantityDrafts(items: ListItem[]) {
  return items.reduce<Record<string, string>>((drafts, item) => {
    drafts[item.id] = String(item.qty);
    return drafts;
  }, {});
}

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
  const [listSearch, setListSearch] = useState("");
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [deletingListId, setDeletingListId] = useState<string | null>(null);
  const [pendingItemAction, setPendingItemAction] = useState<PendingItemAction | null>(null);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productPage, setProductPage] = useState(1);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [mobileRecentMenuOpen, setMobileRecentMenuOpen] = useState(false);
  const [mobileCreateMenuOpen, setMobileCreateMenuOpen] = useState(false);
  const [mobileRecentSearch, setMobileRecentSearch] = useState("");
  const [mobileRecentPage, setMobileRecentPage] = useState(1);
  const [mobileRecentPageDraft, setMobileRecentPageDraft] = useState("1");
  const [mobileNewCartName, setMobileNewCartName] = useState("");
  const [mobileCreatingCart, setMobileCreatingCart] = useState(false);
  const [mobileBubblePosition, setMobileBubblePosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const [isMobileBubbleDragging, setIsMobileBubbleDragging] = useState(false);

  const bubbleDragStateRef = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
  });
  const bubbleSuppressClickRef = useRef(false);

  function getMobileBubbleBounds() {
    const headerElement = document.querySelector("header");
    const minX = 8;
    const headerBottom =
      headerElement instanceof HTMLElement
        ? Math.ceil(headerElement.getBoundingClientRect().bottom)
        : 0;
    const minY = Math.max(8, headerBottom + 8);
    const maxX = Math.max(minX, window.innerWidth - MOBILE_BUBBLE_SIZE - 8);
    const maxY = Math.max(minY, window.innerHeight - MOBILE_BUBBLE_SIZE - 8);

    return { minX, maxX, minY, maxY };
  }

  function clampMobileBubblePosition(x: number, y: number) {
    const { minX, maxX, minY, maxY } = getMobileBubbleBounds();
    return {
      x: Math.min(maxX, Math.max(minX, x)),
      y: Math.min(maxY, Math.max(minY, y)),
    };
  }

  function snapMobileBubbleToSide(x: number, y: number) {
    const { minX, maxX } = getMobileBubbleBounds();
    const centerX = x + MOBILE_BUBBLE_SIZE / 2;
    const viewportCenterX = window.innerWidth / 2;
    const snappedX = centerX >= viewportCenterX ? maxX : minX;

    return clampMobileBubblePosition(snappedX, y);
  }

  function handleMobileBubblePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (!mobileBubblePosition) return;

    setIsMobileBubbleDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    bubbleDragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: mobileBubblePosition.x,
      originY: mobileBubblePosition.y,
      moved: false,
    };
  }

  function handleMobileBubblePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const dragState = bubbleDragStateRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    const moved = Math.abs(dx) > 4 || Math.abs(dy) > 4;
    if (moved) {
      dragState.moved = true;
    }

    setMobileBubblePosition(clampMobileBubblePosition(dragState.originX + dx, dragState.originY + dy));
  }

  function handleMobileBubblePointerEnd(event: React.PointerEvent<HTMLButtonElement>) {
    const dragState = bubbleDragStateRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    setIsMobileBubbleDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (dragState.moved) {
      bubbleSuppressClickRef.current = true;
      setMobileBubblePosition((current) =>
        current ? snapMobileBubbleToSide(current.x, current.y) : current
      );
    }

    bubbleDragStateRef.current.pointerId = -1;
    bubbleDragStateRef.current.moved = false;
  }

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
      .select("id,product_id,name,qty,price_cents")
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

  useEffect(() => {
    setQuantityDrafts(buildQuantityDrafts(listItems));
  }, [listItems]);

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

  const filteredLists = useMemo(() => {
    const query = listSearch.trim().toLowerCase();
    if (!query) return lists;

    return lists.filter((list) => list.name.toLowerCase().includes(query));
  }, [listSearch, lists]);

  const recentFilteredLists = useMemo(() => {
    const query = mobileRecentSearch.trim().toLowerCase();
    if (!query) return lists;

    return lists.filter((list) => list.name.toLowerCase().includes(query));
  }, [lists, mobileRecentSearch]);

  const mobileRecentTotalPages = useMemo(
    () => Math.max(1, Math.ceil(recentFilteredLists.length / MOBILE_RECENT_CARTS_PER_PAGE)),
    [recentFilteredLists.length]
  );

  const mobileRecentPaginatedLists = useMemo(() => {
    const start = (mobileRecentPage - 1) * MOBILE_RECENT_CARTS_PER_PAGE;
    return recentFilteredLists.slice(start, start + MOBILE_RECENT_CARTS_PER_PAGE);
  }, [mobileRecentPage, recentFilteredLists]);

  const productImageById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const product of products) {
      if (product.image_url) {
        map[product.id] = product.image_url;
      }
    }
    return map;
  }, [products]);

  const productImageByName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const product of products) {
      if (product.image_url && !(product.name in map)) {
        map[product.name] = product.image_url;
      }
    }
    return map;
  }, [products]);

  const totalProductPages = useMemo(
    () => Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE)),
    [filteredProducts.length]
  );

  const paginatedProducts = useMemo(() => {
    const startIndex = (productPage - 1) * PRODUCTS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);
  }, [filteredProducts, productPage]);

  useEffect(() => {
    setProductPage(1);
  }, [productSearch]);

  useEffect(() => {
    setProductPage((currentPage) => Math.min(currentPage, totalProductPages));
  }, [totalProductPages]);

  useEffect(() => {
    setMobileRecentPage(1);
    setMobileRecentPageDraft("1");
  }, [mobileRecentSearch]);

  useEffect(() => {
    setMobileRecentPage((currentPage) => {
      const nextPage = Math.min(currentPage, mobileRecentTotalPages);
      setMobileRecentPageDraft(String(nextPage));
      return nextPage;
    });
  }, [mobileRecentTotalPages]);

  useEffect(() => {
    setMobileBubblePosition((current) => {
      if (current) return current;
      return clampMobileBubblePosition(
        window.innerWidth - MOBILE_BUBBLE_SIZE - MOBILE_BUBBLE_MARGIN,
        window.innerHeight - MOBILE_BUBBLE_SIZE - MOBILE_BUBBLE_MARGIN
      );
    });
  }, []);

  useEffect(() => {
    function handleResize() {
      setMobileBubblePosition((current) =>
        current ? clampMobileBubblePosition(current.x, current.y) : current
      );
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!mobileCartOpen) {
      setMobileRecentMenuOpen(false);
      setMobileCreateMenuOpen(false);
      setMobileNewCartName("");
    }
  }, [mobileCartOpen]);

  useEffect(() => {
    setMobileRecentMenuOpen(false);
    setMobileCreateMenuOpen(false);
  }, [selectedListId]);

  async function createListWithName(rawName: string) {
    const nextName = rawName.trim() || shop.defaultCartName;
    const { data, error } = await supabase
      .from("shopping_lists")
      .insert({ user_id: user.id, name: nextName })
      .select("id")
      .single();

    if (error) {
      notice.showError(error.message);
      return null;
    }

    await loadLists();
    if (data?.id) {
      setSelectedListId(data.id);
      return data.id;
    }

    return null;
  }

  async function createList() {
    setBusy(true);
    const createdId = await createListWithName(listName);
    setBusy(false);
    if (!createdId) return;
    setListName(shop.defaultCartName);
  }

  async function createMobileList() {
    setMobileCreatingCart(true);
    const createdId = await createListWithName(mobileNewCartName);
    setMobileCreatingCart(false);
    if (!createdId) return;

    setMobileNewCartName("");
    setMobileCreateMenuOpen(false);
    setMobileRecentMenuOpen(false);
  }

  async function deleteList(listId: string) {
    const target = lists.find((list) => list.id === listId);
    const ok = await notice.confirm(shop.deleteCartConfirm(target?.name ?? shop.selectedCartFallback), {
      cancelLabel: common.cancel,
      confirmLabel: common.delete,
      variant: "error",
    });
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
    setQuantityDrafts((current) => ({ ...current, [item.id]: String(nextQty) }));
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
    setQuantityDrafts((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
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

  function resetQuantityDraft(item: ListItem) {
    setQuantityDrafts((current) => ({ ...current, [item.id]: String(item.qty) }));
  }

  async function commitListItemQty(item: ListItem) {
    const draft = quantityDrafts[item.id]?.trim() ?? String(item.qty);
    if (!draft) {
      resetQuantityDraft(item);
      return;
    }

    const nextQty = Number.parseInt(draft, 10);
    if (Number.isNaN(nextQty)) {
      resetQuantityDraft(item);
      return;
    }

    if (nextQty === item.qty) {
      resetQuantityDraft(item);
      return;
    }

    await updateListItemQty(item, nextQty);
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

  function getItemImageUrl(item: ListItem) {
    if (item.product_id && productImageById[item.product_id]) {
      return productImageById[item.product_id];
    }

    return productImageByName[item.name] ?? null;
  }

  function changeMobileRecentPage(nextPage: number) {
    const clamped = Math.max(1, Math.min(mobileRecentTotalPages, nextPage));
    setMobileRecentPage(clamped);
    setMobileRecentPageDraft(String(clamped));
  }

  function applyMobileRecentPageDraft() {
    const parsed = Number.parseInt(mobileRecentPageDraft, 10);
    if (Number.isNaN(parsed)) {
      setMobileRecentPageDraft(String(mobileRecentPage));
      return;
    }

    changeMobileRecentPage(parsed);
  }

  const selectedList = lists.find((list) => list.id === selectedListId) ?? null;
  const selectedListTotal = listItems.reduce((sum, item) => sum + item.price_cents * item.qty, 0);
  const selectedListTaxCents = Math.round(selectedListTotal * 0.09);
  const selectedListAfterTaxCents = selectedListTotal + selectedListTaxCents;
  const selectedListShippingCents = listItems.length > 0 ? MOBILE_PREVIEW_SHIPPING_CENTS : 0;
  const selectedListPreviewTotalCents = selectedListAfterTaxCents + selectedListShippingCents;
  const canProceedToCheckout = !!selectedListId && listItems.length > 0;

  return (
    <>
      <main className="mx-auto max-w-6xl px-4 py-8 pb-28 lg:pb-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold">{shop.title}</h1>
                <p className="text-sm text-slate-600">{shop.subtitle}</p>
              </div>
              <div className="text-xs text-slate-500">
                {common.shownCount(paginatedProducts.length, products.length)}
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

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {products.length === 0 ? (
                <Card className="p-5 text-sm text-slate-600 sm:col-span-2 lg:col-span-4">
                  {shop.noProductsAvailable}
                </Card>
              ) : filteredProducts.length === 0 ? (
                <Card className="p-5 text-sm text-slate-600 sm:col-span-2 lg:col-span-4">
                  {shop.noProductsMatch}
                </Card>
              ) : (
                paginatedProducts.map((product) => (
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

            {filteredProducts.length > 0 ? (
              <div className="mt-6 flex items-center justify-center gap-4">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={productPage <= 1}
                  onClick={() => setProductPage((currentPage) => Math.max(1, currentPage - 1))}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <i className="fa-solid fa-chevron-left" aria-hidden="true" />
                </button>

                <div className="min-w-24 text-center text-sm font-semibold text-slate-700">
                  {productPage} / {totalProductPages}
                </div>

                <button
                  type="button"
                  aria-label="Next page"
                  disabled={productPage >= totalProductPages}
                  onClick={() =>
                    setProductPage((currentPage) => Math.min(totalProductPages, currentPage + 1))
                  }
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <i className="fa-solid fa-chevron-right" aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </section>

          <aside className="hidden space-y-4 lg:block">
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">{shop.yourCarts}</div>
                <Link
                  to={selectedListId ? `/cart?selected=${selectedListId}` : "/cart"}
                  className="text-xs font-medium text-slate-600 underline-offset-2 hover:underline"
                >
                  {shop.openFullCart}
                </Link>
              </div>

              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="text-xs font-medium text-slate-600">{shop.selectedCart}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {selectedList ? selectedList.name : shop.selectACart}
                </div>
              </div>

              <div className="mt-3">
                <input
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                  placeholder={shop.searchCartsPlaceholder}
                />
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

              <div className="mt-4 max-h-[22rem] space-y-2 overflow-y-auto pr-1">
                {lists.length === 0 ? (
                  <div className="text-sm text-slate-600">{shop.noCartsYet}</div>
                ) : filteredLists.length === 0 ? (
                  <div className="text-sm text-slate-600">{shop.noCartsMatch}</div>
                ) : (
                  filteredLists.map((list) => {
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
                          to={`/cart?selected=${list.id}`}
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
                <div className="mt-4 max-h-[44rem] space-y-3 overflow-y-auto pr-1">
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
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              aria-label={item.name}
                              value={quantityDrafts[item.id] ?? String(item.qty)}
                              disabled={isPending}
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                if (!/^\d*$/.test(nextValue)) return;

                                setQuantityDrafts((current) => ({
                                  ...current,
                                  [item.id]: nextValue,
                                }));
                              }}
                              onBlur={() => void commitListItemQty(item)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.currentTarget.blur();
                                }

                                if (event.key === "Escape") {
                                  resetQuantityDraft(item);
                                  event.currentTarget.blur();
                                }
                              }}
                              className="w-14 border-x border-slate-200 bg-transparent px-2 py-2 text-center text-sm font-semibold text-slate-900 outline-none disabled:opacity-50"
                            />
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

      {!mobileCartOpen && mobileBubblePosition ? (
        <div className="fixed inset-0 z-40 pointer-events-none lg:hidden">
          <button
            type="button"
            onClick={() => {
              if (bubbleSuppressClickRef.current) {
                bubbleSuppressClickRef.current = false;
                return;
              }
              setMobileCartOpen(true);
            }}
            onPointerDown={handleMobileBubblePointerDown}
            onPointerMove={handleMobileBubblePointerMove}
            onPointerUp={handleMobileBubblePointerEnd}
            onPointerCancel={handleMobileBubblePointerEnd}
            style={{ left: mobileBubblePosition.x, top: mobileBubblePosition.y }}
            className={`pointer-events-auto absolute inline-flex h-14 w-14 touch-none items-center justify-center rounded-full bg-slate-900 text-white shadow-xl ring-4 ring-white/70 ${
              isMobileBubbleDragging ? "" : "transition-[left,top] duration-200"
            }`}
            aria-label={shop.yourCarts}
          >
            <i className="fa-solid fa-cart-shopping text-lg" aria-hidden="true" />
            <span className="absolute -right-1 -top-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
              {listItems.reduce((sum, item) => sum + item.qty, 0)}
            </span>
          </button>
        </div>
      ) : null}

      {mobileCartOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMobileCartOpen(false)}>
          <div className="absolute inset-0 bg-slate-950/40" />
          <div
            className="absolute inset-x-3 bottom-3 max-h-[82vh] overflow-visible rounded-[28px] border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">{shop.yourCarts}</div>
              <button
                type="button"
                onClick={() => setMobileCartOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center text-slate-500 hover:text-slate-900"
                aria-label={shop.close}
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>

            <div className="max-h-[calc(82vh-3.5rem)] space-y-4 overflow-y-auto px-4 py-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Current cart:
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {selectedList?.name ?? shop.selectACart}
                </div>
              </div>

              <div className="relative">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileRecentMenuOpen((current) => !current);
                      setMobileCreateMenuOpen(false);
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                  >
                    <span>Recent cart</span>
                    <i className="fa-solid fa-chevron-down text-xs" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMobileCreateMenuOpen((current) => !current);
                      setMobileRecentMenuOpen(false);
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                  >
                    <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
                  </button>
                </div>

                {mobileRecentMenuOpen ? (
                  <div className="absolute left-0 right-0 z-10 mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                    <input
                      value={mobileRecentSearch}
                      onChange={(event) => setMobileRecentSearch(event.target.value)}
                      placeholder={shop.searchCartsPlaceholder}
                      className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                    />

                    <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                      {recentFilteredLists.length === 0 ? (
                        <div className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
                          {shop.noCartsMatch}
                        </div>
                      ) : (
                        mobileRecentPaginatedLists.map((list) => (
                          <button
                            key={list.id}
                            type="button"
                            onClick={() => {
                              setSelectedListId(list.id);
                              setMobileRecentMenuOpen(false);
                            }}
                            className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                              list.id === selectedListId
                                ? "border-slate-900 bg-slate-100 text-slate-900"
                                : "border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <div className="font-medium">{list.name}</div>
                            <div className="mt-0.5 text-xs text-slate-500">
                              {formatDateTime(list.created_at)}
                            </div>
                          </button>
                        ))
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                      <button
                        type="button"
                        aria-label="Previous carts page"
                        onClick={() => changeMobileRecentPage(mobileRecentPage - 1)}
                        disabled={mobileRecentPage <= 1}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-700 disabled:opacity-40"
                      >
                        <i className="fa-solid fa-chevron-left text-xs" aria-hidden="true" />
                      </button>

                      <div className="flex items-center gap-1 text-sm">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={mobileRecentPageDraft}
                          onChange={(event) => {
                            const next = event.target.value;
                            if (!/^\d*$/.test(next)) return;
                            setMobileRecentPageDraft(next);
                          }}
                          onBlur={applyMobileRecentPageDraft}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.currentTarget.blur();
                            }
                            if (event.key === "Escape") {
                              setMobileRecentPageDraft(String(mobileRecentPage));
                              event.currentTarget.blur();
                            }
                          }}
                          className="w-11 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm font-semibold text-slate-900 outline-none"
                          aria-label="Carts page number"
                        />
                        <span className="text-slate-600">/ {mobileRecentTotalPages}</span>
                      </div>

                      <button
                        type="button"
                        aria-label="Next carts page"
                        onClick={() => changeMobileRecentPage(mobileRecentPage + 1)}
                        disabled={mobileRecentPage >= mobileRecentTotalPages}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-700 disabled:opacity-40"
                      >
                        <i className="fa-solid fa-chevron-right text-xs" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ) : null}

                {mobileCreateMenuOpen ? (
                  <div className="absolute left-0 right-0 z-10 mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Create new cart
                    </div>
                    <input
                      value={mobileNewCartName}
                      onChange={(event) => setMobileNewCartName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void createMobileList();
                        }
                      }}
                      placeholder={shop.cartName}
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                    />

                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setMobileCreateMenuOpen(false)}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                      >
                        {common.cancel}
                      </button>
                      <button
                        type="button"
                        disabled={mobileCreatingCart}
                        onClick={() => void createMobileList()}
                        className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                      >
                        {mobileCreatingCart ? common.working : common.save}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-slate-200" />

              {!selectedList ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-600">
                  {shop.selectACart}
                </div>
              ) : listItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-600">
                  {shop.cartIsEmpty}
                </div>
              ) : (
                <div className="space-y-3">
                  {listItems.map((item) => {
                    const previewImage = getItemImageUrl(item);

                    return (
                      <div key={item.id} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3">
                        <div className="h-12 w-12 overflow-hidden rounded-xl bg-slate-100">
                          {previewImage ? (
                            <img
                              src={previewImage}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                              {common.noImage}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900">{item.name}</div>
                        </div>
                        <div className="whitespace-nowrap text-xs font-medium text-slate-700">
                          {formatCurrency(item.price_cents)} x {item.qty}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-2 border-t border-slate-200 pt-3 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Before tax</span>
                  <span>{formatCurrency(selectedListTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>After tax</span>
                  <span>{formatCurrency(selectedListAfterTaxCents)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                  <span className="font-semibold text-slate-900">Total</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(selectedListPreviewTotalCents)}
                  </span>
                </div>
              </div>

              <Link
                to={selectedListId ? `/cart?selected=${selectedListId}` : "/cart"}
                onClick={() => {
                  if (!canProceedToCheckout) return;
                  setMobileCartOpen(false);
                }}
                className={`inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold ${
                  canProceedToCheckout
                    ? "bg-slate-900 text-white"
                    : "pointer-events-none bg-slate-200 text-slate-500"
                }`}
              >
                Proceed to check out
              </Link>
            </div>
          </div>
        </div>
      ) : null}

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
