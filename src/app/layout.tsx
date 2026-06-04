import type { Metadata, Viewport } from "next";
import { Nunito, Fraunces } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import { SideNav } from "@/components/SideNav";
import { ColorOfDay } from "@/components/ColorOfDay";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const SITE_URL = "https://gaedhd.jmj.fyi";
const TITLE = "GaeDHD";
const DESCRIPTION = "Your ADHD brain's best friend. Big goals, tiny steps, perfect timing.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · GaeDHD",
  },
  description: DESCRIPTION,
  manifest: "/manifest.json",
  applicationName: TITLE,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: TITLE,
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FBF7F0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <ColorOfDay />
        <div className="flex min-h-screen">
          <SideNav />
          <main className="flex-1 pb-20 md:pb-0 min-w-0">
            {children}
          </main>
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
