"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { SignIn } from "@clerk/nextjs";
import { ShieldCheck, Lock, Zap } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-sm flex flex-col items-center"
      >
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight mb-1">Welcome back</h1>
        <p className="text-sm text-muted mb-6">Continue with Google, or a one-time code by email</p>

        <SignIn
          routing="hash"
          fallbackRedirectUrl={next}
          signUpFallbackRedirectUrl={next}
          appearance={{
            elements: {
              rootBox: "w-full",
              cardBox: "w-full shadow-none",
              card: "w-full bg-surface border border-border shadow-none rounded-3xl p-6",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              footer: "hidden",
              dividerRow: "my-4",
              formButtonPrimary: "bg-primary hover:opacity-90 text-primary-foreground",
              socialButtonsBlockButton: "border-border hover:bg-surface-2",
              formFieldInput: "bg-surface-2 border-border",
            },
          }}
        />

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
