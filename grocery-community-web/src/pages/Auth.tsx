import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card } from "../components/Card";
import { Field } from "../components/Field";
import { useAppSettings } from "../lib/app-settings";
import { supabase } from "../lib/supabase";

export function Auth() {
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as any)?.from ?? "/shop";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const { copy } = useAppSettings();
  const auth = copy.auth;
  const common = copy.common;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav(from, { replace: true });
    });
  }, [from, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg(auth.checkEmailMessage);
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav(from, { replace: true });
      }
    } catch (err: any) {
      setMsg(err.message ?? auth.somethingWentWrong);
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "signin" ? auth.signIn : auth.createAccount;
  const toggleLabel = mode === "signin" ? auth.signUp : auth.signIn;
  const submitLabel = busy ? common.working : title;

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{title}</h1>
          <button
            className="rounded-2xl border px-3 py-2 text-sm hover:bg-slate-50"
            onClick={() => setMode((current) => (current === "signin" ? "signup" : "signin"))}
            type="button"
          >
            {toggleLabel}
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={submit}>
          <Field
            label={common.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
          <Field
            label={common.password}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
          <button
            disabled={busy}
            className="w-full rounded-2xl bg-slate-900 px-4 py-2 text-white hover:opacity-90 disabled:opacity-60"
          >
            {submitLabel}
          </button>
        </form>

        {msg ? <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{msg}</div> : null}

        <div className="mt-6 text-xs text-slate-500">{auth.authSettingsNote}</div>
      </Card>
    </main>
  );
}
