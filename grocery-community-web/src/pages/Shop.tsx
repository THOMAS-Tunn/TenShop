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

// ── Stagger classname helper ──────────────────────────────────
function staggerClass(index: number) {
  const n = (index % 12) + 1;
  return `animate-fade-up stagger-${n}`;
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
  const [mobileBubblePosition, setMobileBubblePosition] = useState<{ x: number; y: number } | null>(null);
  const [isMobileBubbleDragging, setIsMobileBubbleDragging] = useState(false);

  const bubbleDragStateRef = useRef({
    pointerId: -1, startX: 0, startY: 0, originX: 0, originY: 0, moved: false,
  });
  const bubbleSuppressClickRef = useRef(false);

  function getMobileBubbleBounds() {
    const headerElement = document.querySelector("header");
    const minX = 8;
    const headerBottom = headerElement instanceof HTMLElement
      ? Math.ceil(headerElement.getBoundingClientRect().bottom) : 0;
    const minY = Math.max(8, headerBottom + 8);
    const maxX = Math.max(minX, window.innerWidth - MOBILE_BUBBLE_SIZE - 8);
    const maxY = Math.max(minY, window.innerHeight - MOBILE_BUBBLE_SIZE - 8);
    return { minX, maxX, minY, maxY };
  }

  function clampMobileBubblePosition(x: number, y: number) {
    const { minX, maxX, minY, maxY } = getMobileBubbleBounds();
    return { x: Math.min(maxX, Math.max(minX, x)), y: Math.min(maxY, Math.max(minY, y)) };
  }

  function snapMobileBubbleToSide(x: number, y: number) {
    const { minX, maxX } = getMobileBubbleBounds();
    const centerX = x + MOBILE_BUBBLE_SIZE / 2;
    const snappedX = centerX >= window.innerWidth / 2 ? maxX : minX;
    return clampMobileBubblePosition(snappedX, y);
  }

  function handleMobileBubblePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (!mobileBubblePosition) return;
    setIsMobileBubbleDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    bubbleDragStateRef.current = {
      pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      originX: mobileBubblePosition.x, originY: mobileBubblePosition.y, moved: false,
    };
  }

  function handleMobileBubblePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const d = bubbleDragStateRef.current;
    if (d.pointerId !== event.pointerId) return;
    const dx = event.clientX - d.startX, dy = event.clientY - d.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
    setMobileBubblePosition(clampMobileBubblePosition(d.originX + dx, d.originY + dy));
  }

  function handleMobileBubblePointerEnd(event: React.PointerEvent<HTMLButtonElement>) {
    const d = bubbleDragStateRef.current;
    if (d.pointerId !== event.pointerId) return;
    setIsMobileBubbleDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (d.moved) {
      bubbleSuppressClickRef.current = true;
      setMobileBubblePosition((cur) => cur ? snapMobileBubbleToSide(cur.x, cur.y) : cur);
    }
    d.pointerId = -1; d.moved = false;
  }

  useEffect(() => {
    supabase.from("products").select("*").order("name")
      .then(({ data, error }) => { if (error) console.error(error); setProducts((data ?? []) as Product[]); });
  }, []);

  async function loadLists() {
    const { data, error } = await supabase
      .from("shopping_lists").select("id,name,created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) { console.error(error); setLists([]); return [] as List[]; }
    const next = (data ?? []) as List[];
    setLists(next);
    if (next.length === 0) { setSelectedListId(null); return next; }
    setSelectedListId((current) => {
      if (current && next.some((l) => l.id === current)) return current;
      return next[0].id;
    });
    return next;
  }

  async function loadListItems(listId: string | null) {
    if (!listId) { setListItems([]); return; }
    const { data, error } = await supabase
      .from("shopping_list_items").select("id,product_id,name,qty,price_cents")
      .eq("list_id", listId).eq("user_id", user.id).order("name");
    if (error) { console.error(error); setListItems([]); return; }
    setListItems((data ?? []) as ListItem[]);
  }

  useEffect(() => { void loadLists(); }, []);
  useEffect(() => { void loadListItems(selectedListId); }, [selectedListId]);
  useEffect(() => { setQuantityDrafts(buildQuantityDrafts(listItems)); }, [listItems]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const hay = [p.name, p.category ?? "", p.description ?? "", (p.properties ?? []).join(" "), (p.price_cents / 100).toFixed(2)].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [products, productSearch]);

  const filteredLists = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    return q ? lists.filter((l) => l.name.toLowerCase().includes(q)) : lists;
  }, [listSearch, lists]);

  const recentFilteredLists = useMemo(() => {
    const q = mobileRecentSearch.trim().toLowerCase();
    return q ? lists.filter((l) => l.name.toLowerCase().includes(q)) : lists;
  }, [lists, mobileRecentSearch]);

  const mobileRecentTotalPages = useMemo(() => Math.max(1, Math.ceil(recentFilteredLists.length / MOBILE_RECENT_CARTS_PER_PAGE)), [recentFilteredLists.length]);
  const mobileRecentPaginatedLists = useMemo(() => {
    const start = (mobileRecentPage - 1) * MOBILE_RECENT_CARTS_PER_PAGE;
    return recentFilteredLists.slice(start, start + MOBILE_RECENT_CARTS_PER_PAGE);
  }, [mobileRecentPage, recentFilteredLists]);

  const productImageById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of products) { if (p.image_url) map[p.id] = p.image_url; }
    return map;
  }, [products]);

  const productImageByName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of products) { if (p.image_url && !(p.name in map)) map[p.name] = p.image_url; }
    return map;
  }, [products]);

  const totalProductPages = useMemo(() => Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE)), [filteredProducts.length]);
  const paginatedProducts = useMemo(() => {
    const s = (productPage - 1) * PRODUCTS_PER_PAGE;
    return filteredProducts.slice(s, s + PRODUCTS_PER_PAGE);
  }, [filteredProducts, productPage]);

  useEffect(() => { setProductPage(1); }, [productSearch]);
  useEffect(() => { setProductPage((p) => Math.min(p, totalProductPages)); }, [totalProductPages]);
  useEffect(() => { setMobileRecentPage(1); setMobileRecentPageDraft("1"); }, [mobileRecentSearch]);
  useEffect(() => {
    setMobileRecentPage((p) => { const n = Math.min(p, mobileRecentTotalPages); setMobileRecentPageDraft(String(n)); return n; });
  }, [mobileRecentTotalPages]);

  useEffect(() => {
    setMobileBubblePosition((cur) => {
      if (cur) return cur;
      return clampMobileBubblePosition(window.innerWidth - MOBILE_BUBBLE_SIZE - MOBILE_BUBBLE_MARGIN, window.innerHeight - MOBILE_BUBBLE_SIZE - MOBILE_BUBBLE_MARGIN);
    });
  }, []);

  useEffect(() => {
    function handleResize() { setMobileBubblePosition((cur) => cur ? clampMobileBubblePosition(cur.x, cur.y) : cur); }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!mobileCartOpen) { setMobileRecentMenuOpen(false); setMobileCreateMenuOpen(false); setMobileNewCartName(""); }
  }, [mobileCartOpen]);

  useEffect(() => { setMobileRecentMenuOpen(false); setMobileCreateMenuOpen(false); }, [selectedListId]);

  async function createListWithName(rawName: string) {
    const nextName = rawName.trim() || shop.defaultCartName;
    const { data, error } = await supabase.from("shopping_lists").insert({ user_id: user.id, name: nextName }).select("id").single();
    if (error) { notice.showError(error.message); return null; }
    await loadLists();
    if (data?.id) { setSelectedListId(data.id); return data.id; }
    return null;
  }

  async function createList() {
    setBusy(true);
    await createListWithName(listName);
    setBusy(false);
    setListName(shop.defaultCartName);
  }

  async function createMobileList() {
    setMobileCreatingCart(true);
    const id = await createListWithName(mobileNewCartName);
    setMobileCreatingCart(false);
    if (!id) return;
    setMobileNewCartName("");
    setMobileCreateMenuOpen(false);
    setMobileRecentMenuOpen(false);
  }

  async function deleteList(listId: string) {
    const target = lists.find((l) => l.id === listId);
    const ok = await notice.confirm(shop.deleteCartConfirm(target?.name ?? shop.selectedCartFallback), { cancelLabel: common.cancel, confirmLabel: common.delete, variant: "error" });
    if (!ok) return;
    setDeletingListId(listId);
    const { error: ie } = await supabase.from("shopping_list_items").delete().eq("list_id", listId).eq("user_id", user.id);
    if (ie) { setDeletingListId(null); notice.showError(ie.message); return; }
    const { error: le } = await supabase.from("shopping_lists").delete().eq("id", listId).eq("user_id", user.id);
    setDeletingListId(null);
    if (le) { notice.showError(le.message); return; }
    const next = await loadLists();
    if (!next.some((l) => l.id === listId) && selectedListId === listId) setSelectedListId(next[0]?.id ?? null);
  }

  async function updateListItemQty(item: ListItem, nextQty: number) {
    if (nextQty <= 0) { await removeListItem(item.id); return; }
    const prev = listItems;
    setPendingItemAction({ id: item.id, action: nextQty > item.qty ? "inc" : "dec" });
    setQuantityDrafts((d) => ({ ...d, [item.id]: String(nextQty) }));
    setListItems((cur) => cur.map((e) => (e.id === item.id ? { ...e, qty: nextQty } : e)));
    const { error } = await supabase.from("shopping_list_items").update({ qty: nextQty }).eq("id", item.id).eq("user_id", user.id);
    setPendingItemAction(null);
    if (error) { setListItems(prev); notice.showError(error.message); }
  }

  async function removeListItem(itemId: string) {
    const prev = listItems;
    setPendingItemAction({ id: itemId, action: "remove" });
    setQuantityDrafts((d) => { const n = { ...d }; delete n[itemId]; return n; });
    setListItems((cur) => cur.filter((e) => e.id !== itemId));
    const { error } = await supabase.from("shopping_list_items").delete().eq("id", itemId).eq("user_id", user.id);
    setPendingItemAction(null);
    if (error) { setListItems(prev); notice.showError(error.message); }
  }

  function resetQuantityDraft(item: ListItem) {
    setQuantityDrafts((d) => ({ ...d, [item.id]: String(item.qty) }));
  }

  async function commitListItemQty(item: ListItem) {
    const draft = quantityDrafts[item.id]?.trim() ?? String(item.qty);
    if (!draft) { resetQuantityDraft(item); return; }
    const n = Number.parseInt(draft, 10);
    if (Number.isNaN(n)) { resetQuantityDraft(item); return; }
    if (n === item.qty) { resetQuantityDraft(item); return; }
    await updateListItemQty(item, n);
  }

  async function addProductToList(product: Product) {
    if (!selectedListId) { notice.showWarning(shop.createOrSelectCartFirst); return; }
    setAddingId(product.id);
    const { data: existing, error: re } = await supabase.from("shopping_list_items").select("id,qty").eq("list_id", selectedListId).eq("user_id", user.id).eq("name", product.name).maybeSingle();
    if (re) { setAddingId(null); notice.showError(re.message); return; }
    if (existing?.id) {
      const { error: ue } = await supabase.from("shopping_list_items").update({ qty: (existing.qty ?? 1) + 1 }).eq("id", existing.id);
      setAddingId(null);
      if (ue) { notice.showError(ue.message); return; }
      await loadListItems(selectedListId); return;
    }
    const { error: ie } = await supabase.from("shopping_list_items").insert({ list_id: selectedListId, user_id: user.id, product_id: product.id, name: product.name, price_cents: product.price_cents, qty: 1 });
    setAddingId(null);
    if (ie) { notice.showError(ie.message); return; }
    await loadListItems(selectedListId);
  }

  function getItemImageUrl(item: ListItem) {
    if (item.product_id && productImageById[item.product_id]) return productImageById[item.product_id];
    return productImageByName[item.name] ?? null;
  }

  function changeMobileRecentPage(n: number) {
    const c = Math.max(1, Math.min(mobileRecentTotalPages, n));
    setMobileRecentPage(c); setMobileRecentPageDraft(String(c));
  }

  function applyMobileRecentPageDraft() {
    const p = Number.parseInt(mobileRecentPageDraft, 10);
    if (Number.isNaN(p)) { setMobileRecentPageDraft(String(mobileRecentPage)); return; }
    changeMobileRecentPage(p);
  }

  const selectedList = lists.find((l) => l.id === selectedListId) ?? null;
  const selectedListTotal = listItems.reduce((s, i) => s + i.price_cents * i.qty, 0);
  const selectedListTaxCents = Math.round(selectedListTotal * 0.09);
  const selectedListAfterTaxCents = selectedListTotal + selectedListTaxCents;
  const selectedListShippingCents = listItems.length > 0 ? MOBILE_PREVIEW_SHIPPING_CENTS : 0;
  const selectedListPreviewTotalCents = selectedListAfterTaxCents + selectedListShippingCents;
  const canProceedToCheckout = !!selectedListId && listItems.length > 0;
  const cartItemCount = listItems.reduce((s, i) => s + i.qty, 0);

  return (
    <>
      <main className="mx-auto max-w-6xl px-4 py-8 pb-28 lg:pb-8">
        {/* ── Page header ─────────────────────────────────────── */}
        <div className="mb-6 animate-fade-up">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{shop.title}</h1>
              {/* Subtitle — pure display text, clearly not interactive */}
              <p className="mt-1 text-sm text-slate-600 display-only">{shop.subtitle}</p>
            </div>
            {/* Item count — display-only badge */}
            <span className="display-only animate-badge-pop rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              {common.shownCount(paginatedProducts.length, products.length)}
            </span>
          </div>

          {/* Search bar */}
          <div className="mt-4 relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none" aria-hidden="true" />
            <input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder={shop.searchPlaceholder}
              className="w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-4 py-2.5 text-sm outline-none transition focus:border-[rgb(213,120,28)] focus:ring-2 focus:ring-[rgb(213,120,28)/0.12]"
            />
            {productSearch && (
              <button
                type="button"
                onClick={() => setProductSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                aria-label="Clear search"
              >
                <i className="fa-solid fa-xmark text-xs" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* ── Product grid ──────────────────────────────────── */}
          <section>
            {products.length === 0 ? (
              <Card className="p-8 text-center animate-fade-up">
                {/* Empty state — display element, not a button */}
                <div className="display-only mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 animate-float">
                  <i className="fa-solid fa-store text-xl text-slate-400" aria-hidden="true" />
                </div>
                <p className="text-sm text-slate-600 display-only">{shop.noProductsAvailable}</p>
              </Card>
            ) : filteredProducts.length === 0 ? (
              <Card className="p-8 text-center animate-fade-up">
                <div className="display-only mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 animate-float">
                  <i className="fa-solid fa-magnifying-glass text-xl text-slate-400" aria-hidden="true" />
                </div>
                <p className="text-sm text-slate-600 display-only">{shop.noProductsMatch}</p>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {paginatedProducts.map((product, i) => (
                  <div
                    key={product.id}
                    className={`product-card rounded-3xl border border-slate-200 bg-white overflow-hidden flex flex-col ${staggerClass(i)}`}
                  >
                    {/* Clickable image + info area — opens detail modal */}
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(product)}
                      className="text-left flex-1 flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(213,120,28)] focus-visible:ring-inset"
                      aria-label={`View details for ${product.name}`}
                    >
                      {/* Image */}
                      <div className="product-card__image aspect-[4/3] w-full bg-slate-100">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="display-only flex h-full items-center justify-center text-sm text-slate-400">
                            <i className="fa-regular fa-image text-2xl opacity-40" aria-hidden="true" />
                          </div>
                        )}
                      </div>

                      {/* Card body */}
                      <div className="p-4 flex-1 flex flex-col gap-2">
                        {/* Name + price — display elements */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="display-only">
                            <div className="text-sm font-semibold text-slate-900 leading-snug">{product.name}</div>
                            {product.category && (
                              <div className="mt-0.5 text-xs text-slate-500">{product.category}</div>
                            )}
                          </div>
                          {/* Price display — not a button */}
                          <div className="display-only shrink-0 rounded-xl bg-[rgb(248,244,237)] border border-[rgb(210,196,178)] px-2.5 py-1 text-xs font-bold text-[rgb(92,70,46)]">
                            {formatCurrency(product.price_cents)}
                          </div>
                        </div>

                        {/* Property tags — display only chips */}
                        {product.properties?.length ? (
                          <div className="display-only flex flex-wrap gap-1.5">
                            {product.properties.slice(0, 3).map((prop) => (
                              <span key={prop} className="tag-chip">{prop}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </button>

                    {/* Add to cart — clearly a button (different style from display chips/price) */}
                    <div className="px-4 pb-4">
                      <button
                        type="button"
                        disabled={addingId === product.id}
                        onClick={(e) => { e.stopPropagation(); void addProductToList(product); }}
                        className="w-full rounded-2xl bg-[rgb(28,18,8)] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[rgb(48,34,18)] active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {addingId === product.id ? (
                          <>
                            <i className="fa-solid fa-circle-notch fa-spin text-xs" aria-hidden="true" />
                            <span>{common.adding}</span>
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-cart-plus text-xs" aria-hidden="true" />
                            <span>{shop.addToCart}</span>
                          </>
                        )}
                      </button>

                      {/* "Adds to" info — display element, clearly not clickable */}
                      {selectedListId ? (
                        <p className="display-only mt-1.5 text-center text-xs text-slate-500">
                          <i className="fa-solid fa-arrow-right text-[10px] mr-1 opacity-60" aria-hidden="true" />
                          {shop.addsTo}{" "}
                          <span className="font-medium text-slate-700">
                            {lists.find((l) => l.id === selectedListId)?.name ?? shop.selectedCartFallback}
                          </span>
                        </p>
                      ) : (
                        <p className="display-only mt-1.5 text-center text-xs text-slate-400">{shop.createCartToStart}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {filteredProducts.length > 0 ? (
              <div className="mt-6 flex items-center justify-center gap-4 animate-fade-up stagger-4">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={productPage <= 1}
                  onClick={() => setProductPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className="fa-solid fa-chevron-left" aria-hidden="true" />
                </button>

                {/* Page indicator — display only */}
                <span className="display-only min-w-20 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-center text-sm font-semibold text-slate-700">
                  {productPage} / {totalProductPages}
                </span>

                <button
                  type="button"
                  aria-label="Next page"
                  disabled={productPage >= totalProductPages}
                  onClick={() => setProductPage((p) => Math.min(totalProductPages, p + 1))}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className="fa-solid fa-chevron-right" aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </section>

          {/* ── Cart sidebar (desktop) ─────────────────────── */}
          <aside className="hidden space-y-4 lg:block animate-slide-right">
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">{shop.yourCarts}</div>
                <Link
                  to={selectedListId ? `/cart?selected=${selectedListId}` : "/cart"}
                  className="text-xs font-medium text-[rgb(92,70,46)] underline-offset-2 hover:underline hover:text-[rgb(213,120,28)] transition-colors"
                >
                  {shop.openFullCart}
                </Link>
              </div>

              {/* Selected cart display */}
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="display-only text-xs font-semibold uppercase tracking-wide text-slate-500">{shop.selectedCart}</div>
                <div className="display-only mt-1 text-sm font-semibold text-slate-900">
                  {selectedList ? selectedList.name : shop.selectACart}
                </div>
              </div>

              <div className="mt-3">
                <input
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-[rgb(213,120,28)]"
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
                  className="rounded-2xl bg-[rgb(28,18,8)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-[rgb(48,34,18)] transition"
                >
                  {common.add}
                </button>
              </div>

              <div className="mt-4 max-h-[22rem] space-y-2 overflow-y-auto pr-1">
                {lists.length === 0 ? (
                  <p className="display-only text-sm text-slate-500">{shop.noCartsYet}</p>
                ) : filteredLists.length === 0 ? (
                  <p className="display-only text-sm text-slate-500">{shop.noCartsMatch}</p>
                ) : (
                  filteredLists.map((list) => {
                    const isSelected = list.id === selectedListId;
                    return (
                      <div
                        key={list.id}
                        className={`rounded-2xl border px-3 py-3 transition ${isSelected ? "border-[rgb(180,164,142)] bg-[rgb(248,244,237)]" : "hover:bg-slate-50"}`}
                      >
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedListId(list.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="font-medium text-sm">{list.name}</div>
                            {/* Date — display element */}
                            <div className="display-only mt-0.5 text-xs text-slate-500">{formatDateTime(list.created_at)}</div>
                          </button>

                          <button
                            type="button"
                            aria-label={common.deleteCartAria(list.name)}
                            title={shop.deleteCartTitle}
                            disabled={deletingListId === list.id}
                            onClick={() => void deleteList(list.id)}
                            className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                          >
                            <i className="fa-solid fa-trash text-xs" aria-hidden="true" />
                          </button>
                        </div>

                        <Link
                          to={`/cart?selected=${list.id}`}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 underline-offset-2 hover:underline hover:text-[rgb(213,120,28)] transition-colors"
                        >
                          <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" aria-hidden="true" />
                          {shop.openFullCart}
                        </Link>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            {/* Cart items panel */}
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{shop.cartItems}</div>
                  {/* Subtitle display */}
                  <div className="display-only mt-0.5 text-xs text-slate-500">
                    {selectedList ? selectedList.name : shop.chooseCartToView}
                  </div>
                </div>
                {selectedList ? (
                  <div className="display-only rounded-xl border border-[rgb(210,196,178)] bg-[rgb(248,244,237)] px-2.5 py-1 text-sm font-bold text-[rgb(92,70,46)]">
                    {formatCurrency(selectedListTotal)}
                  </div>
                ) : null}
              </div>

              {!selectedList ? (
                <p className="display-only mt-4 text-sm text-slate-500">{shop.noCartSelected}</p>
              ) : listItems.length === 0 ? (
                <p className="display-only mt-4 text-sm text-slate-500">{shop.cartIsEmpty}</p>
              ) : (
                <div className="mt-4 max-h-[44rem] space-y-3 overflow-y-auto pr-1">
                  {listItems.map((item) => {
                    const isPending = pendingItemAction?.id === item.id;
                    return (
                      <div key={item.id} className="rounded-2xl border border-slate-200 px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 display-only">
                            <div className="truncate text-sm font-medium text-slate-900">{item.name}</div>
                            <div className="mt-1 text-xs text-slate-500">{formatCurrency(item.price_cents)} {shop.each}</div>
                          </div>
                          <div className="text-right display-only">
                            <div className="text-sm font-semibold text-slate-900">{formatCurrency(item.price_cents * item.qty)}</div>
                            <div className="mt-1 text-xs text-slate-500">{shop.inCart(item.qty)}</div>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white">
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => void updateListItemQty(item, item.qty - 1)}
                              className="px-3 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 disabled:opacity-50 transition"
                            >−</button>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              aria-label={item.name}
                              value={quantityDrafts[item.id] ?? String(item.qty)}
                              disabled={isPending}
                              onChange={(e) => { if (!/^\d*$/.test(e.target.value)) return; setQuantityDrafts((d) => ({ ...d, [item.id]: e.target.value })); }}
                              onBlur={() => void commitListItemQty(item)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                                if (e.key === "Escape") { resetQuantityDraft(item); e.currentTarget.blur(); }
                              }}
                              className="w-12 border-x border-slate-200 bg-transparent px-2 py-2 text-center text-sm font-semibold text-slate-900 outline-none disabled:opacity-50"
                            />
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => void updateListItemQty(item, item.qty + 1)}
                              className="px-3 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 disabled:opacity-50 transition"
                            >+</button>
                          </div>

                          <button
                            type="button"
                            aria-label={common.removeItemAria(item.name)}
                            title={copy.cartDetail.remove}
                            disabled={isPending}
                            onClick={() => void removeListItem(item.id)}
                            className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                          >
                            <i className="fa-solid fa-trash text-xs" aria-hidden="true" />
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

      {/* ── Mobile floating cart bubble ──────────────────────── */}
      {!mobileCartOpen && mobileBubblePosition ? (
        <div className="fixed inset-0 z-40 pointer-events-none lg:hidden">
          <button
            type="button"
            onClick={() => {
              if (bubbleSuppressClickRef.current) { bubbleSuppressClickRef.current = false; return; }
              setMobileCartOpen(true);
            }}
            onPointerDown={handleMobileBubblePointerDown}
            onPointerMove={handleMobileBubblePointerMove}
            onPointerUp={handleMobileBubblePointerEnd}
            onPointerCancel={handleMobileBubblePointerEnd}
            style={{ left: mobileBubblePosition.x, top: mobileBubblePosition.y }}
            className={`pointer-events-auto absolute inline-flex h-14 w-14 touch-none items-center justify-center rounded-full bg-[rgb(28,18,8)] text-white shadow-xl ring-4 ring-white/70 ${isMobileBubbleDragging ? "" : "transition-[left,top] duration-200"}`}
            aria-label={shop.yourCarts}
          >
            <i className="fa-solid fa-cart-shopping text-lg" aria-hidden="true" />
            {cartItemCount > 0 && (
              <span className="display-only absolute -right-1 -top-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[rgb(213,120,28)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white animate-badge-pop">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>
      ) : null}

      {/* ── Mobile cart drawer ───────────────────────────────── */}
      {mobileCartOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMobileCartOpen(false)}>
          <div className="absolute inset-0 bg-slate-950/40" />
          <div
            className="absolute inset-x-3 bottom-3 max-h-[82vh] overflow-visible rounded-[28px] border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="display-only text-sm font-semibold text-slate-900">{shop.yourCarts}</div>
              <button
                type="button"
                onClick={() => setMobileCartOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
                aria-label={shop.close}
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>

            <div className="max-h-[calc(82vh-3.5rem)] space-y-4 overflow-y-auto px-4 py-4">
              <div>
                <div className="display-only text-xs font-semibold uppercase tracking-wide text-slate-500">Current cart</div>
                <div className="display-only mt-1 text-sm font-semibold text-slate-900">{selectedList?.name ?? shop.selectACart}</div>
              </div>

              <div className="relative">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setMobileRecentMenuOpen((p) => !p); setMobileCreateMenuOpen(false); }}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    <span>Recent cart</span>
                    <i className="fa-solid fa-chevron-down text-xs" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMobileCreateMenuOpen((p) => !p); setMobileRecentMenuOpen(false); }}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
                  </button>
                </div>

                {mobileRecentMenuOpen ? (
                  <div className="absolute left-0 right-0 z-10 mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl animate-scale-in">
                    <input
                      value={mobileRecentSearch}
                      onChange={(e) => setMobileRecentSearch(e.target.value)}
                      placeholder={shop.searchCartsPlaceholder}
                      className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none"
                    />
                    <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                      {recentFilteredLists.length === 0 ? (
                        <div className="display-only rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600">{shop.noCartsMatch}</div>
                      ) : (
                        mobileRecentPaginatedLists.map((list) => (
                          <button
                            key={list.id}
                            type="button"
                            onClick={() => { setSelectedListId(list.id); setMobileRecentMenuOpen(false); }}
                            className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${list.id === selectedListId ? "border-slate-900 bg-slate-100 text-slate-900" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                          >
                            <div className="font-medium">{list.name}</div>
                            <div className="display-only mt-0.5 text-xs text-slate-500">{formatDateTime(list.created_at)}</div>
                          </button>
                        ))
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                      <button
                        type="button"
                        onClick={() => changeMobileRecentPage(mobileRecentPage - 1)}
                        disabled={mobileRecentPage <= 1}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-700 disabled:opacity-40"
                      >
                        <i className="fa-solid fa-chevron-left text-xs" aria-hidden="true" />
                      </button>
                      <div className="display-only flex items-center gap-1 text-sm">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={mobileRecentPageDraft}
                          onChange={(e) => { if (!/^\d*$/.test(e.target.value)) return; setMobileRecentPageDraft(e.target.value); }}
                          onBlur={applyMobileRecentPageDraft}
                          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setMobileRecentPageDraft(String(mobileRecentPage)); e.currentTarget.blur(); } }}
                          className="w-11 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm font-semibold text-slate-900 outline-none"
                        />
                        <span className="text-slate-600">/ {mobileRecentTotalPages}</span>
                      </div>
                      <button
                        type="button"
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
                  <div className="absolute left-0 right-0 z-10 mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl animate-scale-in">
                    <div className="display-only text-xs font-semibold uppercase tracking-wide text-slate-500">Create new cart</div>
                    <input
                      value={mobileNewCartName}
                      onChange={(e) => setMobileNewCartName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void createMobileList(); } }}
                      placeholder={shop.cartName}
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none"
                    />
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setMobileCreateMenuOpen(false)}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                      >{common.cancel}</button>
                      <button
                        type="button"
                        disabled={mobileCreatingCart}
                        onClick={() => void createMobileList()}
                        className="rounded-xl bg-[rgb(28,18,8)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-[rgb(48,34,18)] transition"
                      >{mobileCreatingCart ? common.working : common.save}</button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-slate-200" />

              {!selectedList ? (
                <div className="display-only rounded-2xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-600">{shop.selectACart}</div>
              ) : listItems.length === 0 ? (
                <div className="display-only rounded-2xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-600">{shop.cartIsEmpty}</div>
              ) : (
                <div className="space-y-3">
                  {listItems.map((item) => {
                    const previewImage = getItemImageUrl(item);
                    return (
                      <div key={item.id} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3">
                        <div className="h-12 w-12 overflow-hidden rounded-xl bg-slate-100">
                          {previewImage ? (
                            <img src={previewImage} alt={item.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="display-only flex h-full w-full items-center justify-center text-xs text-slate-400">
                              <i className="fa-regular fa-image" aria-hidden="true" />
                            </div>
                          )}
                        </div>
                        <div className="display-only min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900">{item.name}</div>
                        </div>
                        <div className="display-only whitespace-nowrap text-xs font-semibold text-slate-700">
                          {formatCurrency(item.price_cents)} × {item.qty}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Order totals — pure display section */}
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 display-only">
                <div className="flex items-center justify-between">
                  <span>Before tax</span>
                  <span>{formatCurrency(selectedListTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>After tax</span>
                  <span>{formatCurrency(selectedListAfterTaxCents)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                  <span>Total</span>
                  <span>{formatCurrency(selectedListPreviewTotalCents)}</span>
                </div>
              </div>

              <Link
                to={selectedListId ? `/cart?selected=${selectedListId}` : "/cart"}
                onClick={() => { if (canProceedToCheckout) setMobileCartOpen(false); }}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  canProceedToCheckout
                    ? "bg-[rgb(28,18,8)] text-white hover:bg-[rgb(48,34,18)]"
                    : "pointer-events-none bg-slate-200 text-slate-500"
                }`}
              >
                <i className="fa-solid fa-bag-shopping text-xs" aria-hidden="true" />
                Proceed to checkout
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Product detail modal ─────────────────────────────── */}
      {selectedProduct ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 animate-fade-in"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="display-only">
                <h2 className="text-2xl font-semibold text-slate-900">{selectedProduct.name}</h2>
                {/* Price — display element, styled differently from buttons */}
                <div className="mt-2 inline-flex items-baseline gap-1">
                  <span className="text-xs text-slate-500 font-medium">USD</span>
                  <span className="text-2xl font-bold text-[rgb(92,70,46)]">
                    {formatCurrency(selectedProduct.price_cents).replace(/[^0-9.,]/g, "")}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
              >
                {shop.close}
              </button>
            </div>

            <div className="mt-5 grid gap-6 md:grid-cols-[1.05fr_0.95fr]">
              <div className="overflow-hidden rounded-3xl bg-slate-100">
                {selectedProduct.image_url ? (
                  <img src={selectedProduct.image_url} alt={selectedProduct.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="display-only flex min-h-[320px] items-center justify-center text-slate-400">
                    <i className="fa-regular fa-image text-5xl opacity-30" aria-hidden="true" />
                  </div>
                )}
              </div>

              <div>
                {selectedProduct.properties?.length ? (
                  <div>
                    {/* Properties label — display element */}
                    <div className="display-only text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{common.properties}</div>
                    <div className="flex flex-wrap gap-2 display-only">
                      {selectedProduct.properties.map((prop) => (
                        <span key={prop} className="tag-chip text-sm px-3 py-1.5">{prop}</span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Description — display text, not interactive */}
                <div className="display-only mt-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{common.description}</div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {selectedProduct.description?.trim() || common.noDescriptionYet}
                  </p>
                </div>

                {/* Add to cart — clearly a button */}
                <button
                  type="button"
                  disabled={addingId === selectedProduct.id}
                  onClick={() => void addProductToList(selectedProduct)}
                  className="mt-6 w-full rounded-2xl bg-[rgb(28,18,8)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 hover:bg-[rgb(48,34,18)] active:scale-[0.98] transition flex items-center justify-center gap-2"
                >
                  {addingId === selectedProduct.id ? (
                    <><i className="fa-solid fa-circle-notch fa-spin text-xs" /><span>{common.adding}</span></>
                  ) : (
                    <><i className="fa-solid fa-cart-plus text-xs" /><span>{shop.addToCart}</span></>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
