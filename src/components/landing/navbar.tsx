"use client";

import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";

export function LandingNavbar() {
  return (
    <header className="fixed top-0 inset-x-0 z-40 flex justify-center px-4 pt-4">
      <div className="glass w-full max-w-5xl rounded-full px-5 py-2.5 flex items-center justify-between">
        <Logo markClassName="h-7 w-7" />
        <nav className="hidden md:flex items-center gap-6 text-sm text-muted">
          <a href="#how-it-works" className="hover:text-foreground transition-colors">
            How it works
          </a>
          <a href="#sheets" className="hover:text-foreground transition-colors">
            Google Sheets
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
