import PSEOPage from "../components/PSEOPage";
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Facebook Ad Spy Tool — See Winning Ads & Copy Them',
  description: 'Spy on your competitors\' best Facebook and Instagram ads. Find winning ad creatives, copy the strategy, and generate your own version with AI — all in one platform.',
  keywords: ['Facebook ad spy tool', 'Facebook ad spy', 'ad spy tool', 'competitor ad research', 'Facebook ads library tool', 'spy on Facebook ads', 'winning Facebook ads'],
  alternates: { canonical: 'https://klipflowai.com/facebook-ad-spy-tool' },
  openGraph: {
    title: 'Facebook Ad Spy Tool — Find Winning Ads | KlipflowAI',
    description: 'Spy on competitor Facebook ads, find winning creatives, and generate your own version with AI.',
    url: 'https://klipflowai.com/facebook-ad-spy-tool',
  },
}

export default function FacebookAdSpyTool() {
  return (
    <PSEOPage
      badge="🕵️ Facebook Ad Spy Tool"
      title="Spy on Winning Facebook Ads in Your Niche"
      subtitle="Find ads running for 7+ days. See what's scaling. Create better versions instantly."
      description="KlipflowAI's Facebook Ad Spy tool uses Meta's official Ads Library API to show you exactly which ads are winning in your market. Filter by niche, format, duration, and market. Ads running for 7+ days are proven profitable — find them, study them, and generate better versions with our AI. 100% legal, 100% compliant with Meta's terms of service."
      keywords={["facebook ad spy tool", "spy on facebook ads", "facebook ad intelligence", "competitor ad spy", "facebook ad library tool", "best facebook ad spy", "find winning facebook ads", "facebook ad research tool"]}
      howItWorks={[
        { step: "1", icon: "🔍", title: "Search Your Niche", desc: "Enter keywords or select your industry. Our spy tool searches the entire Facebook Ad Library instantly." },
        { step: "2", icon: "📊", title: "Filter Winning Ads", desc: "Filter by ads running 7+ days — the proven signal of a profitable campaign. Sort by longevity." },
        { step: "3", icon: "🔄", title: "Remix & Generate", desc: "One click to remix any winning ad. AI generates a better, unique version for your brand." }
      ]}
      features={[
        { icon: "✅", title: "100% Legal", desc: "Powered by Meta's official Ads Library API. Fully compliant with Facebook's terms of service." },
        { icon: "🔍", title: "Deep Filtering", desc: "Filter by niche, ad format, duration, country, platform, and more to find exactly what you need." },
        { icon: "📅", title: "7+ Day Filter", desc: "The 7-day filter identifies ads spending real money — the most reliable signal of a winning campaign." },
        { icon: "💾", title: "Save Ad Library", desc: "Save winning ads to your personal library. Build a swipe file of proven winning creatives." },
        { icon: "🔄", title: "One-Click Remix", desc: "Remix any winning ad instantly. AI creates a unique version inspired by the winning formula." },
        { icon: "🌍", title: "Any Market", desc: "Spy on ads in any country, language, or market. Global ad intelligence at your fingertips." }
      ]}
      faqs={[
        { q: "Is it legal to spy on Facebook ads?", a: "Yes. KlipflowAI uses Meta's official Facebook Ads Library API which is publicly available and specifically designed for ad transparency. It is 100% legal and compliant." },
        { q: "How do I know which ads are winning?", a: "Ads running for 7+ days are the strongest signal of profitability. No advertiser runs losing ads for a week. Our 7-day filter surfaces only proven winners." },
        { q: "Can I see competitor ads?", a: "Yes. The Facebook Ads Library shows all active ads from any Facebook page. Search any competitor's brand name to see exactly what they're running." },
        { q: "What information can I see about each ad?", a: "You can see the ad creative (video or image), copy, headline, CTA, how long it's been running, which platforms it runs on, and the advertiser details." },
        { q: "Can I download competitor videos?", a: "You can view and save competitor ad creatives to your KlipflowAI library for reference and inspiration when generating your own unique ads." }
      ]}
      ctaTitle="Start Spying on Winning Ads Free"
      ctaDesc="25 free tokens on signup. Find your first winning ad today."
    />
  );
}