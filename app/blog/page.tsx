import Link from "next/link";
import { supabase } from "../lib/supabase";

export const metadata = {
  title: "KlipflowAI Blog — AI Video, Ad Strategy & Content Tips",
  description: "Expert guides on AI video generation, Facebook ad strategy, faceless channel growth, and content monetization. Updated weekly by the KlipflowAI team."
};

export const revalidate = 60;

async function getPosts() {
  const { data } = await supabase
    .from("blog_posts")
    .select("id, title, slug, excerpt, featured_image, status, published_at, meta_keywords")
    .eq("status", "published")
    .order("published_at", { ascending: false });
  return data || [];
}

function getReadTime(excerpt: string) {
  const words = excerpt?.split(" ").length || 50;
  return `${Math.max(3, Math.ceil(words / 200))} min read`;
}

function getCategory(keywords: string) {
  if (!keywords) return "General";
  const first = keywords.split(",")[0].trim();
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default async function Blog() {
  const posts = await getPosts();

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
          <Link href="/signup" className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold py-2 px-5 rounded-full transition">
            Sign Up Free
          </Link>
        </div>
      </nav>

      <section className="px-8 py-20 text-center">
        <h1 className="text-5xl font-extrabold mb-4">KlipflowAI Blog</h1>
        <p className="text-gray-400 text-xl max-w-2xl mx-auto">AI video strategy, ad intelligence, and content monetization guides — updated weekly.</p>
      </section>

      <section className="px-8 pb-24 max-w-6xl mx-auto">
        {posts.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">📝</div>
            <h2 className="text-2xl font-bold mb-2">No posts yet</h2>
            <p className="text-gray-400">Check back soon — new content is on the way.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            {posts.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`} className="group bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-purple-500/50 transition">
                {post.featured_image && (
                  <div className="w-full h-48 overflow-hidden">
                    <img
                      src={post.featured_image}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="bg-purple-900/40 text-purple-300 text-xs font-bold px-3 py-1 rounded-full">
                      {getCategory(post.meta_keywords)}
                    </span>
                    <span className="text-gray-600 text-xs">{getReadTime(post.excerpt)}</span>
                  </div>
                  <h2 className="text-lg font-bold mb-3 leading-snug group-hover:text-purple-300 transition">{post.title}</h2>
                  <p className="text-gray-400 text-sm leading-relaxed mb-4">{post.excerpt}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-xs">{formatDate(post.published_at)}</span>
                    <span className="text-purple-400 text-sm font-semibold">Read more →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-white/10 px-8 py-10 text-center text-gray-600 text-sm">
        <Link href="/" className="text-white font-bold">KlipflowAI</Link> © 2026 · All rights reserved ·{" "}
        <Link href="/privacy-policy" className="hover:text-white transition">Privacy Policy</Link> ·{" "}
        <Link href="/terms-of-service" className="hover:text-white transition">Terms of Service</Link>
      </footer>
    </main>
  );
}