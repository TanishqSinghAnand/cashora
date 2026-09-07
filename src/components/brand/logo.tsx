import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn("h-8 w-8", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="currentColor" className="text-primary" />
      <path
        d="M11 20.5c0 2.485 2.239 4.5 5 4.5s5-2.015 5-4.5-2.239-4.5-5-4.5-5-2.015-5-4.5 2.239-4.5 5-4.5 5 2.015 5 4.5"
        stroke="var(--primary-foreground)"
        strokeWidth="2.1"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className="text-lg font-semibold tracking-tight">Cashora</span>
    </div>
  );
}
