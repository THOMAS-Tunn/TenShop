import { useEffect, useMemo, useState } from "react";
import { Route, Routes, Navigate, useLocation, useParams } from "react-router-dom";
import { getCurrentUser, type SessionUser } from "./lib/auth";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Auth } from "./pages/Auth";
import { Shop } from "./pages/Shop";
import { Community } from "./pages/Community";
import { Chat } from "./pages/Chat";
import { Cart } from "./pages/Cart";
import { Profile } from "./pages/Profile";
import { OrderDetail } from "./pages/OrderDetail";
import { Admin } from "./pages/Admin";
import { RequireAdmin } from "./components/RequireAdmin";

function RequireAuth({
  user,
  children,
}: {
  user: SessionUser | null;
  children: (u: SessionUser) => JSX.Element;
}) {
  const loc = useLocation();
  if (!user) return <Navigate to="/auth" state={{ from: loc.pathname }} replace />;
  return children(user);
}

function LegacyCartRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? `/cart?selected=${encodeURIComponent(id)}` : "/cart"} replace />;
}

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "TenShop";

    const iconUrl = "https://ik.imagekit.io/0b1iirbdi/logo-modified.png?updatedAt=1773072541949";

    let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;

    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }

    link.type = "image/png";
    link.href = iconUrl;
  }, []);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      try {
        const u = await getCurrentUser();
        if (mounted) {
          setUser(u);
          setLoading(false);
        }
      } catch {
        if (mounted) setLoading(false);
      }

      const { supabase } = await import("./lib/supabase");
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!mounted) return;

        if (!session?.user) {
          setUser(null);
          return;
        }

        setUser({
          id: session.user.id,
          email: session.user.email ?? null,
        });
      });

      unsubscribe = () => data.subscription.unsubscribe();
    };

    void init();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const shell = useMemo(() => <Layout user={user} loading={loading} />, [user, loading]);

  return (
    <>
      {shell}
      <Routes>
        <Route
          path="/admin"
          element={
            <RequireAdmin user={user}>
              <Admin />
            </RequireAdmin>
          }
        />
        <Route path="/" element={<Home user={user} />} />
        <Route path="/auth" element={<Auth />} />
        <Route
          path="/shop"
          element={
            <RequireAuth user={user}>
              {(u) => <Shop user={u} />}
            </RequireAuth>
          }
        />
        <Route
          path="/community"
          element={
            <RequireAuth user={user}>
              {(u) => <Community user={u} />}
            </RequireAuth>
          }
        />
        <Route
          path="/chat"
          element={
            <RequireAuth user={user}>
              {(u) => <Chat user={u} />}
            </RequireAuth>
          }
        />
        <Route
          path="/cart"
          element={
            <RequireAuth user={user}>
              {(u) => <Cart user={u} />}
            </RequireAuth>
          }
        />
        <Route path="/carts/:id" element={<LegacyCartRedirect />} />
        <Route path="/lists/:id" element={<LegacyCartRedirect />} />
        <Route
          path="/orders/:id"
          element={
            <RequireAuth user={user}>
              {(u) => <OrderDetail user={u} />}
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth user={user}>
              {(u) => <Profile user={u} />}
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
