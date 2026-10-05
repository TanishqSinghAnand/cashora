"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldCheck, Lock, Zap, Mail } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { useUser } from "@/components/providers/user-provider";

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

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") codeInputRef.current?.focus();
  }, [step]);

  const requestCode = async () => {
    if (!email.trim()) return;
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/api/auth/otp/request", { method: "POST", body: JSON.stringify({ email: email.trim() }) });
      toast.success("Code sent — check your email");
      setStep("code");
      setCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (code.trim().length !== 6) return;
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/api/auth/otp/verify", { method: "POST", body: JSON.stringify({ email: email.trim(), code: code.trim() }) });
      await refresh();
      toast.success("Welcome to Cashora");
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
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
          <p className="text-sm text-muted mb-8">
            {step === "email" ? "Sign in with a one-time code sent to your email" : `Enter the code sent to ${email}`}
          </p>

          {step === "email" ? (
            <div className="flex flex-col gap-3 text-left">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && requestCode()}
                autoFocus
              />
              <FieldError>{error ?? undefined}</FieldError>
              <Button onClick={requestCode} disabled={loading || !email.trim()} className="mt-2">
                <Mail size={16} /> {loading ? "Sending…" : "Send code"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 text-left">
              <Label htmlFor="code">6-digit code</Label>
              <Input
                id="code"
                ref={codeInputRef}
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && verifyCode()}
                className="text-center text-2xl tracking-[0.3em] font-semibold"
              />
              <FieldError>{error ?? undefined}</FieldError>
              <Button onClick={verifyCode} disabled={loading || code.length !== 6} className="mt-2">
                {loading ? "Verifying…" : "Verify & sign in"}
              </Button>
              <div className="flex items-center justify-between text-xs text-muted mt-1">
                <button onClick={() => setStep("email")} className="hover:text-foreground">
                  Use a different email
                </button>
                <button
                  onClick={requestCode}
                  disabled={cooldown > 0 || loading}
                  className="hover:text-foreground disabled:opacity-50"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
              </div>
            </div>
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
