"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ShieldCheck, Clock, Table, KeyRound } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const STATS = [
  { icon: ShieldCheck, value: 100, suffix: "%", label: "Requests server-verified" },
  { icon: Clock, value: 10, suffix: " min", label: "OTP code expiry window" },
  { icon: Table, value: 5, suffix: "", label: "Mongo collections auto-synced" },
  { icon: KeyRound, value: 0, suffix: "", label: "Passwords ever stored" },
] as const;

export function StatStrip() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const numberEls = el.querySelectorAll<HTMLElement>("[data-stat-value]");

    if (mql.matches) {
      numberEls.forEach((node) => {
        node.textContent = node.dataset.statValue ?? "";
      });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.from(el.children, {
        opacity: 0,
        y: 24,
        duration: 0.5,
        stagger: 0.08,
        ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 85%" },
      });

      numberEls.forEach((node) => {
        const target = Number(node.dataset.statValue ?? 0);
        const suffix = node.dataset.statSuffix ?? "";
        const counter = { value: 0 };
        gsap.to(counter, {
          value: target,
          duration: 1.2,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 85%" },
          onUpdate: () => {
            node.textContent = `${Math.round(counter.value)}${suffix}`;
          },
        });
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section className="py-16 px-4 border-y border-border">
      <div ref={ref} className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
        {STATS.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center text-center gap-2">
            <stat.icon size={18} className="text-primary mb-1" aria-hidden />
            <p
              data-stat-value={stat.value}
              data-stat-suffix={stat.suffix}
              className="text-3xl font-semibold tracking-tight font-mono"
            >
              0{stat.suffix}
            </p>
            <p className="text-xs text-muted">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
