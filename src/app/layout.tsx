import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { UserProvider } from "@/components/providers/user-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Cashora — Track. Share. Stay in sync.",
    template: "%s · Cashora",
  },
  description:
    "Cashora is a collaborative digital cashbook. Track cash in and out, share books with partners, and keep records synchronized with Google Sheets.",
  openGraph: {
    title: "Cashora — Track. Share. Stay in sync.",
    description:
      "A beautiful collaborative cashbook where you can track cash flow, share books with partners, and stay in sync with Google Sheets.",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#08090a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground" suppressHydrationWarning>
        <UserProvider>
          {children}
          <Toaster position="top-center" richColors closeButton />
        </UserProvider>
      </body>
    </html>
  );
}
