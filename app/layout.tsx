import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import LocaleSync from "./components/LocaleSync";
import { isRtl, type Locale } from "../i18n/config";
import CookieBanner from "./components/CookieBanner";
import { FeedbackHost } from "./components/ui/Toaster";
import { Geist, Geist_Mono, Noto_Color_Emoji, Noto_Sans_Arabic, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

// Latin-ext and Cyrillic cover Turkish, Russian and Bulgarian; Arabic and Hindi
// use Noto fallbacks (browsers only download them when those scripts appear)
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext", "cyrillic"],
});

const notoArabic = Noto_Sans_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
});

const notoDevanagari = Noto_Sans_Devanagari({
  variable: "--font-noto-devanagari",
  subsets: ["devanagari"],
});

// Windows has no flag emoji, so the language switcher's flags use this font
// (Google serves it in unicode-range slices; only the flag slice is fetched)
const notoEmoji = Noto_Color_Emoji({
  variable: "--font-noto-emoji",
  weight: "400",
  subsets: ["emoji"],
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://klipflowai.com'),
  title: {
    default: 'KlipflowAI — AI Video Generator | Text to Video, UGC & More',
    template: '%s | KlipflowAI',
  },
  description: 'Generate stunning AI videos in seconds. Text to video, image to video, UGC videos, AI actors, voice generation and more. Powered by Kling, Sora, Veo 3 and top AI models.',
  keywords: [
    'AI video generator',
    'text to video AI',
    'image to video AI',
    'UGC video generator',
    'AI actor generator',
    'Kling AI',
    'Sora video generator',
    'Veo 3',
    'faceless video creator',
    'AI content creator',
    'facebook ad spy',
    'ai ad generator',
    'social media autopilot',
    'faceless channel automation',
    'ai voice generator',
  ],
  authors: [{ name: 'KlipflowAI' }],
  creator: 'KlipflowAI',
  publisher: 'KlipflowAI',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://klipflowai.com',
    siteName: 'KlipflowAI',
    title: 'KlipflowAI — AI Video Generator | Text to Video, UGC & More',
    description: 'Generate stunning AI videos in seconds using the world\'s best AI models. Kling, Sora, Veo 3, and more.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'KlipflowAI — AI Video Generator',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@klipflowai',
    creator: '@klipflowai',
    title: 'KlipflowAI — AI Video Generator | Text to Video, UGC & More',
    description: 'Generate stunning AI videos in seconds. Text to video, UGC, AI actors, voice synthesis and more.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await getLocale()) as Locale;
  return (
    <html
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      className={`${geistSans.variable} ${geistMono.variable} ${notoArabic.variable} ${notoDevanagari.variable} ${notoEmoji.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          {children}
          <CookieBanner />
          <FeedbackHost />
          <LocaleSync />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
