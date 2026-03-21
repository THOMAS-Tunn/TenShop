import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../components/Card";
import { DateField } from "../components/DateField";
import { ProductImageField } from "../components/ProductImageField";
import { useAppSettings } from "../lib/app-settings";
import { uploadProductImage } from "../lib/imagekit";
import { useNotice } from "../lib/notices";
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

type CommunityPost = {
  id: string;
  user_id: string;
  title: string;
  body: string;
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
  const {
    copy,
    theme,
    formatCurrency,
    formatDateTime,
    formatStatus,
    formatStoredMessage,
  } = useAppSettings();
  const notice = useNotice();
  const common = copy.common;
  const adminCopy = copy.admin;
  const money = formatCurrency;
  const isDarkTheme = theme === "dark";
  const markDeliveredLabel = adminCopy.markShipped;
  const markOnTheWayLabel = adminCopy.markOnTheWay;
  const markPackagingLabel = adminCopy.markPackaging;
  const archiveLabel = adminCopy.archive;
  const ordersTabLabel = adminCopy.ordersTab;
  const archiveTabLabel = adminCopy.archiveTab;
  const postsTabLabel = adminCopy.postsTab;
  const selectAllLabel = adminCopy.selectAll;
  const allStatusesLabel = adminCopy.allStatuses;
  const markMenuHeaderLabel = adminCopy.mark;
  const noArchivedChatsLabel = adminCopy.noArchivedChats;

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
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [postAuthorMap, setPostAuthorMap] = useState<Record<string, string>>({});
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  const [selectedMessages, setSelectedMessages] = useState<OrderMessage[]>([]);

  const [addressMap, setAddressMap] = useState<Record<string, Address>>({});
  const [profileMap, setProfileMap] = useState<Record<string, Profile>>({});

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);
  const [isSelectingPosts, setIsSelectingPosts] = useState(false);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);

  const [replyBody, setReplyBody] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [deletingSelectedPosts, setDeletingSelectedPosts] = useState(false);
  const [deletingPostIds, setDeletingPostIds] = useState<string[]>([]);
  const [uploadingNewImage, setUploadingNewImage] = useState(false);
  const [uploadingEditImage, setUploadingEditImage] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isAddressOpen, setIsAddressOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "items">("chat");
  const [chatBoardView, setChatBoardView] = useState<"orders" | "archive" | "posts">("orders");
  const [chatStatusFilter, setChatStatusFilter] = useState("");
  const [bulkActionMenuOpen, setBulkActionMenuOpen] = useState(false);
  const [currentActionMenuOpen, setCurrentActionMenuOpen] = useState(false);

  const [itemSearch, setItemSearch] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const [chatDateFrom, setChatDateFrom] = useState("");
  const [chatDateTo, setChatDateTo] = useState("");
  const [postDateFrom, setPostDateFrom] = useState("");
  const [postDateTo, setPostDateTo] = useState("");
  const [chatMinTotal, setChatMinTotal] = useState("");
  const [chatMaxTotal, setChatMaxTotal] = useState("");
  const [chatFilterOpen, setChatFilterOpen] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);

  function formatTime(value: string) {
    return formatDateTime(value);
  }

  function getCustomerLabel(order: OrderRow) {
    const profile = profileMap[order.user_id];
    if (profile?.full_name?.trim()) return profile.full_name;
    return common.customerId(order.user_id);
  }

  function getPostAuthorLabel(post: CommunityPost) {
    return postAuthorMap[post.user_id] ?? common.customerId(post.user_id);
  }

  function getStatusClasses(status: string) {
    if (status === "pending") {
      return "bg-amber-300 text-amber-950 ring-1 ring-amber-400";
    }
    if (status === "packaging") {
      return "bg-orange-200 text-orange-950 ring-1 ring-orange-400";
    }
    if (status === "out_for_delivery" || status === "shipped") {
      return "bg-cyan-200 text-cyan-950 ring-1 ring-cyan-400";
    }
    if (status === "confirmed") {
      return "bg-blue-200 text-blue-950 ring-1 ring-blue-400";
    }
    if (status === "delivered") {
      return "bg-emerald-200 text-emerald-950 ring-1 ring-emerald-400";
    }
    if (status === "archived") {
      return "bg-slate-200 text-slate-900 ring-1 ring-slate-300";
    }
    if (status === "cancelled") {
      return "bg-red-200 text-red-950 ring-1 ring-red-400";
    }
    return isDarkTheme
      ? "bg-white/20 text-white ring-1 ring-white/25"
      : "bg-slate-200 text-slate-900 ring-1 ring-slate-300";
  }

  const chatListCardClasses = isDarkTheme
    ? "border border-slate-800 bg-[#0b0b0c] text-white"
    : "border border-slate-200 bg-white text-slate-900";
  const chatListHeaderClasses = isDarkTheme
    ? "border-b border-slate-800"
    : "border-b border-slate-200 bg-slate-50/80";
  const chatListSubtitleClasses = isDarkTheme ? "text-slate-300" : "text-slate-600";
  const chatFilterToggleDefaultClasses = isDarkTheme
    ? "border-slate-700 bg-slate-900/60 text-slate-100 hover:bg-slate-800"
    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50";
  const chatFilterPanelClasses = isDarkTheme
    ? "border border-slate-700 bg-[#101012]"
    : "border border-slate-200 bg-white";
  const chatFilterLabelClasses = isDarkTheme ? "text-slate-400" : "text-slate-600";
  const chatFilterInputClasses = isDarkTheme
    ? "w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-slate-500"
    : "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400";
  const chatFilterClearClasses = isDarkTheme
    ? "border-slate-600 text-slate-200 hover:bg-slate-800"
    : "border-slate-300 text-slate-700 hover:bg-slate-50";
  const chatFilterDoneClasses = isDarkTheme
    ? "bg-slate-100 text-slate-900 hover:bg-white"
    : "bg-slate-900 text-white hover:opacity-90";
  const chatListMetaClasses = isDarkTheme ? "text-slate-400" : "text-slate-500";
  const chatListNoteClasses = isDarkTheme ? "text-slate-300" : "text-slate-700";
  const chatListOrderIdClasses = isDarkTheme ? "text-slate-500" : "text-slate-600";
  const chatListEmptyClasses = isDarkTheme ? "text-slate-400" : "text-slate-500";

  const filteredItems = useMemo(() => {
    const query = itemSearch.trim().toLowerCase();
    if (!query) return items;

    return items.filter((item) => {
      const haystack = [
        item.name,
        item.description ?? "",
        (item.properties ?? []).join(" "),
        (item.price_cents / 100).toFixed(2),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [items, itemSearch]);

  const statusFilterOptions = useMemo(() => {
    const preferredOrder = [
      "pending",
      "confirmed",
      "packaging",
      "out_for_delivery",
      "shipped",
      "delivered",
      "cancelled",
      "archived",
    ];
    return Array.from(new Set([...preferredOrder, ...threads.map((thread) => thread.status)]));
  }, [threads]);

  const boardThreads = useMemo(
    () =>
      chatBoardView === "posts"
        ? []
        : threads.filter((thread) =>
            chatBoardView === "archive"
              ? thread.status === "archived"
              : thread.status !== "archived"
          ),
    [threads, chatBoardView]
  );

  const filteredThreads = useMemo(() => {
    const query = chatSearch.trim().toLowerCase();
    const fromDate = chatDateFrom ? new Date(`${chatDateFrom}T00:00:00`) : null;
    const toDate = chatDateTo ? new Date(`${chatDateTo}T23:59:59.999`) : null;

    const minParsed = Number(chatMinTotal);
    const minTotalCents =
      chatMinTotal.trim() === "" || Number.isNaN(minParsed) ? null : Math.round(minParsed * 100);

    const maxParsed = Number(chatMaxTotal);
    const maxTotalCents =
      chatMaxTotal.trim() === "" || Number.isNaN(maxParsed) ? null : Math.round(maxParsed * 100);

    return boardThreads.filter((thread) => {
      if (chatStatusFilter && thread.status !== chatStatusFilter) return false;

      if (query) {
        const searchable = [
          getCustomerLabel(thread),
          thread.id,
          thread.id.slice(0, 8),
          thread.customer_note ?? "",
        ]
          .join(" ")
          .toLowerCase();

        if (!searchable.includes(query)) {
          return false;
        }
      }

      const createdAt = new Date(thread.created_at);
      if (fromDate && createdAt < fromDate) return false;
      if (toDate && createdAt > toDate) return false;
      if (minTotalCents !== null && thread.total_cents < minTotalCents) return false;
      if (maxTotalCents !== null && thread.total_cents > maxTotalCents) return false;

      return true;
    });
  }, [
    boardThreads,
    chatSearch,
    chatDateFrom,
    chatDateTo,
    chatMinTotal,
    chatMaxTotal,
    chatStatusFilter,
    profileMap,
  ]);

  const filteredPosts = useMemo(() => {
    const query = chatSearch.trim().toLowerCase();
    const fromDate = postDateFrom ? new Date(`${postDateFrom}T00:00:00`) : null;
    const toDate = postDateTo ? new Date(`${postDateTo}T23:59:59.999`) : null;

    return posts.filter((post) => {
      if (query) {
        const haystack = [post.title, post.body, getPostAuthorLabel(post)].join(" ").toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }

      const createdAt = new Date(post.created_at);
      if (fromDate && createdAt < fromDate) return false;
      if (toDate && createdAt > toDate) return false;

      return true;
    });
  }, [chatSearch, postDateFrom, postDateTo, common, postAuthorMap, posts]);

  async function loadProducts() {
    const { data, error } = await supabase.from("products").select("*").order("name");

    if (error) {
      notice.showError(error.message);
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
      notice.showError(error.message);
      return;
    }

    const next = (data ?? []) as OrderRow[];
    setThreads(next);

    const userIds = Array.from(new Set(next.map((thread) => thread.user_id).filter(Boolean)));
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", userIds);

      const nextProfileMap: Record<string, Profile> = {};
      for (const profile of profiles ?? []) {
        nextProfileMap[profile.id] = profile as Profile;
      }
      setProfileMap(nextProfileMap);
    } else {
      setProfileMap({});
    }

    if (selectedChatId && !next.some((thread) => thread.id === selectedChatId)) {
      closeChat();
    }
  }

  async function loadPosts(options?: { showLoader?: boolean }) {
    const showLoader = options?.showLoader ?? false;
    if (showLoader) {
      setLoadingPosts(true);
    }

    const { data, error } = await supabase
      .from("posts")
      .select("id, user_id, title, body, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      notice.showError(error.message);
      setLoadingPosts(false);
      return;
    }

    const nextPosts = (data ?? []) as CommunityPost[];
    setPosts(nextPosts);
    setSelectedPostIds((current) => current.filter((id) => nextPosts.some((post) => post.id === id)));

    const userIds = Array.from(new Set(nextPosts.map((post) => post.user_id).filter(Boolean)));
    if (userIds.length === 0) {
      setPostAuthorMap({});
      setLoadingPosts(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    if (profileError) {
      notice.showError(profileError.message);
      setPostAuthorMap({});
      setLoadingPosts(false);
      return;
    }

    const nextAuthorMap: Record<string, string> = {};
    for (const profile of (profileData ?? []) as Array<Pick<Profile, "id" | "full_name">>) {
      if (profile.full_name?.trim()) {
        nextAuthorMap[profile.id] = profile.full_name.trim();
      }
    }
    setPostAuthorMap(nextAuthorMap);
    setLoadingPosts(false);
  }

  async function syncAddressMap(order: Pick<OrderRow, "address_id"> | null, messages: OrderMessage[]) {
    const addressIds = new Set<string>();
    if (order?.address_id) addressIds.add(order.address_id);
    for (const message of messages) {
      if (message.address_id) addressIds.add(message.address_id);
    }

    if (addressIds.size > 0) {
      const { data: addresses } = await supabase
        .from("user_addresses")
        .select("*")
        .in("id", Array.from(addressIds));

      const nextAddressMap: Record<string, Address> = {};
      for (const address of addresses ?? []) {
        nextAddressMap[address.id] = address as Address;
      }
      setAddressMap(nextAddressMap);
      return;
    }

    setAddressMap({});
  }

  async function loadSelectedMessages(orderId: string, order: Pick<OrderRow, "address_id"> | null) {
    const { data: messageData, error: messageError } = await supabase
      .from("order_messages")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at");

    if (messageError) {
      notice.showError(messageError.message);
      return;
    }

    const messages = (messageData ?? []) as OrderMessage[];
    setSelectedMessages(messages);
    await syncAddressMap(order, messages);
  }

  async function loadSelectedOrder(orderId: string, options?: { showLoader?: boolean }) {
    const showLoader = options?.showLoader ?? false;
    if (showLoader) {
      setLoadingChat(true);
    }

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select(
        "id,user_id,status,subtotal_cents,tax_cents,total_cents,customer_note,address_id,created_at,admin_deleted_at,admin_deleted_by"
      )
      .eq("id", orderId)
      .single();

    if (orderError) {
      notice.showError(orderError.message);
      setLoadingChat(false);
      return;
    }

    const [{ data: itemData, error: itemError }, { data: messageData, error: messageError }] =
      await Promise.all([
        supabase.from("order_items").select("*").eq("order_id", orderId).order("name"),
        supabase.from("order_messages").select("*").eq("order_id", orderId).order("created_at"),
      ]);

    if (itemError) {
      notice.showError(itemError.message);
      setLoadingChat(false);
      return;
    }

    if (messageError) {
      notice.showError(messageError.message);
      setLoadingChat(false);
      return;
    }

    const order = orderData as OrderRow;
    const messages = (messageData ?? []) as OrderMessage[];

    setSelectedOrder(order);
    setSelectedItems((itemData ?? []) as OrderItem[]);
    setSelectedMessages(messages);
    await syncAddressMap(order, messages);

    setLoadingChat(false);
  }

  useEffect(() => {
    void loadProducts();
    void loadThreads();
    void loadPosts({ showLoader: true });
  }, []);

  useEffect(() => {
    if (!selectedChatId) return;
    void loadSelectedOrder(selectedChatId, { showLoader: true });
  }, [selectedChatId]);

  useEffect(() => {
    if (activeTab === "items") {
      closeChat();
      setChatFilterOpen(false);
      setBulkActionMenuOpen(false);
      setCurrentActionMenuOpen(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (chatBoardView !== "posts") return;
    closeChat();
    setIsSelecting(false);
    setSelectedBulkIds([]);
    setIsSelectingPosts(false);
    setSelectedPostIds([]);
    setBulkActionMenuOpen(false);
    setCurrentActionMenuOpen(false);
    setChatFilterOpen(false);
  }, [chatBoardView]);

  useEffect(() => {
    if (chatBoardView === "posts") return;
    setIsSelectingPosts(false);
    setSelectedPostIds([]);
  }, [chatBoardView]);

  useEffect(() => {
    if (!selectedChatId) return;
    if (chatBoardView === "posts") {
      closeChat();
      return;
    }

    const selectedThread = threads.find((thread) => thread.id === selectedChatId);
    if (!selectedThread) return;

    const shouldBeVisible =
      chatBoardView === "archive"
        ? selectedThread.status === "archived"
        : selectedThread.status !== "archived";

    if (!shouldBeVisible) {
      closeChat();
    }
  }, [chatBoardView, selectedChatId, threads]);

  useEffect(() => {
    if (!selectedChatId) return;
    shouldStickToBottomRef.current = true;

    const frame = window.requestAnimationFrame(() => {
      const container = messagesContainerRef.current;
      if (!container) return;
      container.scrollTop = container.scrollHeight;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectedChatId]);

  useEffect(() => {
    if (!selectedChatId || !shouldStickToBottomRef.current) return;

    const frame = window.requestAnimationFrame(() => {
      const container = messagesContainerRef.current;
      if (!container) return;
      container.scrollTop = container.scrollHeight;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectedChatId, selectedMessages.length]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-orders-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          void loadThreads();
          const changedOrderId =
            typeof payload.new === "object" && payload.new && "id" in payload.new
              ? String(payload.new.id)
              : typeof payload.old === "object" && payload.old && "id" in payload.old
                ? String(payload.old.id)
                : null;

          if (selectedChatId && changedOrderId === selectedChatId) {
            void loadSelectedOrder(selectedChatId);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_messages" },
        (payload) => {
          void loadThreads();
          const changedOrderId =
            typeof payload.new === "object" && payload.new && "order_id" in payload.new
              ? String(payload.new.order_id)
              : typeof payload.old === "object" && payload.old && "order_id" in payload.old
                ? String(payload.old.order_id)
                : null;

          if (selectedChatId && changedOrderId === selectedChatId) {
            void loadSelectedMessages(selectedChatId, selectedOrder);
          }
        }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => {
        void loadPosts();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedChatId, selectedOrder]);

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
      notice.showError(error.message);
      return;
    }

    setName("");
    setPrice(1);
    setImageUrl("");
    setDescription("");
    setPropertiesInput("");
    await loadProducts();
  }

  async function handleNewImageUpload(file: File) {
    setUploadingNewImage(true);

    try {
      const nextUrl = await uploadProductImage(file);
      setImageUrl(nextUrl);
    } catch (error) {
      notice.showError(error instanceof Error ? error.message : adminCopy.imageUploadFailed);
    } finally {
      setUploadingNewImage(false);
    }
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
      notice.showError(error.message);
      return;
    }

    cancelEditing();
    await loadProducts();
  }

  async function handleEditImageUpload(file: File) {
    setUploadingEditImage(true);

    try {
      const nextUrl = await uploadProductImage(file);
      setEditImageUrl(nextUrl);
    } catch (error) {
      notice.showError(error instanceof Error ? error.message : adminCopy.imageUploadFailed);
    } finally {
      setUploadingEditImage(false);
    }
  }

  async function deleteItem(id: string) {
    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      notice.showError(error.message);
      return;
    }

    await loadProducts();
  }

  function togglePostSelection(postId: string) {
    setSelectedPostIds((prev) =>
      prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]
    );
  }

  function startSelectingPosts() {
    setIsSelectingPosts(true);
    setSelectedPostIds([]);
    setBulkActionMenuOpen(false);
    setChatFilterOpen(false);
  }

  function cancelSelectingPosts() {
    setIsSelectingPosts(false);
    setSelectedPostIds([]);
    setBulkActionMenuOpen(false);
  }

  function selectAllFilteredPosts() {
    setSelectedPostIds(filteredPosts.map((post) => post.id));
  }

  async function deletePostsForAdmin(
    postIds: string[],
    options?: { deletingIds?: string[]; successMessage?: string }
  ) {
    const previousPosts = posts;
    const previousSelectedPostIds = selectedPostIds;
    const deletingIds = options?.deletingIds ?? [];
    const uniquePostIds = Array.from(new Set(postIds));

    if (deletingIds.length > 0) {
      setDeletingPostIds((current) => Array.from(new Set([...current, ...deletingIds])));
    } else {
      setDeletingSelectedPosts(true);
    }

    setPosts((current) => current.filter((post) => !uniquePostIds.includes(post.id)));
    setSelectedPostIds((current) => current.filter((id) => !uniquePostIds.includes(id)));

    const { data: deletedRows, error } = await supabase
      .from("posts")
      .delete()
      .in("id", uniquePostIds)
      .select("id");

    if (deletingIds.length > 0) {
      setDeletingPostIds((current) => current.filter((id) => !deletingIds.includes(id)));
    } else {
      setDeletingSelectedPosts(false);
    }

    if (error) {
      setPosts(previousPosts);
      setSelectedPostIds(previousSelectedPostIds);
      notice.showError(error.message);
      return false;
    }

    if ((deletedRows ?? []).length !== uniquePostIds.length) {
      setPosts(previousPosts);
      setSelectedPostIds(previousSelectedPostIds);
      notice.showWarning(adminCopy.somePostsDeleteFailed);
      await loadPosts();
      return false;
    }

    if (!deletingIds.length) {
      cancelSelectingPosts();
    }

    if (options?.successMessage) {
      notice.showSuccess(options.successMessage);
    }

    return true;
  }

  async function deleteSelectedPostsForAdmin() {
    if (selectedPostIds.length === 0) {
      notice.showWarning(adminCopy.selectPostFirst);
      return;
    }

    const ok = await notice.confirm(adminCopy.confirmDeleteSelectedPosts(selectedPostIds.length), {
      cancelLabel: common.cancel,
      confirmLabel: common.delete,
      variant: "error",
    });
    if (!ok) return;

    await deletePostsForAdmin(selectedPostIds, {
      successMessage: adminCopy.postsDeleted(selectedPostIds.length),
    });
  }

  async function deleteSinglePostForAdmin(post: CommunityPost) {
    const ok = await notice.confirm(adminCopy.confirmDeletePost(post.title), {
      cancelLabel: common.cancel,
      confirmLabel: common.delete,
      variant: "error",
    });
    if (!ok) return;

    await deletePostsForAdmin([post.id], {
      deletingIds: [post.id],
      successMessage: adminCopy.postDeleted,
    });
  }

  function toggleBulkSelection(orderId: string) {
    setSelectedBulkIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  }

  function startSelecting() {
    setIsSelecting(true);
    setSelectedBulkIds([]);
    setBulkActionMenuOpen(false);
  }

  function cancelSelecting() {
    setIsSelecting(false);
    setSelectedBulkIds([]);
    setBulkActionMenuOpen(false);
  }

  function selectAllFilteredChats() {
    setSelectedBulkIds(filteredThreads.map((thread) => thread.id));
  }

  async function updateOrderStatuses(orderIds: string[], nextStatus: string) {
    const { error } = await supabase.from("orders").update({ status: nextStatus }).in("id", orderIds);
    if (error) {
      notice.showError(error.message);
      return false;
    }
    return true;
  }

  async function archiveOrdersFromAdmin(orderIds: string[]) {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      notice.showError(adminCopy.adminNotFound);
      return false;
    }

    const { error } = await supabase
      .from("orders")
      .update({
        admin_deleted_at: new Date().toISOString(),
        admin_deleted_by: user.id,
      })
      .in("id", orderIds);

    if (error) {
      notice.showError(error.message);
      return false;
    }

    return true;
  }

  async function applyStatusToSelectedChats(nextStatus: string, actionLabel: string) {
    if (selectedBulkIds.length === 0) {
      notice.showWarning(adminCopy.selectChatFirst);
      return;
    }

    const ok = await notice.confirm(adminCopy.confirmMarkSelectedStatus(formatStatus(nextStatus)), {
      cancelLabel: common.cancel,
      confirmLabel: actionLabel,
      variant: "success",
    });
    if (!ok) return;

    const updated = await updateOrderStatuses(selectedBulkIds, nextStatus);
    if (!updated) return;

    if (selectedChatId && selectedBulkIds.includes(selectedChatId)) {
      if (nextStatus === "archived") {
        setChatBoardView("archive");
      } else if (chatBoardView === "archive") {
        setChatBoardView("orders");
      }
      await loadSelectedOrder(selectedChatId);
    }

    cancelSelecting();
    await loadThreads();
  }

  async function markSelectedAsDelivered() {
    await applyStatusToSelectedChats("delivered", markDeliveredLabel);
  }

  async function markSelectedAsOnTheWay() {
    await applyStatusToSelectedChats("out_for_delivery", markOnTheWayLabel);
  }

  async function markSelectedAsPackaging() {
    await applyStatusToSelectedChats("packaging", markPackagingLabel);
  }

  async function archiveSelectedChats() {
    await applyStatusToSelectedChats("archived", archiveLabel);
  }

  async function deleteSelectedChatsForAdmin() {
    if (selectedBulkIds.length === 0) {
      notice.showWarning(adminCopy.selectChatFirst);
      return;
    }

    const ok = await notice.confirm(adminCopy.confirmHideSelectedChats, {
      cancelLabel: common.cancel,
      confirmLabel: common.delete,
      variant: "error",
    });
    if (!ok) return;

    const archived = await archiveOrdersFromAdmin(selectedBulkIds);
    if (!archived) return;

    if (selectedChatId && selectedBulkIds.includes(selectedChatId)) {
      closeChat();
    }

    cancelSelecting();
    await loadThreads();
  }

  async function applyStatusToCurrentChat(nextStatus: string, actionLabel: string) {
    if (!selectedChatId) return;

    const ok = await notice.confirm(adminCopy.confirmMarkCurrentStatus(formatStatus(nextStatus)), {
      cancelLabel: common.cancel,
      confirmLabel: actionLabel,
      variant: "success",
    });
    if (!ok) return;

    const updated = await updateOrderStatuses([selectedChatId], nextStatus);
    if (!updated) return;

    if (nextStatus === "archived") {
      setChatBoardView("archive");
    } else if (chatBoardView === "archive") {
      setChatBoardView("orders");
    }

    await loadThreads();
    await loadSelectedOrder(selectedChatId);
  }

  async function markCurrentAsDelivered() {
    await applyStatusToCurrentChat("delivered", markDeliveredLabel);
  }

  async function markCurrentAsOnTheWay() {
    await applyStatusToCurrentChat("out_for_delivery", markOnTheWayLabel);
  }

  async function markCurrentAsPackaging() {
    await applyStatusToCurrentChat("packaging", markPackagingLabel);
  }

  async function archiveCurrentChat() {
    await applyStatusToCurrentChat("archived", archiveLabel);
  }

  async function deleteCurrentChatForAdmin() {
    if (!selectedChatId) return;

    const ok = await notice.confirm(adminCopy.confirmHideSelectedChats, {
      cancelLabel: common.cancel,
      confirmLabel: common.delete,
      variant: "error",
    });
    if (!ok) return;

    const archived = await archiveOrdersFromAdmin([selectedChatId]);
    if (!archived) return;

    closeChat();
    await loadThreads();
  }

  function openChat(orderId: string) {
    shouldStickToBottomRef.current = true;
    setChatFilterOpen(false);
    setBulkActionMenuOpen(false);
    setIsSummaryOpen(false);
    setIsAddressOpen(false);
    setCurrentActionMenuOpen(false);
    setReplyBody("");
    setSelectedOrder(null);
    setSelectedItems([]);
    setSelectedMessages([]);
    setLoadingChat(true);
    setSelectedChatId(orderId);
  }

  function handleConversationScroll() {
    const container = messagesContainerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 48;
  }

  async function submitReply() {
    const nextBody = replyBody.trim();
    if (!selectedChatId || !nextBody || sendingReply) return;

    setSendingReply(true);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setSendingReply(false);
      notice.showError(adminCopy.adminNotFound);
      return;
    }

    const optimisticId = `temp-${Date.now()}`;
    const optimisticMessage: OrderMessage = {
      id: optimisticId,
      order_id: selectedChatId,
      sender_user_id: user.id,
      message_type: "text",
      body: nextBody,
      address_id: null,
      created_at: new Date().toISOString(),
    };

    shouldStickToBottomRef.current = true;
    setReplyBody("");
    setSelectedMessages((prev) => [...prev, optimisticMessage]);

    const { error } = await supabase.from("order_messages").insert({
      order_id: selectedChatId,
      sender_user_id: user.id,
      message_type: "text",
      body: nextBody,
    });

    setSendingReply(false);

    if (error) {
      setSelectedMessages((prev) => prev.filter((message) => message.id !== optimisticId));
      setReplyBody(nextBody);
      notice.showError(error.message);
    }
  }

  function sendReply(e: React.FormEvent) {
    e.preventDefault();
    void submitReply();
  }

  function handleReplyKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    void submitReply();
  }

  function closeChat() {
    shouldStickToBottomRef.current = true;
    setIsSummaryOpen(false);
    setIsAddressOpen(false);
    setCurrentActionMenuOpen(false);
    setSelectedChatId(null);
    setSelectedOrder(null);
    setSelectedItems([]);
    setSelectedMessages([]);
    setReplyBody("");
    setLoadingChat(false);
  }

  function renderAddress(addressId: string | null | undefined) {
    if (!addressId) return null;

    const address = addressMap[addressId];
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

  const selectedOrderShippingCents = selectedOrder
    ? Math.max(0, selectedOrder.total_cents - selectedOrder.subtotal_cents - selectedOrder.tax_cents)
    : 0;
  const hasAdvancedChatFilters =
    chatBoardView === "posts"
      ? !!postDateFrom || !!postDateTo
      : !!chatDateFrom ||
        !!chatDateTo ||
        !!chatMinTotal.trim() ||
        !!chatMaxTotal.trim() ||
        !!chatStatusFilter;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
              {adminCopy.dashboardTitle}
            </h1>
            <p className="mt-3 text-slate-600">{adminCopy.dashboardSubtitle}</p>
          </div>

          <div className="inline-flex rounded-full border border-slate-300 bg-slate-100 p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                activeTab === "chat"
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-white hover:text-slate-900"
              }`}
            >
              {adminCopy.tabChat}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("items")}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                activeTab === "items"
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-white hover:text-slate-900"
              }`}
            >
              {adminCopy.tabItems}
            </button>
          </div>
        </div>

        {activeTab === "items" ? (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="text-sm font-semibold">{adminCopy.addProduct}</div>

              <form onSubmit={addItem} className="mt-4 grid gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    {adminCopy.productName}
                  </label>
                  <input
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2 outline-none transition focus:border-slate-400"
                    placeholder={adminCopy.productName}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <ProductImageField
                  label={adminCopy.productImage}
                  value={imageUrl}
                  previewAlt={name || adminCopy.newProductImage}
                  uploading={uploadingNewImage}
                  onChange={setImageUrl}
                  onUpload={handleNewImageUpload}
                />

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    {adminCopy.priceUsd}
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
                    {adminCopy.tags}
                  </label>
                  <input
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2 outline-none transition focus:border-slate-400"
                    placeholder={adminCopy.tagsPlaceholder}
                    value={propertiesInput}
                    onChange={(e) => setPropertiesInput(e.target.value)}
                  />
                  <div className="mt-1 text-xs text-slate-500">
                    {adminCopy.tagsHint}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    {adminCopy.description}
                  </label>
                  <textarea
                    className="min-h-[120px] w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
                    placeholder={adminCopy.descriptionPlaceholder}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-white hover:opacity-90"
                  >
                    {adminCopy.addProductButton}
                  </button>
                </div>
              </form>
            </Card>

            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold">{adminCopy.products}</div>
                <div className="text-xs text-slate-500">
                  {common.shownCount(filteredItems.length, items.length)}
                </div>
              </div>

              <div className="mt-3">
                <input
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder={adminCopy.searchItemsPlaceholder}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none transition focus:border-slate-400"
                />
              </div>

              <div className="mt-4 space-y-4">
                {items.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                    {adminCopy.noProductsYet}
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                    {adminCopy.noProductsMatch}
                  </div>
                ) : (
                  filteredItems.map((item) => {
                    const isEditing = editingId === item.id;

                    return (
                      <div key={item.id} className="rounded-3xl border border-slate-200 px-4 py-4">
                        {isEditing ? (
                          <div className="grid gap-4">
                            <ProductImageField
                              label={adminCopy.productImage}
                              value={editImageUrl}
                              previewAlt={editName || item.name}
                              uploading={uploadingEditImage}
                              onChange={setEditImageUrl}
                              onUpload={handleEditImageUpload}
                            />

                            <div className="grid gap-3 md:grid-cols-2">
                              <input
                                className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder={adminCopy.productName}
                              />
                              <input
                                className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                                type="number"
                                min="0"
                                step="0.01"
                                value={editPrice}
                                onChange={(e) => setEditPrice(Number(e.target.value))}
                                placeholder={adminCopy.pricePlaceholder}
                              />
                              <input
                                className="w-full rounded-2xl border border-slate-200 px-4 py-2 md:col-span-2"
                                value={editPropertiesInput}
                                onChange={(e) => setEditPropertiesInput(e.target.value)}
                                placeholder={adminCopy.tagsPlaceholder}
                              />
                            </div>

                            <textarea
                              className="min-h-[120px] w-full rounded-2xl border border-slate-200 px-4 py-3"
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              placeholder={adminCopy.productDescriptionPlaceholder}
                            />

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => saveItem(item.id)}
                                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white"
                              >
                                {common.save}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditing}
                                className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700"
                              >
                                {common.cancel}
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
                                <div className="truncate font-medium text-slate-900">
                                  {item.name}
                                </div>
                                <div className="mt-1 text-sm text-slate-600">
                                  {money(item.price_cents)} -{" "}
                                  {item.in_stock ? adminCopy.inStock : adminCopy.outOfStock}
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
                                {adminCopy.edit}
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteItem(item.id)}
                                className="rounded-2xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100"
                              >
                                {common.delete}
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
        ) : null}

        {activeTab === "chat" ? (
          <div
            className={`grid gap-4 ${
              chatBoardView !== "posts" && selectedChatId
                ? "grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)]"
                : "grid-cols-1"
            }`}
          >
            <Card
              className={`flex h-[calc(100vh-12rem)] min-h-[620px] max-h-[860px] flex-col overflow-visible p-0 shadow-2xl ${chatListCardClasses}`}
            >
              <div className={`px-5 py-4 ${chatListHeaderClasses}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {chatBoardView === "posts" ? adminCopy.communityPosts : adminCopy.customerChats}
                    </h2>
                    <p className={`mt-1 text-sm ${chatListSubtitleClasses}`}>
                      {chatBoardView === "posts"
                        ? adminCopy.communityPostsSubtitle
                        : adminCopy.customerChatsSubtitle}
                    </p>
                    <div className="mt-3 inline-flex rounded-full border border-slate-300 bg-slate-100 p-1 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setChatBoardView("orders")}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          chatBoardView === "orders"
                            ? "bg-slate-900 text-white"
                            : "text-slate-700 hover:bg-white hover:text-slate-900"
                        }`}
                      >
                        {ordersTabLabel}
                      </button>
                      <button
                        type="button"
                        onClick={() => setChatBoardView("archive")}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          chatBoardView === "archive"
                            ? "bg-slate-900 text-white"
                            : "text-slate-700 hover:bg-white hover:text-slate-900"
                        }`}
                      >
                        {archiveTabLabel}
                      </button>
                      <button
                        type="button"
                        onClick={() => setChatBoardView("posts")}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          chatBoardView === "posts"
                            ? "bg-slate-900 text-white"
                            : "text-slate-700 hover:bg-white hover:text-slate-900"
                        }`}
                      >
                        {postsTabLabel}
                      </button>
                    </div>
                  </div>

                  {chatBoardView === "posts" ? (
                    !isSelectingPosts ? (
                      <button
                        type="button"
                        onClick={startSelectingPosts}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
                      >
                        {adminCopy.select}
                      </button>
                    ) : (
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={selectAllFilteredPosts}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
                        >
                          {selectAllLabel}
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteSelectedPostsForAdmin()}
                          disabled={deletingSelectedPosts}
                          className="rounded-xl border border-red-300 bg-red-100 px-3 py-2 text-xs font-semibold text-red-900 shadow-sm hover:bg-red-200 disabled:opacity-60"
                        >
                          {deletingSelectedPosts ? common.deleting : common.delete}
                        </button>
                        <button
                          type="button"
                          onClick={cancelSelectingPosts}
                          aria-label={common.cancel}
                          title={common.cancel}
                          className={`inline-flex h-9 w-9 items-center justify-center transition ${
                            isDarkTheme ? "text-slate-300 hover:text-white" : "text-slate-500 hover:text-slate-900"
                          }`}
                        >
                          <i className="fa-solid fa-xmark" aria-hidden="true" />
                        </button>
                      </div>
                    )
                  ) : !isSelecting ? (
                    <button
                      type="button"
                      onClick={startSelecting}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
                    >
                      {adminCopy.select}
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={selectAllFilteredChats}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
                      >
                        {selectAllLabel}
                      </button>
                      <div className="hidden flex-wrap gap-2 md:flex">
                        <button
                          type="button"
                          onClick={markSelectedAsDelivered}
                          className="rounded-xl border border-emerald-300 bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-900 shadow-sm hover:bg-emerald-200"
                        >
                          {markDeliveredLabel}
                        </button>
                        <button
                          type="button"
                          onClick={archiveSelectedChats}
                          className="rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm hover:bg-slate-200"
                        >
                          {archiveLabel}
                        </button>
                        <button
                          type="button"
                          onClick={markSelectedAsOnTheWay}
                          className="rounded-xl border border-cyan-300 bg-cyan-100 px-3 py-2 text-xs font-semibold text-cyan-900 shadow-sm hover:bg-cyan-200"
                        >
                          {markOnTheWayLabel}
                        </button>
                        <button
                          type="button"
                          onClick={markSelectedAsPackaging}
                          className="rounded-xl border border-orange-300 bg-orange-100 px-3 py-2 text-xs font-semibold text-orange-900 shadow-sm hover:bg-orange-200"
                        >
                          {markPackagingLabel}
                        </button>
                        <button
                          type="button"
                          onClick={deleteSelectedChatsForAdmin}
                          className="rounded-xl border border-red-300 bg-red-100 px-3 py-2 text-xs font-semibold text-red-900 shadow-sm hover:bg-red-200"
                        >
                          {common.delete}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBulkActionMenuOpen(true)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-100 md:hidden"
                      >
                        <i className="fa-solid fa-ellipsis" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelSelecting}
                        aria-label={common.cancel}
                        title={common.cancel}
                        className={`inline-flex h-9 w-9 items-center justify-center transition ${
                          isDarkTheme ? "text-slate-300 hover:text-white" : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        <i className="fa-solid fa-xmark" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="relative mt-4">
                  <div className="flex items-center gap-2">
                    <input
                      value={chatSearch}
                      onChange={(e) => setChatSearch(e.target.value)}
                      placeholder={
                        chatBoardView === "posts"
                          ? adminCopy.searchPostsPlaceholder
                          : adminCopy.searchCustomersPlaceholder
                      }
                      className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                    />

                    <button
                      type="button"
                      aria-label={adminCopy.openFilters}
                      aria-expanded={chatFilterOpen}
                      onClick={() => setChatFilterOpen((prev) => !prev)}
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border text-sm transition ${
                        hasAdvancedChatFilters
                          ? "border-slate-200 bg-slate-100 text-slate-900"
                          : chatFilterToggleDefaultClasses
                      }`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="h-4 w-4"
                        aria-hidden="true"
                      >
                        <path d="M3.75 5.25A.75.75 0 0 1 4.5 4.5h15a.75.75 0 0 1 .53 1.28l-5.72 5.72a.75.75 0 0 0-.22.53v6.72a.75.75 0 0 1-1.06.68l-2.25-1.06a.75.75 0 0 1-.44-.68v-5.66a.75.75 0 0 0-.22-.53L3.97 5.78a.75.75 0 0 1-.22-.53Z" />
                      </svg>
                    </button>
                  </div>

                  {chatFilterOpen ? (
                    <div
                      className={`absolute right-0 z-20 mt-2 w-full max-w-sm rounded-2xl p-4 shadow-2xl animate-scale-in ${chatFilterPanelClasses}`}
                    >
                      <div className={`text-xs font-semibold uppercase tracking-[0.18em] mb-4 ${isDarkTheme ? "text-slate-300" : "text-slate-700"}`}>
                        <i className="fa-solid fa-sliders mr-2 text-[rgb(213,120,28)]" aria-hidden="true" />
                        {adminCopy.advancedFilters}
                      </div>

                      <div className="grid gap-4">
                        <div className="grid grid-cols-2 gap-3">
                          <DateField
                            label={adminCopy.fromDate}
                            value={chatBoardView === "posts" ? postDateFrom : chatDateFrom}
                            onChange={(v) => chatBoardView === "posts" ? setPostDateFrom(v) : setChatDateFrom(v)}
                            isDark={isDarkTheme}
                          />
                          <DateField
                            label={adminCopy.toDate}
                            value={chatBoardView === "posts" ? postDateTo : chatDateTo}
                            onChange={(v) => chatBoardView === "posts" ? setPostDateTo(v) : setChatDateTo(v)}
                            isDark={isDarkTheme}
                          />
                        </div>

                        {chatBoardView === "posts" ? null : (
                          <>
                            <div className="date-field-wrapper">
                              <label className="date-field-label">
                                <i className="fa-solid fa-tag date-field-icon" aria-hidden="true" />
                                {common.status}
                              </label>
                              <select
                                value={chatStatusFilter}
                                onChange={(e) => setChatStatusFilter(e.target.value)}
                                className={chatFilterInputClasses}
                              >
                                <option value="">{allStatusesLabel}</option>
                                {statusFilterOptions.map((status) => (
                                  <option key={status} value={status}>
                                    {formatStatus(status)}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="date-field-wrapper">
                                <label className="date-field-label">
                                  <i className="fa-solid fa-arrow-down-to-bracket date-field-icon" aria-hidden="true" />
                                  {adminCopy.minTotal}
                                </label>
                                <div className="date-field-input-wrap">
                                  <i className="fa-solid fa-dollar-sign date-field-cal-icon" aria-hidden="true" />
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={chatMinTotal}
                                    onChange={(e) => setChatMinTotal(e.target.value)}
                                    placeholder="0.00"
                                    className="date-field-input placeholder:text-slate-400"
                                  />
                                </div>
                              </div>

                              <div className="date-field-wrapper">
                                <label className="date-field-label">
                                  <i className="fa-solid fa-arrow-up-from-bracket date-field-icon" aria-hidden="true" />
                                  {adminCopy.maxTotal}
                                </label>
                                <div className="date-field-input-wrap">
                                  <i className="fa-solid fa-dollar-sign date-field-cal-icon" aria-hidden="true" />
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={chatMaxTotal}
                                    onChange={(e) => setChatMaxTotal(e.target.value)}
                                    placeholder="999.99"
                                    className="date-field-input placeholder:text-slate-400"
                                  />
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="mt-5 flex items-center justify-between gap-2 border-t pt-3" style={{ borderColor: isDarkTheme ? "rgb(78,58,36)" : "rgb(210,196,178)" }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (chatBoardView === "posts") {
                              setPostDateFrom("");
                              setPostDateTo("");
                              return;
                            }
                            setChatDateFrom("");
                            setChatDateTo("");
                            setChatStatusFilter("");
                            setChatMinTotal("");
                            setChatMaxTotal("");
                          }}
                          className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${chatFilterClearClasses}`}
                        >
                          <i className="fa-solid fa-rotate-left mr-1.5 text-[10px]" aria-hidden="true" />
                          {common.clear}
                        </button>

                        <button
                          type="button"
                          onClick={() => setChatFilterOpen(false)}
                          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${chatFilterDoneClasses}`}
                        >
                          <i className="fa-solid fa-check mr-1.5 text-[10px]" aria-hidden="true" />
                          {common.done}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className={`mt-2 text-xs ${chatListMetaClasses}`}>
                  {chatBoardView === "posts"
                    ? common.shownCount(filteredPosts.length, posts.length)
                    : common.shownCount(filteredThreads.length, boardThreads.length)}
                </div>

                {chatBoardView !== "posts" && bulkActionMenuOpen ? (
                  <div
                    className="fixed inset-0 z-50 md:hidden"
                    onClick={() => setBulkActionMenuOpen(false)}
                  >
                    <div className="absolute inset-0 bg-slate-950/30" />
                    <div
                      className="absolute right-4 top-20 w-64 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
                          {markMenuHeaderLabel}
                        </div>
                        <button
                          type="button"
                          onClick={() => setBulkActionMenuOpen(false)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-600"
                          aria-label={common.close}
                        >
                          <i className="fa-solid fa-xmark" aria-hidden="true" />
                        </button>
                      </div>

                      <div className="mt-3 grid gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void markSelectedAsDelivered();
                            setBulkActionMenuOpen(false);
                          }}
                          className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-left text-sm font-semibold text-emerald-800"
                        >
                          {markDeliveredLabel}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void archiveSelectedChats();
                            setBulkActionMenuOpen(false);
                          }}
                          className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-800"
                        >
                          {archiveLabel}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void markSelectedAsOnTheWay();
                            setBulkActionMenuOpen(false);
                          }}
                          className="rounded-xl border border-cyan-300 bg-cyan-50 px-3 py-2 text-left text-sm font-semibold text-cyan-800"
                        >
                          {markOnTheWayLabel}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void markSelectedAsPackaging();
                            setBulkActionMenuOpen(false);
                          }}
                          className="rounded-xl border border-orange-300 bg-orange-50 px-3 py-2 text-left text-sm font-semibold text-orange-800"
                        >
                          {markPackagingLabel}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void deleteSelectedChatsForAdmin();
                            setBulkActionMenuOpen(false);
                          }}
                          className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-left text-sm font-semibold text-red-800"
                        >
                          {common.delete}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div
                className={`min-h-0 flex-1 overflow-y-auto ${
                  isDarkTheme ? "divide-y divide-slate-800" : "divide-y divide-slate-200"
                }`}
              >
                {chatBoardView === "posts" ? (
                  loadingPosts ? (
                    <div
                      className={`flex h-full min-h-[560px] items-center justify-center px-6 text-sm ${chatListEmptyClasses}`}
                    >
                      {common.loading}
                    </div>
                  ) : posts.length === 0 ? (
                    <div
                      className={`flex h-full min-h-[560px] items-center justify-center px-6 text-sm ${chatListEmptyClasses}`}
                    >
                      {adminCopy.noPostsYet}
                    </div>
                  ) : filteredPosts.length === 0 ? (
                    <div
                      className={`flex h-full min-h-[560px] items-center justify-center px-6 text-sm ${chatListEmptyClasses}`}
                    >
                      {adminCopy.noPostsMatch}
                    </div>
                  ) : (
                    filteredPosts.map((post) => (
                      <div key={post.id} className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          {isSelectingPosts ? (
                            <input
                              type="checkbox"
                              checked={selectedPostIds.includes(post.id)}
                              onChange={() => togglePostSelection(post.id)}
                              className="mt-1 h-4 w-4 rounded accent-slate-700"
                            />
                          ) : null}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <div
                                className={`truncate text-[15px] font-semibold ${
                                  isDarkTheme ? "text-white" : "text-slate-900"
                                }`}
                              >
                                {post.title}
                              </div>
                              <div className="flex items-center gap-2">
                                <div className={`shrink-0 text-xs ${chatListMetaClasses}`}>
                                  {formatTime(post.created_at)}
                                </div>
                                {!isSelectingPosts ? (
                                  <button
                                    type="button"
                                    onClick={() => void deleteSinglePostForAdmin(post)}
                                    disabled={deletingPostIds.includes(post.id)}
                                    className="rounded-lg border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                                  >
                                    {deletingPostIds.includes(post.id) ? common.deleting : common.delete}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                            <div className={`mt-1 text-xs ${chatListMetaClasses}`}>
                              {getPostAuthorLabel(post)}
                            </div>
                            <div className={`mt-2 line-clamp-3 text-sm ${chatListNoteClasses}`}>
                              {post.body}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )
                ) : boardThreads.length === 0 ? (
                  <div
                    className={`flex h-full min-h-[560px] items-center justify-center px-6 text-sm ${chatListEmptyClasses}`}
                  >
                    {chatBoardView === "archive" ? noArchivedChatsLabel : adminCopy.noOrderChats}
                  </div>
                ) : filteredThreads.length === 0 ? (
                  <div
                    className={`flex h-full min-h-[560px] items-center justify-center px-6 text-sm ${chatListEmptyClasses}`}
                  >
                    {adminCopy.noChatsMatch}
                  </div>
                ) : (
                  filteredThreads.map((thread) => {
                    const active = selectedChatId === thread.id;
                    const checked = selectedBulkIds.includes(thread.id);

                    return (
                      <div
                        key={thread.id}
                        className={`flex items-start gap-3 px-5 py-4 transition ${
                          isDarkTheme
                            ? active
                              ? "bg-white/10"
                              : "bg-transparent hover:bg-white/5"
                            : active
                              ? "bg-slate-100"
                              : "bg-transparent hover:bg-slate-50"
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
                          onClick={() => openChat(thread.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div
                              className={`truncate text-[15px] font-semibold ${
                                isDarkTheme ? "text-white" : "text-slate-900"
                              }`}
                            >
                              {getCustomerLabel(thread)}
                            </div>
                            <div className={`shrink-0 text-xs ${chatListMetaClasses}`}>
                              {formatTime(thread.created_at)}
                            </div>
                          </div>

                          <div className={`mt-1 truncate text-sm ${chatListNoteClasses}`}>
                            {thread.customer_note || common.orderPreviewTotal(money(thread.total_cents))}
                          </div>

                          <div className="mt-2 flex items-center gap-2 text-xs">
                            <span
                              className={`rounded-full px-2.5 py-1 font-semibold ${getStatusClasses(
                                thread.status
                              )}`}
                            >
                              {formatStatus(thread.status)}
                            </span>
                            <span className={chatListOrderIdClasses}>{common.orderId(thread.id)}</span>
                          </div>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            {chatBoardView !== "posts" && selectedChatId ? (
              <Card className="flex h-[calc(100vh-12rem)] min-h-[620px] max-h-[860px] flex-col overflow-hidden border border-slate-200 bg-white p-0 shadow-2xl">
                {loadingChat ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-600">
                    {adminCopy.loadingChat}
                  </div>
                ) : !selectedOrder ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-600">
                    {adminCopy.orderNotFound}
                  </div>
                ) : (
                  <>
                    <div className="border-b border-slate-200 bg-white px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900">
                            {getCustomerLabel(selectedOrder)}
                          </div>
                          <div className="mt-1 text-sm text-slate-600">
                            {common.orderId(selectedOrder.id)}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                                selectedOrder.status
                              )}`}
                            >
                              {formatStatus(selectedOrder.status)}
                            </span>
                            <span className="text-xs text-slate-500">
                              {formatTime(selectedOrder.created_at)}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <div className="hidden flex-wrap gap-2 md:flex">
                            <button
                              type="button"
                              onClick={markCurrentAsDelivered}
                              className="rounded-2xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                            >
                              {markDeliveredLabel}
                            </button>
                            <button
                              type="button"
                              onClick={archiveCurrentChat}
                              className="rounded-2xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                            >
                              {archiveLabel}
                            </button>
                            <button
                              type="button"
                              onClick={markCurrentAsOnTheWay}
                              className="rounded-2xl border border-cyan-300 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700 hover:bg-cyan-100"
                            >
                              {markOnTheWayLabel}
                            </button>
                            <button
                              type="button"
                              onClick={markCurrentAsPackaging}
                              className="rounded-2xl border border-orange-300 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100"
                            >
                              {markPackagingLabel}
                            </button>
                            <button
                              type="button"
                              onClick={deleteCurrentChatForAdmin}
                              className="rounded-2xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                            >
                              {common.delete}
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => setCurrentActionMenuOpen(true)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 md:hidden"
                            aria-label={markMenuHeaderLabel}
                          >
                            <i className="fa-solid fa-ellipsis" aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            onClick={closeChat}
                            className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {common.close}
                          </button>
                        </div>
                      </div>

                      {currentActionMenuOpen ? (
                        <div
                          className="fixed inset-0 z-50 md:hidden"
                          onClick={() => setCurrentActionMenuOpen(false)}
                        >
                          <div className="absolute inset-0 bg-slate-950/30" />
                          <div
                            className="absolute right-4 top-20 w-64 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
                                {markMenuHeaderLabel}
                              </div>
                              <button
                                type="button"
                                onClick={() => setCurrentActionMenuOpen(false)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-600"
                                aria-label={common.close}
                              >
                                <i className="fa-solid fa-xmark" aria-hidden="true" />
                              </button>
                            </div>

                            <div className="mt-3 grid gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  void markCurrentAsDelivered();
                                  setCurrentActionMenuOpen(false);
                                }}
                                className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-left text-sm font-semibold text-emerald-800"
                              >
                                {markDeliveredLabel}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void archiveCurrentChat();
                                  setCurrentActionMenuOpen(false);
                                }}
                                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-800"
                              >
                                {archiveLabel}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void markCurrentAsOnTheWay();
                                  setCurrentActionMenuOpen(false);
                                }}
                                className="rounded-xl border border-cyan-300 bg-cyan-50 px-3 py-2 text-left text-sm font-semibold text-cyan-800"
                              >
                                {markOnTheWayLabel}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void markCurrentAsPackaging();
                                  setCurrentActionMenuOpen(false);
                                }}
                                className="rounded-xl border border-orange-300 bg-orange-50 px-3 py-2 text-left text-sm font-semibold text-orange-800"
                              >
                                {markPackagingLabel}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void deleteCurrentChatForAdmin();
                                  setCurrentActionMenuOpen(false);
                                }}
                                className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-left text-sm font-semibold text-red-800"
                              >
                                {common.delete}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-4 grid gap-3 xl:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50">
                          <button
                            type="button"
                            aria-expanded={isSummaryOpen}
                            onClick={() => setIsSummaryOpen((prev) => !prev)}
                            className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                          >
                            <div>
                              <div className="text-sm font-semibold text-slate-900">
                                {adminCopy.orderSummary}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {isSummaryOpen ? adminCopy.hideDetails : adminCopy.showDetails}
                              </div>
                            </div>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                              {isSummaryOpen ? common.close : common.open}
                            </span>
                          </button>

                          {isSummaryOpen ? (
                            <div className="max-h-64 overflow-y-auto border-t border-slate-200 px-4 py-4">
                              <div className="space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-600">{common.subtotal}</span>
                                  <span>{money(selectedOrder.subtotal_cents)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-600">{common.tax}</span>
                                  <span>{money(selectedOrder.tax_cents)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-600">{common.shipping}</span>
                                  <span>{money(selectedOrderShippingCents)}</span>
                                </div>
                                <div className="flex items-center justify-between font-semibold text-slate-900">
                                  <span>{common.total}</span>
                                  <span>{money(selectedOrder.total_cents)}</span>
                                </div>
                              </div>

                              {selectedItems.length > 0 ? (
                                <div className="mt-4 border-t border-slate-200 pt-4">
                                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {common.items}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {selectedItems.map((item) => (
                                      <span
                                        key={item.id}
                                        className="rounded-full bg-white px-3 py-1 text-xs text-slate-700 ring-1 ring-slate-200"
                                      >
                                        {item.name} x {item.qty}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50">
                          <button
                            type="button"
                            aria-expanded={isAddressOpen}
                            onClick={() => setIsAddressOpen((prev) => !prev)}
                            className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                          >
                            <div>
                              <div className="text-sm font-semibold text-slate-900">
                                {common.deliveryAddress}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {isAddressOpen ? adminCopy.hideAddress : adminCopy.showAddress}
                              </div>
                            </div>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                              {isAddressOpen ? common.close : common.open}
                            </span>
                          </button>

                          {isAddressOpen ? (
                            <div className="max-h-64 overflow-y-auto border-t border-slate-200 px-4 py-4">
                              {renderAddress(selectedOrder.address_id) ?? (
                                <div className="text-sm text-slate-600">
                                  {adminCopy.noAddressShared}
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div
                      ref={messagesContainerRef}
                      onScroll={handleConversationScroll}
                      className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4"
                    >
                      {selectedMessages.length === 0 ? (
                        <div className="flex h-full min-h-[240px] items-center justify-center text-sm text-slate-600">
                          {adminCopy.noMessagesYet}
                        </div>
                      ) : (
                        selectedMessages.map((message) => {
                          const isAddress = message.message_type === "address";
                          const isCustomer = message.sender_user_id === selectedOrder.user_id;

                          return (
                            <div
                              key={message.id}
                              className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-[24px] px-4 py-3 text-sm shadow-sm ${
                                  isCustomer
                                    ? "border border-slate-200 bg-white text-slate-900"
                                    : "bg-slate-900 text-white"
                                }`}
                              >
                                <div
                                  className={`text-xs ${
                                    isCustomer ? "text-slate-500" : "text-slate-300"
                                  }`}
                                >
                                  {isCustomer ? getCustomerLabel(selectedOrder) : common.admin} -{" "}
                                  {formatTime(message.created_at)}
                                </div>

                                <div className="mt-2">
                                  {isAddress ? renderAddress(message.address_id) : null}
                                  {!isAddress ? (
                                    <div className={isCustomer ? "text-slate-800" : "text-white"}>
                                      {formatStoredMessage(message.message_type, message.body)}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <form onSubmit={sendReply} className="border-t border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-3">
                        <input
                          value={replyBody}
                          onChange={(e) => setReplyBody(e.target.value)}
                          onKeyDown={handleReplyKeyDown}
                          placeholder={adminCopy.typeReply}
                          className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                        />
                        <button
                          type="submit"
                          disabled={sendingReply || !replyBody.trim()}
                          className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white disabled:opacity-60"
                        >
                          {sendingReply ? common.sending : common.send}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </Card>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
