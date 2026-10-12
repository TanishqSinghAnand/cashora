"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";

export function LandingNavbar() {
  const pillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pill = pillRef.current;
    if (!pill) return;

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql.matches) return;

    const state = { shrink: 0 };
    const onScroll = () => {
      const target = Math.min(1, window.scrollY / 160);
      gsap.to(state, {
        shrink: target,
        duration: 0.3,
        ease: "power1.out",
        overwrite: true,
        onUpdate: () => {
          // Only ease padding/shadow depth on scroll — shrinking maxWidth
          // squeezed the nav links into wrapping onto two lines, so the
          // pill keeps a fixed width and just tightens vertically.
          gsap.set(pill, {
            paddingTop: 10 - state.shrink * 2,
            paddingBottom: 10 - state.shrink * 2,
          });
        },
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed top-0 inset-x-0 z-40 flex justify-center px-4 pt-4">
      <div
        ref={pillRef}
        className="glass w-full max-w-[680px] rounded-full px-5 py-2.5 flex items-center justify-between transition-shadow"
        style={{ boxShadow: "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 12px 32px -16px rgba(0,0,0,0.7)" }}
      >
        <Link href="/" aria-label="Cashora home">
          <Logo markClassName="h-7 w-7" />
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-muted whitespace-nowrap">
          <a href="#how-it-works" className="hover:text-foreground transition-colors">
            How it works
          </a>
          <a href="#mongo" className="hover:text-foreground transition-colors">
            MongoDB
          </a>
          <a href="#security" className="hover:text-foreground transition-colors">
            Security
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm", className: "hidden sm:inline-flex" })}>
            Sign in
          </Link>
          <Link href="/login" className={buttonVariants({ size: "sm" })}>
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
