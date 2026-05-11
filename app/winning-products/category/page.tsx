import PSEOPage from "../../components/PSEOPage";

interface Props {
  params: { category: string };
}

function formatCategory(category: string) {
  return category.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export async function generateMetadata({ params }: Props) {
  const category = formatCategory(params.category);
  return {
    title: `Winning ${category} Products — Ad Spy & Research | KlipflowAI`,
    description: `Find winning ${category} products through Facebook ad intelligence. See what's selling, generate product video ads, and launch campaigns in minutes.`
  };
}

export function generateStaticParams() {
  return [
    { category: 'fashion' },
    { category: 'beauty' },
    { category: 'health-wellness' },
    { category: 'home-garden' },
    { category: 'tech-gadgets' },
    { category: 'fitness' },
    { category: 'pets' },
    { category: 'baby-kids' },
    { category: 'sports-outdoors' },
    { category: 'food-beverage' },
    { category: 'jewelry' },
    { category: 'automotive' }
  ];
}

export default function WinningProductsCategory({ params }: Props) {
  const category = formatCategory(params.category);

  return (
    <PSEOPage
      badge={`🏆 Winning ${category} Products`}
      title={`Find Winning ${category} Products with Ad Intelligence`}
      subtitle={`See exactly which ${category} products are selling right now — before your competitors.`}
      description={`KlipflowAI's winning product research tool uses Facebook ad intelligence to identify the best performing ${category} products in the market. Find products that advertisers have been profitably promoting for 7+ days — the clearest signal of a winning product. Then generate your own video ads and launch campaigns in minutes.`}
      keywords={[
        `winning ${params.category} products`,
        `best ${params.category} products to sell`,
        `${params.category} product research`,
        `${params.category} dropshipping products`,
        `trending ${params.category} products`,
        `${params.category} winning products 2026`,
        `${params.category} product ads`,
        `find ${params.category} products to sell`
      ]}
      howItWorks={[
        {
          step: "1",
          icon: "🔍",
          title: `Research ${category} Ads`,
          desc: `Search Facebook ads in the ${category} space. Find products being profitably advertised for 7+ days.`
        },
        {
          step: "2",
          icon: "📊",
          title: "Validate the Product",
          desc: `Ad longevity is the strongest proof of a winning product. If they're spending, it's selling.`
        },
        {
          step: "3",
          icon: "🎬",
          title: "Generate Your Ad",
          desc: `Create a unique video or image ad for the product and launch your own campaign instantly.`
        }
      ]}
      features={[
        {
          icon: "🏆",
          title: "Proven Winners Only",
          desc: `Only surface ${category} products with 7+ days of active advertising — proof of profitability.`
        },
        {
          icon: "🎬",
          title: "Instant Ad Creation",
          desc: `Generate video and image ads for any ${category} product immediately after discovery.`
        },
        {
          icon: "🚀",
          title: "One-Click Launch",
          desc: `Launch your ${category} product campaign to Facebook automatically with our Ad Launcher.`
        },
        {
          icon: "💾",
          title: "Product Swipe File",
          desc: `Save winning ${category} products and their ads to your research library for reference.`
        },
        {
          icon: "🌍",
          title: "Global Markets",
          desc: `Find winning ${category} products in any country. Spot international trends before they hit your market.`
        },
        {
          icon: "⚡",
          title: "First Mover Advantage",
          desc: `Find winning ${category} products before they get saturated. Speed is everything in product research.`
        }
      ]}
      faqs={[
        {
          q: `How do I find winning ${category} products?`,
          a: `Search Facebook ads for ${category} products and filter for ads running 7+ days. Consistent ad spend over a week is the strongest indicator that a product is genuinely profitable.`
        },
        {
          q: `Why use ad spy for ${category} product research?`,
          a: `Ad intelligence reveals what's already proven to sell — not just what looks good. If a ${category} advertiser is spending money for 7+ days, the product is converting. That's better research than any other method.`
        },
        {
          q: `Can I find dropshipping products in the ${category} space?`,
          a: `Yes. KlipflowAI is widely used by dropshippers to find winning ${category} products. Identify the product through ad spy, source it from your supplier, and launch your own campaign with our AI-generated ads.`
        },
        {
          q: `How quickly can I launch after finding a winning ${category} product?`,
          a: `Under 10 minutes. Find the product → generate your ad → launch via One-Click Ad Launcher. Speed is your competitive advantage.`
        },
        {
          q: `How many ${category} products can I research?`,
          a: `Unlimited product research. Browse as many ${category} ads as you need, save your favorites, and generate ads for as many products as your token balance allows.`
        }
      ]}
      ctaTitle={`Find Your Winning ${category} Product Today`}
      ctaDesc={`25 free tokens on signup. From research to live ad in minutes.`}
    />
  );
}