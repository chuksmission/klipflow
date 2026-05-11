import type { Metadata } from "next";
import CookieBanner from "./components/CookieBanner";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "KlipflowAI — Spy. Generate. Dominate.",
  description: "The only AI platform that combines Facebook Ad Spy, AI video generation, script writing, voice synthesis, avatar creation, and automated posting to 5 platforms in one closed loop.",
  keywords: "ai video generator, facebook ad spy, ugc video creator, faceless channel automation, ai ad generator, social media autopilot, text to video ai, ai actor generator",
  openGraph: {
    title: "KlipflowAI — Spy. Generate. Dominate.",
    description: "Spy on winning Facebook ads, generate cinematic AI videos, and auto-post to 5 platforms on autopilot.",
    url: "https://klipflowai.com",
    siteName: "KlipflowAI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "KlipflowAI — Spy. Generate. Dominate.",
    description: "The only AI platform that combines ad spy, video generation, and automated posting in one closed loop.",
  },
  robots: {
    index: true,
    follow: true,
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
     <body className="min-h-full flex flex-col">
  {children}
  <CookieBanner />
</body>
    </html>
  );
}
