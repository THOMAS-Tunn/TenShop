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

function RequireAuth({ user, children }: { user: SessionUser | null; children: JSX.Element }) {
  const loc = useLocation();
  if (!user) return <Navigate to="/auth" state={{ from: loc.pathname }} replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getCurrentUser().then((u) => {
      if (mounted) {
        setUser(u);
        setLoading(false);
      }
    });

    const { data: sub } = (await import("./lib/supabase")).supabase.auth.onAuthStateChange(
      async () => {
        const u = await getCurrentUser();
        setUser(u);
      }
    );

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const shell = useMemo(() => <Layout user={user} loading={loading} />, [user, loading]);

  return (
    <>
      {shell}
      <Routes>
        <Route path="/" element={<Home user={user} />} />
        <Route path="/auth" element={<Auth />} />
        <Route
          path="/shop"
          element={
            <RequireAuth user={user}>
              <Shop user={user} />
            </RequireAuth>
          }
        />
        <Route
          path="/community"
          element={
            <RequireAuth user={user}>
              <Community user={user} />
            </RequireAuth>
          }
        />
        <Route
          path="/lists/:id"
          element={
            <RequireAuth user={user}>
              <ListDetail user={user} />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth user={user}>
              <Profile user={user} />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
