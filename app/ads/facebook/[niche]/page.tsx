import PSEOPage from "../../../components/PSEOPage";

interface Props {
  params: Promise<{ niche: string }>;
}

function formatNiche(niche: string) {
  return niche.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export async function generateMetadata({ params }: Props) {
  const { niche } = await params;
  const formatted = formatNiche(niche);
  return {
    title: `Facebook Ad Spy — ${formatted} Ads | KlipflowAI`,
    description: `Spy on winning Facebook ads in the ${formatted} niche. Find ads running 7+ days, see what's scaling, and generate better versions instantly with AI.`
  };
}

export function generateStaticParams() {
  return [
    { niche: 'ecommerce' },
    { niche: 'dropshipping' },
    { niche: 'fashion' },
    { niche: 'beauty' },
    { niche: 'health' },
    { niche: 'fitness' },
    { niche: 'tech' },
    { niche: 'finance' },
    { niche: 'real-estate' },
    { niche: 'food' },
    { niche: 'travel' },
    { niche: 'pets' },
    { niche: 'gaming' },
    { niche: 'education' },
    { niche: 'software' }
  ];
}

export default async function FacebookNicheAdSpy({ params }: Props) {
  const { niche } = await params;
  const formatted = formatNiche(niche);

  return (
    <PSEOPage
      badge={`🕵️ Facebook Ad Spy — ${formatted}`}
      title={`Spy on Winning Facebook ${formatted} Ads`}
      subtitle={`Find the most profitable ${formatted} ads running on Facebook right now.`}
      description={`KlipflowAI's Facebook Ad Spy tool gives you real-time access to every winning ${formatted} ad on Facebook. Filter by ads running 7+ days — the proven signal of a profitable campaign. Study the hooks, copy, and creatives that are working in the ${formatted} market, then generate better versions with our AI in minutes.`}
      keywords={[
        `facebook ad spy ${niche}`,
        `${niche} facebook ads`,
        `spy ${niche} ads`,
        `winning ${niche} ads facebook`,
        `${niche} ad intelligence`,
        `best ${niche} facebook ads`,
        `${niche} ad examples`,
        `${niche} advertising spy`
      ]}
      howItWorks={[
        {
          step: "1",
          icon: "🔍",
          title: `Search ${formatted} Ads`,
          desc: `Our spy tool instantly searches all active ${formatted} Facebook ads. Thousands of results in seconds.`
        },
        {
          step: "2",
          icon: "📊",
          title: "Filter Winners",
          desc: `Filter by ads running 7+ days in the ${formatted} space. Only see proven profitable campaigns.`
        },
        {
          step: "3",
          icon: "🔄",
          title: "Generate Better Ads",
          desc: `One click to remix any winning ${formatted} ad. AI generates a unique version for your brand instantly.`
        }
      ]}
      features={[
        {
          icon: "✅",
          title: "100% Legal",
          desc: `All ${formatted} ad data sourced from Meta's official Ads Library API. Fully compliant.`
        },
        {
          icon: "📅",
          title: "7-Day Filter",
          desc: `Identify the strongest ${formatted} ads by filtering for campaigns running 7+ days.`
        },
        {
          icon: "💾",
          title: "Save Ad Library",
          desc: `Save the best ${formatted} ads to your swipe file for reference and inspiration.`
        },
        {
          icon: "🔄",
          title: "One-Click Remix",
          desc: `Instantly generate a unique ${formatted} ad inspired by any winning creative.`
        },
        {
          icon: "🌍",
          title: "Global Coverage",
          desc: `See ${formatted} ads running in any country. Global ad intelligence at your fingertips.`
        },
        {
          icon: "🚀",
          title: "Instant Launch",
          desc: `Generate your ${formatted} ad and launch it as a Facebook campaign in one click.`
        }
      ]}
      faqs={[
        {
          q: `How do I find winning ${formatted} Facebook ads?`,
          a: `Use KlipflowAI's Ad Spy tool to search ${formatted} keywords and filter for ads running 7+ days. Longevity is the strongest indicator of a profitable ${formatted} campaign.`
        },
        {
          q: `Is it legal to spy on ${formatted} Facebook ads?`,
          a: `Yes. KlipflowAI uses Meta's official Ads Library API which is publicly available. Spying on ${formatted} ads through this method is 100% legal and compliant.`
        },
        {
          q: `What can I learn from ${formatted} Facebook ads?`,
          a: `Winning ${formatted} ads reveal what hooks work, which formats convert, what messaging resonates, and how top advertisers in the ${formatted} space structure their campaigns.`
        },
        {
          q: `How many ${formatted} ads can I view?`,
          a: `Unlimited. Browse as many ${formatted} Facebook ads as you need. Save your favorites to your personal library for reference.`
        },
        {
          q: `Can I generate ${formatted} ads after spying?`,
          a: `Yes. One click to remix any winning ${formatted} ad. KlipflowAI generates a completely unique version inspired by the winning formula — for your brand.`
        }
      ]}
      ctaTitle={`Start Spying on ${formatted} Ads Free`}
      ctaDesc={`Find your first winning ${formatted} ad today. 25 free tokens on signup.`}
    />
  );
}