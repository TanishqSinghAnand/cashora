"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PortfolioPreview } from "@/components/landing/portfolio-preview";

if (typeof window !== "undefined") {
  gsap.registerPlugin(SplitText);
}

export function Hero() {
  const plainRef = useRef<HTMLSpanElement>(null);
  const gradientRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const plainEl = plainRef.current;
    const gradientEl = gradientRef.current;
    if (!plainEl || !gradientEl) return;

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql.matches) return;

    // SplitText wraps each char in its own element, which breaks the
    // background-clip:text gradient on "ora" (no continuous text run left
    // to clip the gradient against) — so only the plain "Cash" run is
    // split; the gradient span animates as one unit right after it.
    const split = new SplitText(plainEl, { type: "chars" });
    const tl = gsap.timeline();
    tl.from(split.chars, {
      opacity: 0,
      y: 20,
      rotateX: -40,
      duration: 0.6,
      stagger: 0.015,
      ease: "expo.out",
    }).from(
      gradientEl,
      { opacity: 0, y: 20, duration: 0.5, ease: "expo.out" },
      "-=0.35"
    );

    return () => split.revert();
  }, []);

  return (
    <section className="relative pt-40 pb-24 px-4 overflow-hidden">
      <div className="aurora-bg" aria-hidden />
      <div className="absolute inset-0 -z-10 grid-overlay" aria-hidden />

      <div className="max-w-3xl mx-auto text-center flex flex-col items-center gap-6">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase text-primary bg-primary/10 rounded-full px-3 py-1"
        >
          <ShieldCheck size={13} /> Trusted by households &amp; small shops
        </motion.span>

        <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight">
          <span ref={plainRef}>Cash</span>
          <span ref={gradientRef} className="gradient-text inline-block">
            ora
          </span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-xl sm:text-2xl font-medium text-foreground/80"
        >
          Track. Share. Stay in sync.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55 }}
          className="text-muted max-w-lg"
        >
          A collaborative cashbook built on the same data discipline as serious finance
          tools — live balances, verified access, and a ledger you can actually trust.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-3 mt-2"
        >
          <Link href="/login" className={buttonVariants({ size: "lg" })}>
            Get Started <ArrowRight size={18} />
          </Link>
          <a href="#how-it-works" className={buttonVariants({ variant: "outline", size: "lg" })}>
            See how it works
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.75 }}
          className="mt-12 w-full max-w-md"
        >
          <PortfolioPreview />
        </motion.div>
      </div>
    </section>
  );
}
