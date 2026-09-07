import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

export function CtaSection() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-3xl mx-auto glass rounded-3xl p-12 text-center flex flex-col items-center gap-5">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">Start tracking cash the modern way</h2>
        <p className="text-muted max-w-md">Free to start. No spreadsheets to fight with. Your partners see the same numbers you do.</p>
        <Link href="/login" className={buttonVariants({ size: "lg" })}>
          Get Started <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="py-10 px-4 border-t border-border">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted">
        <Logo markClassName="h-6 w-6" className="text-foreground" />
        <p>© {new Date().getFullYear()} Cashora. Built for people who share money responsibly.</p>
      </div>
    </footer>
  );
}
