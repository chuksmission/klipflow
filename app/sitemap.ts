import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://klipflowai.com'
  const currentDate = new Date()

  // Static marketing pages
  const staticPages = [
    { url: '/', priority: 1.0, changeFrequency: 'weekly' as const },
    { url: '/ai-video-generator', priority: 0.9, changeFrequency: 'weekly' as const },
    { url: '/text-to-video-generator', priority: 0.9, changeFrequency: 'weekly' as const },
    { url: '/image-to-video-generator', priority: 0.9, changeFrequency: 'weekly' as const },
    { url: '/ugc-video-generator', priority: 0.9, changeFrequency: 'weekly' as const },
    { url: '/ai-actor-generator', priority: 0.9, changeFrequency: 'weekly' as const },
    { url: '/ai-voice-generator', priority: 0.9, changeFrequency: 'weekly' as const },
    { url: '/ai-ad-generator', priority: 0.9, changeFrequency: 'weekly' as const },
    { url: '/ai-script-writer', priority: 0.8, changeFrequency: 'weekly' as const },
    { url: '/ai-video-prompt-generator', priority: 0.8, changeFrequency: 'weekly' as const },
    { url: '/ai-content-monetization', priority: 0.8, changeFrequency: 'weekly' as const },
    { url: '/ai-tools-for-agencies', priority: 0.8, changeFrequency: 'weekly' as const },
    { url: '/ai-video-for-dropshipping', priority: 0.8, changeFrequency: 'weekly' as const },
    { url: '/e-commerce-video-ad-generator', priority: 0.8, changeFrequency: 'weekly' as const },
    { url: '/faceless-channel-automation', priority: 0.8, changeFrequency: 'weekly' as const },
    { url: '/faceless-reels-generator', priority: 0.8, changeFrequency: 'weekly' as const },
    { url: '/social-media-autopilot', priority: 0.8, changeFrequency: 'weekly' as const },
    { url: '/tiktok-content-automation', priority: 0.8, changeFrequency: 'weekly' as const },
    { url: '/facebook-ad-spy-tool', priority: 0.8, changeFrequency: 'weekly' as const },
    { url: '/one-click-ad-launcher', priority: 0.7, changeFrequency: 'weekly' as const },
    { url: '/winning-products', priority: 0.7, changeFrequency: 'daily' as const },
    { url: '/tools/ai-ad-script-generator', priority: 0.7, changeFrequency: 'weekly' as const },
    { url: '/tools/viral-score-checker', priority: 0.7, changeFrequency: 'weekly' as const },
    { url: '/blog', priority: 0.7, changeFrequency: 'daily' as const },
    { url: '/contact', priority: 0.5, changeFrequency: 'monthly' as const },
    { url: '/privacy-policy', priority: 0.3, changeFrequency: 'monthly' as const },
    { url: '/terms-of-service', priority: 0.3, changeFrequency: 'monthly' as const },
  ]

  // pSEO dynamic pages — Facebook ads by niche
  const facebookNiches = [
    'fitness', 'beauty', 'fashion', 'tech', 'food', 'travel',
    'pets', 'home-decor', 'supplements', 'skincare', 'jewelry',
    'sports', 'gaming', 'finance', 'education', 'real-estate',
    'automotive', 'baby', 'wedding', 'outdoor'
  ]

  // pSEO dynamic pages — Winning products by category
  const productCategories = [
    'fitness-equipment', 'beauty-gadgets', 'kitchen-tools', 'pet-accessories',
    'tech-gadgets', 'home-improvement', 'fashion-accessories', 'outdoor-gear',
    'baby-products', 'gaming-accessories', 'health-wellness', 'office-supplies'
  ]

  const facebookNichePages = facebookNiches.map((niche) => ({
    url: `${baseUrl}/ads/facebook/${niche}`,
    lastModified: currentDate,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  const winningProductPages = productCategories.map((category) => ({
    url: `${baseUrl}/winning-products/${category}`,
    lastModified: currentDate,
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }))

  const staticEntries = staticPages.map((page) => ({
    url: `${baseUrl}${page.url}`,
    lastModified: currentDate,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }))

  return [...staticEntries, ...facebookNichePages, ...winningProductPages]
}