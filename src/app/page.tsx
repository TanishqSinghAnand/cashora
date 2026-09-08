import { Wallet, Users, RefreshCw, Sheet as SheetIcon, ShieldCheck } from "lucide-react";
import { LandingNavbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { CinematicSequence } from "@/components/landing/cinematic-sequence";
import { FeatureSection } from "@/components/landing/feature-section";
import { TrackCashVisual, CollaborateVisual, SheetsVisual, SecurityVisual } from "@/components/landing/visuals";
import { CtaSection, LandingFooter } from "@/components/landing/cta";

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      <LandingNavbar />
      <Hero />
      <CinematicSequence />

      <FeatureSection
        eyebrow="Track"
        title="Every rupee, accounted for"
        description="Log cash in and cash out in seconds. Balances are always computed from your ledger — never a number you have to trust blindly."
        icon={<Wallet size={20} />}
        points={["Cash in / cash out with categories & notes", "Search, filter, and sort your full history", "Balance = initial + cash in − cash out, always"]}
        visual={<TrackCashVisual />}
      />

      <FeatureSection
        eyebrow="Collaborate"
        title="Share a cashbook, not a spreadsheet"
        description="Invite a partner, set what they can do, and both of you see the same live numbers."
        icon={<Users size={20} />}
        points={["View-only or edit permissions per collaborator", "Owners keep full control — ownership never transfers", "Every action is server-verified, never trusted from the UI"]}
        reverse
        visual={<CollaborateVisual />}
      />

      <FeatureSection
        eyebrow="Stay in sync"
        id="sync"
        title="No refresh button required"
        description="Cashora keeps everyone's view current automatically — add a transaction and your partner sees it moments later."
        icon={<RefreshCw size={20} />}
        points={["Live balance & ledger updates", "Works the same on mobile and desktop", "Built for households, shops, and small teams"]}
        visual={<TrackCashVisual />}
      />

      <FeatureSection
        eyebrow="Google Sheets"
        id="sheets"
        title="A spreadsheet that keeps itself updated"
        description="Every cashbook, transaction, and collaborator syncs to a central Google Sheet automatically — for reporting, backups, or peace of mind."
        icon={<SheetIcon size={20} />}
        points={["Users, Cashbooks, Transactions, Collaborators & Audit Log tabs", "Credentials stay server-side, never exposed to the browser", "The app keeps working even if Sheets is temporarily down"]}
        reverse
        visual={<SheetsVisual />}
      />

      <FeatureSection
        eyebrow="Security"
        id="security"
        title="Built to keep your books private"
        description="Google or a one-time emailed code to sign in, verified sessions, and server-side authorization on every single request."
        icon={<ShieldCheck size={20} />}
        points={["Sign in with Google or an emailed OTP — no passwords, ever", "Every cashbook access is checked against the database", "Audit-logged actions across every cashbook"]}
        visual={<SecurityVisual />}
      />

      <CtaSection />
      <LandingFooter />
    </div>
  );
}
