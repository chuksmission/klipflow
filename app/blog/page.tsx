import Link from "next/link";
import { ArrowRight, Newspaper } from "lucide-react";
import { supabase } from "../lib/supabase";
import MarketingShell from "../components/MarketingShell";

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
    <MarketingShell>
      <section className="px-4 pb-12 pt-20 text-center md:px-8">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Blog</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-muted">AI video strategy, ad intelligence, and content monetization guides — updated weekly.</p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24 md:px-8">
        {posts.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-line bg-surface px-6 py-20 text-center">
            <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.05] text-ink-muted"><Newspaper size={22} aria-hidden /></span>
            <h2 className="text-lg font-semibold">No posts yet</h2>
            <p className="mt-1 text-sm text-ink-muted">Check back soon — new content is on the way.</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-3">
            {posts.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`} className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-line-strong">
                {post.featured_image && (
                  <div className="aspect-[16/9] w-full overflow-hidden bg-raised">
                    <img src={post.featured_image} alt={post.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="rounded-full border border-line bg-white/[0.04] px-2.5 py-0.5 text-xs text-ink-muted">{getCategory(post.meta_keywords)}</span>
                    <span className="text-xs text-ink-subtle">{getReadTime(post.excerpt)}</span>
                  </div>
                  <h2 className="text-lg font-semibold leading-snug transition-colors group-hover:text-accent-text">{post.title}</h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-muted">{post.excerpt}</p>
                  <div className="flex-1" />
                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-xs text-ink-subtle">{formatDate(post.published_at)}</span>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-accent-text">Read <ArrowRight size={14} aria-hidden /></span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </MarketingShell>
  );
}
