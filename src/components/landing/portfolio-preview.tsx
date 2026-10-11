"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

const SPARK_POINTS = "0,34 14,30 28,33 42,20 56,24 70,10 84,16 98,4 112,9 126,2";

export function PortfolioPreview() {
  const balanceRef = useRef<HTMLParagraphElement>(null);
  const sparkRef = useRef<SVGPolylineElement>(null);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduced = mql.matches;

    if (balanceRef.current) {
      const counter = { value: 0 };
      if (reduced) {
        balanceRef.current.textContent = "₹63,000.00";
      } else {
        gsap.to(counter, {
          value: 63000,
          duration: 1.6,
          delay: 0.5,
          ease: "power3.out",
          onUpdate: () => {
            if (balanceRef.current) {
              balanceRef.current.textContent = counter.value.toLocaleString("en-IN", {
                style: "currency",
                currency: "INR",
                minimumFractionDigits: 2,
              });
            }
          },
        });
      }
    }

    if (sparkRef.current) {
      const length = sparkRef.current.getTotalLength();
      if (reduced) {
        sparkRef.current.style.strokeDashoffset = "0";
      } else {
        gsap.set(sparkRef.current, { strokeDasharray: length, strokeDashoffset: length });
        gsap.to(sparkRef.current, { strokeDashoffset: 0, duration: 1.4, delay: 0.3, ease: "power2.out" });
      }
    }
  }, []);

  return (
    <div className="glow-border rounded-3xl p-6 text-left w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="live-dot" aria-hidden />
          <p className="text-sm text-muted">Sharma General Store</p>
        </div>
        <p className="text-xs text-muted">Synced just now</p>
      </div>

      <p ref={balanceRef} className="text-4xl font-semibold tracking-tight mb-1 font-mono">
        ₹0.00
      </p>
      <p className="text-xs text-cash-in mb-4">+8.4% this week</p>

      <svg viewBox="0 0 126 36" className="w-full h-10 mb-5" preserveAspectRatio="none" aria-hidden>
        <polyline
          ref={sparkRef}
          points={SPARK_POINTS}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="flex flex-col divide-y divide-border -mx-2">
        {[
          { icon: ArrowDownLeft, label: "Customer Payment", amount: "+₹5,000", color: "text-cash-in" },
          { icon: ArrowUpRight, label: "Stock Purchase", amount: "-₹2,000", color: "text-cash-out" },
        ].map((row) => (
          <div key={row.label} className="flex items-center gap-3 px-2 py-2.5">
            <div className={`h-8 w-8 rounded-full bg-surface-2 flex items-center justify-center ${row.color}`}>
              <row.icon size={14} />
            </div>
            <p className="text-sm flex-1">{row.label}</p>
            <p className={`text-sm font-medium font-mono ${row.color}`}>{row.amount}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
        <div className="flex -space-x-2">
          {["T", "R"].map((initial) => (
            <div
              key={initial}
              className="h-6 w-6 rounded-full bg-surface-2 border-2 border-surface flex items-center justify-center text-[10px] font-semibold text-primary"
            >
              {initial}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted">2 collaborators watching live</p>
      </div>
    </div>
  );
}
