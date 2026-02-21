import { Admin } from "./pages/Admin";
import { RequireAdmin } from "./components/RequireAdmin";
import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getCurrentUser, type SessionUser } from "./lib/auth";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Auth } from "./pages/Auth";
import { Shop } from "./pages/Shop";
import { Community } from "./pages/Community";
import { ListDetail } from "./pages/ListDetail";
import { Profile } from "./pages/Profile";

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

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

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
          path="/lists/:id"
          element={
            <RequireAuth user={user}>
              {(u) => <ListDetail user={u} />}
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
