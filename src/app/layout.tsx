import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { UserProvider } from "@/components/providers/user-provider";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Cashora — Track. Share. Stay in sync.",
    template: "%s · Cashora",
  },
  description:
    "Cashora is a collaborative digital cashbook. Track cash in and out, share books with partners, and keep records mirrored to MongoDB.",
  openGraph: {
    title: "Cashora — Track. Share. Stay in sync.",
    description:
      "A beautiful collaborative cashbook where you can track cash flow, share books with partners, and stay in sync with MongoDB.",
    type: "website",
    url: appUrl,
    siteName: "Cashora",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cashora — Track. Share. Stay in sync.",
    description: "A beautiful collaborative cashbook for you and your partners.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#040609",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col bg-background text-foreground" suppressHydrationWarning>
        <UserProvider>
          {children}
          <Toaster position="top-center" richColors closeButton />
        </UserProvider>
      </body>
    </html>
  );
}
