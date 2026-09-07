"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldCheck, Lock, Zap } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { TelegramLoginWidget } from "@/components/auth/telegram-login-widget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { useUser } from "@/components/providers/user-provider";

interface Config {
  telegram: boolean;
  telegramBotUsername: string | null;
  demoAuth: boolean;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const { refresh } = useUser();

  const [config, setConfig] = useState<Config | null>(null);
  const [demoName, setDemoName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<Config>("/api/config").then(setConfig).catch(() => setConfig({ telegram: false, telegramBotUsername: null, demoAuth: true }));
  }, []);

  const handleTelegramAuth = useCallback(
    async (user: { id: number; first_name: string; last_name?: string; username?: string; photo_url?: string; auth_date: number; hash: string }) => {
      setLoading(true);
      try {
        await apiFetch("/api/auth/telegram", {
          method: "POST",
          body: JSON.stringify({ ...user, id: String(user.id), auth_date: String(user.auth_date) }),
        });
        await refresh();
        toast.success("Welcome to Cashora");
        router.push(next);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Authentication failed");
      } finally {
        setLoading(false);
      }
    },
    [next, refresh, router]
  );

  const handleDemoLogin = async () => {
    if (!demoName.trim()) return;
    setLoading(true);
    try {
      await apiFetch("/api/auth/demo", { method: "POST", body: JSON.stringify({ name: demoName.trim() }) });
      await refresh();
      toast.success(`Welcome, ${demoName.trim()}`);
      router.push(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        <div className="glass rounded-3xl p-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">Welcome back</h1>
          <p className="text-sm text-muted mb-8">Continue securely with Telegram</p>

          {config?.telegram && config.telegramBotUsername ? (
            <div className="flex flex-col items-center gap-4">
              <TelegramLoginWidget botUsername={config.telegramBotUsername} onAuth={handleTelegramAuth} />
              <p className="text-xs text-muted flex items-center gap-1.5">
                <Lock size={12} /> We never see your Telegram password
              </p>
            </div>
          ) : config?.demoAuth ? (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted bg-surface-2 rounded-lg p-3 text-left">
                Telegram login isn&apos;t configured yet in this environment. Using the development sign-in instead — this
                shortcut is automatically disabled in production.
              </p>
              <Input
                placeholder="Your name"
                value={demoName}
                onChange={(e) => setDemoName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleDemoLogin()}
              />
              <Button onClick={handleDemoLogin} disabled={loading || !demoName.trim()}>
                {loading ? "Signing in…" : "Continue"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted">Sign-in is temporarily unavailable. Please try again shortly.</p>
          )}
        </div>

        <div className="mt-8 grid grid-cols-3 gap-3 text-center">
          {[
            { icon: ShieldCheck, label: "Verified identity" },
            { icon: Lock, label: "Encrypted sessions" },
            { icon: Zap, label: "Instant sync" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 text-xs text-muted">
              <Icon size={16} className="text-primary" />
              {label}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
