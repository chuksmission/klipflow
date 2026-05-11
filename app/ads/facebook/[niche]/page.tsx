import PSEOPage from "../../../components/PSEOPage";

interface Props {
  params: { niche: string };
}

function formatNiche(niche: string) {
  return niche.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export async function generateMetadata({ params }: Props) {
  const niche = formatNiche(params.niche);
  return {
    title: `Facebook Ad Spy — ${niche} Ads | KlipflowAI`,
    description: `Spy on winning Facebook ads in the ${niche} niche. Find ads running 7+ days, see what's scaling, and generate better versions instantly with AI.`
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

export default function FacebookNicheAdSpy({ params }: Props) {
  const niche = formatNiche(params.niche);

  return (
    <PSEOPage
      badge={`🕵️ Facebook Ad Spy — ${niche}`}
      title={`Spy on Winning Facebook ${niche} Ads`}
      subtitle={`Find the most profitable ${niche} ads running on Facebook right now.`}
      description={`KlipflowAI's Facebook Ad Spy tool gives you real-time access to every winning ${niche} ad on Facebook. Filter by ads running 7+ days — the proven signal of a profitable campaign. Study the hooks, copy, and creatives that are working in the ${niche} market, then generate better versions with our AI in minutes.`}
      keywords={[
        `facebook ad spy ${params.niche}`,
        `${params.niche} facebook ads`,
        `spy ${params.niche} ads`,
        `winning ${params.niche} ads facebook`,
        `${params.niche} ad intelligence`,
        `best ${params.niche} facebook ads`,
        `${params.niche} ad examples`,
        `${params.niche} advertising spy`
      ]}
      howItWorks={[
        {
          step: "1",
          icon: "🔍",
          title: `Search ${niche} Ads`,
          desc: `Our spy tool instantly searches all active ${niche} Facebook ads. Thousands of results in seconds.`
        },
        {
          step: "2",
          icon: "📊",
          title: "Filter Winners",
          desc: `Filter by ads running 7+ days in the ${niche} space. Only see proven profitable campaigns.`
        },
        {
          step: "3",
          icon: "🔄",
          title: "Generate Better Ads",
          desc: `One click to remix any winning ${niche} ad. AI generates a unique version for your brand instantly.`
        }
      ]}
      features={[
        {
          icon: "✅",
          title: "100% Legal",
          desc: `All ${niche} ad data sourced from Meta's official Ads Library API. Fully compliant.`
        },
        {
          icon: "📅",
          title: "7-Day Filter",
          desc: `Identify the strongest ${niche} ads by filtering for campaigns running 7+ days.`
        },
        {
          icon: "💾",
          title: "Save Ad Library",
          desc: `Save the best ${niche} ads to your swipe file for reference and inspiration.`
        },
        {
          icon: "🔄",
          title: "One-Click Remix",
          desc: `Instantly generate a unique ${niche} ad inspired by any winning creative.`
        },
        {
          icon: "🌍",
          title: "Global Coverage",
          desc: `See ${niche} ads running in any country. Global ad intelligence at your fingertips.`
        },
        {
          icon: "🚀",
          title: "Instant Launch",
          desc: `Generate your ${niche} ad and launch it as a Facebook campaign in one click.`
        }
      ]}
      faqs={[
        {
          q: `How do I find winning ${niche} Facebook ads?`,
          a: `Use KlipflowAI's Ad Spy tool to search ${niche} keywords and filter for ads running 7+ days. Longevity is the strongest indicator of a profitable ${niche} campaign.`
        },
        {
          q: `Is it legal to spy on ${niche} Facebook ads?`,
          a: `Yes. KlipflowAI uses Meta's official Ads Library API which is publicly available. Spying on ${niche} ads through this method is 100% legal and compliant.`
        },
        {
          q: `What can I learn from ${niche} Facebook ads?`,
          a: `Winning ${niche} ads reveal what hooks work, which formats convert, what messaging resonates, and how top advertisers in the ${niche} space structure their campaigns.`
        },
        {
          q: `How many ${niche} ads can I view?`,
          a: `Unlimited. Browse as many ${niche} Facebook ads as you need. Save your favorites to your personal library for reference.`
        },
        {
          q: `Can I generate ${niche} ads after spying?`,
          a: `Yes. One click to remix any winning ${niche} ad. KlipflowAI generates a completely unique version inspired by the winning formula — for your brand.`
        }
      ]}
      ctaTitle={`Start Spying on ${niche} Ads Free`}
      ctaDesc={`Find your first winning ${niche} ad today. 25 free tokens on signup.`}
    />
  );
}