import { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL('https://klipflowai.com'),
  title: 'KlipflowAI — AI Video Generator | Spy, Generate & Dominate',
  description: 'The only AI platform that combines Facebook Ad Spy, AI video generation, UGC videos, AI actors, voice synthesis, and auto-posting to 5 platforms. Start free with 25 tokens.',
  keywords: [
    'AI video generator',
    'Facebook ad spy tool',
    'UGC video generator',
    'faceless channel automation',
    'AI ad generator',
    'social media autopilot',
    'text to video AI',
    'AI actor generator',
    'Kling AI',
    'Veo 3',
    'Sora video generator',
  ],
  alternates: { canonical: 'https://klipflowai.com' },
  openGraph: {
    title: 'KlipflowAI — Spy. Generate. Dominate.',
    description: 'Facebook Ad Spy + AI Video Generation + Auto-Post to 5 Platforms. The only closed-loop AI content platform.',
    url: 'https://klipflowai.com',
    siteName: 'KlipflowAI',
    type: 'website',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'KlipflowAI' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@klipflowai',
    creator: '@klipflowai',
    title: 'KlipflowAI — Spy. Generate. Dominate.',
    description: 'Facebook Ad Spy + AI Video Generation + Auto-Post to 5 Platforms.',
    images: ['/og-image.jpg'],
  },
}