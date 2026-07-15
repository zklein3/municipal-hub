import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ClientErrorListener from "@/components/ClientErrorListener";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FireOps7",
  description: "Fire department operations management",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FireOps7",
  },
  metadataBase: new URL("https://municipal-hub.com"),
  openGraph: {
    title: "FireOps7 — Fire Department Operations, Simplified",
    description: "Incident reporting, NERIS-compatible data exchange, training, equipment, and ISO compliance — all in one platform built for fire departments.",
    url: "https://municipal-hub.com",
    siteName: "FireOps7",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FireOps7 — Fire Department Operations, Simplified",
    description: "Incident reporting, NERIS-compatible data exchange, training, equipment, and ISO compliance — all in one platform built for fire departments.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <meta name="theme-color" content="#991b1b" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="icon" href="/icon-192.png" sizes="192x192" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body className="min-h-full flex flex-col">
        <ClientErrorListener />
        {children}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js').catch(() => {});
            });
          }
        `}} />
      </body>
    </html>
  );
}
