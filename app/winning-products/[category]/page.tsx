import PSEOPage from "../../components/PSEOPage";
import { Metadata } from 'next'

interface Props {
  params: Promise<{ category: string }>;
}

function formatCategory(category: string) {
  return category.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const formatted = formatCategory(category);
  return {
    title: `Winning ${formatted} Products — AI Video Ads Ready`,
    description: `Discover winning ${formatted} dropshipping products with proven demand. Generate AI video ads for each product instantly and start selling today.`,
    keywords: [`winning ${formatted.toLowerCase()} products`, 'winning dropshipping products', 'hot products to sell', `${formatted.toLowerCase()} dropshipping`, 'product research AI'],
    alternates: { canonical: `https://klipflowai.com/winning-products/${category}` },
    openGraph: {
      title: `Winning ${formatted} Products — AI Video Ads | KlipflowAI`,
      description: `Find winning ${formatted.toLowerCase()} products and generate AI video ads instantly.`,
      url: `https://klipflowai.com/winning-products/${category}`,
    },
  }
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

export default async function WinningProductsCategory({ params }: Props) {
  const { category } = await params;
  const formatted = formatCategory(category);

  return (
    <PSEOPage
      badge={`🏆 Winning ${formatted} Products`}
      title={`Find Winning ${formatted} Products with Ad Intelligence`}
      subtitle={`See exactly which ${formatted} products are selling right now — before your competitors.`}
      description={`KlipflowAI's winning product research tool uses Facebook ad intelligence to identify the best performing ${formatted} products in the market. Find products that advertisers have been profitably promoting for 7+ days — the clearest signal of a winning product. Then generate your own video ads and launch campaigns in minutes.`}
      keywords={[
        `winning ${category} products`,
        `best ${category} products to sell`,
        `${category} product research`,
        `${category} dropshipping products`,
        `trending ${category} products`,
        `${category} winning products 2026`,
        `${category} product ads`,
        `find ${category} products to sell`
      ]}
      howItWorks={[
        {
          step: "1",
          icon: "🔍",
          title: `Research ${formatted} Ads`,
          desc: `Search Facebook ads in the ${formatted} space. Find products being profitably advertised for 7+ days.`
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
          desc: `Only surface ${formatted} products with 7+ days of active advertising — proof of profitability.`
        },
        {
          icon: "🎬",
          title: "Instant Ad Creation",
          desc: `Generate video and image ads for any ${formatted} product immediately after discovery.`
        },
        {
          icon: "🚀",
          title: "One-Click Launch",
          desc: `Launch your ${formatted} product campaign to Facebook automatically with our Ad Launcher.`
        },
        {
          icon: "💾",
          title: "Product Swipe File",
          desc: `Save winning ${formatted} products and their ads to your research library for reference.`
        },
        {
          icon: "🌍",
          title: "Global Markets",
          desc: `Find winning ${formatted} products in any country. Spot international trends before they hit your market.`
        },
        {
          icon: "⚡",
          title: "First Mover Advantage",
          desc: `Find winning ${formatted} products before they get saturated. Speed is everything in product research.`
        }
      ]}
      faqs={[
        {
          q: `How do I find winning ${formatted} products?`,
          a: `Search Facebook ads for ${formatted} products and filter for ads running 7+ days. Consistent ad spend over a week is the strongest indicator that a product is genuinely profitable.`
        },
        {
          q: `Why use ad spy for ${formatted} product research?`,
          a: `Ad intelligence reveals what's already proven to sell — not just what looks good. If a ${formatted} advertiser is spending money for 7+ days, the product is converting. That's better research than any other method.`
        },
        {
          q: `Can I find dropshipping products in the ${formatted} space?`,
          a: `Yes. KlipflowAI is widely used by dropshippers to find winning ${formatted} products. Identify the product through ad spy, source it from your supplier, and launch your own campaign with our AI-generated ads.`
        },
        {
          q: `How quickly can I launch after finding a winning ${formatted} product?`,
          a: `Under 10 minutes. Find the product → generate your ad → launch via One-Click Ad Launcher. Speed is your competitive advantage.`
        },
        {
          q: `How many ${formatted} products can I research?`,
          a: `Unlimited product research. Browse as many ${formatted} ads as you need, save your favorites, and generate ads for as many products as your token balance allows.`
        }
      ]}
      ctaTitle={`Find Your Winning ${formatted} Product Today`}
      ctaDesc={`25 free tokens on signup. From research to live ad in minutes.`}
    />
  );
}