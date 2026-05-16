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
