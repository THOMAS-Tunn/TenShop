import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { SessionUser } from "../lib/auth";
import { useAppSettings } from "../lib/app-settings";
import { isCurrentUserAdmin } from "../lib/admin";

export function RequireAdmin({
  user,
  children,
}: {
  user: SessionUser | null;
  children: JSX.Element;
}) {
  const loc = useLocation();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const { copy } = useAppSettings();

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!user) {
        if (mounted) setAllowed(false);
        return;
      }

      const admin = await isCurrentUserAdmin();
      if (mounted) setAllowed(admin);
    })();

    return () => {
      mounted = false;
    };
  }, [user]);

  if (!user) return <Navigate to="/auth" state={{ from: loc.pathname }} replace />;
  if (allowed === null) return <div style={{ padding: 16 }}>{copy.requireAdmin.checking}</div>;
  if (!allowed) return <Navigate to="/" replace />;

  return children;
}
