import Link from "next/link";

export const metadata = {
  title: "KlipflowAI Blog — AI Video, Ad Strategy & Content Tips",
  description: "Expert guides on AI video generation, Facebook ad strategy, faceless channel growth, and content monetization. Updated weekly by the KlipflowAI team."
};

const posts = [
  { slug: "how-to-spy-facebook-ads", title: "How to Spy on Winning Facebook Ads (Legally)", date: "May 2026", category: "Ad Strategy", read: "5 min read", excerpt: "Find profitable ads before your competitors with Meta's official Ads Library API." },
  { slug: "faceless-channel-guide", title: "The Complete Guide to Running a Faceless Channel in 2026", date: "May 2026", category: "Content Creation", read: "8 min read", excerpt: "Everything you need to know about building a profitable faceless content channel with AI." },
  { slug: "ugc-ads-guide", title: "Why UGC Ads Outperform Every Other Ad Format", date: "May 2026", category: "Advertising", read: "6 min read", excerpt: "The psychology behind UGC ads and how to generate them at scale with AI." },
  { slug: "tiktok-automation-guide", title: "How to Automate Your TikTok to 100K Followers", date: "May 2026", category: "TikTok", read: "7 min read", excerpt: "The exact system to automate your TikTok content and hit monetization thresholds." },
  { slug: "ai-video-prompts", title: "50 Proven AI Video Prompts That Generate Viral Content", date: "May 2026", category: "AI Video", read: "10 min read", excerpt: "Copy-paste prompts for scary stories, motivation, finance, luxury, and more niches." },
  { slug: "dropshipping-video-ads", title: "How to Find Winning Dropshipping Products with Ad Spy", date: "May 2026", category: "E-Commerce", read: "6 min read", excerpt: "Use ad intelligence to identify winning products before scaling your store." }
];

export default function Blog() {
  return (
    <main className="min-h-screen bg-black text-white">
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10 sticky top-0 z-50 bg-black/90 backdrop-blur-md">
        <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
          KlipflowAI
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-white text-sm font-semibold py-2 px-5 rounded-full border border-white/20 transition">
            ← Back to Home
          </Link>
          <Link href="/" className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold py-2 px-5 rounded-full transition">
            Sign Up Free
          </Link>
        </div>
      </nav>

      <section className="px-8 py-20 text-center">
        <h1 className="text-5xl font-extrabold mb-4">KlipflowAI Blog</h1>
        <p className="text-gray-400 text-xl max-w-2xl mx-auto">AI video strategy, ad intelligence, and content monetization guides — updated weekly.</p>
      </section>

      <section className="px-8 pb-24 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8">
          {posts.map((post, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-purple-500/50 transition cursor-pointer">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-purple-900/40 text-purple-300 text-xs font-bold px-3 py-1 rounded-full">{post.category}</span>
                <span className="text-gray-600 text-xs">{post.read}</span>
              </div>
              <h2 className="text-lg font-bold mb-3 leading-snug">{post.title}</h2>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">{post.excerpt}</p>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 text-xs">{post.date}</span>
                <span className="text-purple-400 text-sm font-semibold">Read more →</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 px-8 py-10 text-center text-gray-600 text-sm">
        <Link href="/" className="text-white font-bold">KlipflowAI</Link> © 2026 · All rights reserved ·{" "}
        <Link href="/privacy-policy" className="hover:text-white transition">Privacy Policy</Link> ·{" "}
        <Link href="/terms-of-service" className="hover:text-white transition">Terms of Service</Link>
      </footer>
    </main>
  );
}