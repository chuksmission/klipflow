import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { Metadata } from "next";

export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string }>;
}

async function getPost(slug: string) {
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Post Not Found" };
  return {
    title: post.meta_title || post.title,
    description: post.meta_description || post.excerpt,
    keywords: post.meta_keywords,
    alternates: { canonical: `https://klipflowai.com/blog/${slug}` },
    openGraph: {
      title: post.meta_title || post.title,
      description: post.meta_description || post.excerpt,
      url: `https://klipflowai.com/blog/${slug}`,
      images: post.featured_image ? [{ url: post.featured_image }] : [],
    },
  };
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric"
  });
}

export default async function BlogPost({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <main className="min-h-screen bg-black text-white">
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10 sticky top-0 z-50 bg-black/90 backdrop-blur-md">
        <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
          KlipflowAI
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/blog" className="text-gray-400 hover:text-white text-sm font-semibold py-2 px-5 rounded-full border border-white/20 transition">
            ← Back to Blog
          </Link>
          <Link href="/signup" className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold py-2 px-5 rounded-full transition">
            Sign Up Free
          </Link>
        </div>
      </nav>

      <article className="max-w-3xl mx-auto px-8 py-16">
        {/* Category & Read time */}
        <div className="flex items-center gap-3 mb-6">
          {post.meta_keywords && (
            <span className="bg-purple-900/40 text-purple-300 text-xs font-bold px-3 py-1 rounded-full">
              {post.meta_keywords.split(",")[0].trim()}
            </span>
          )}
          <span className="text-gray-500 text-xs">{formatDate(post.published_at)}</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight">{post.title}</h1>

        {/* Excerpt */}
        {post.excerpt && (
          <p className="text-gray-400 text-xl leading-relaxed mb-8 border-l-4 border-purple-500 pl-4">
            {post.excerpt}
          </p>
        )}

        {/* Featured Image */}
        {post.featured_image && (
          <div className="w-full h-72 rounded-2xl overflow-hidden mb-10">
            <img src={post.featured_image} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Body */}
        <div
          className="prose prose-invert prose-lg max-w-none
            prose-headings:font-bold prose-headings:text-white
            prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
            prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
            prose-p:text-gray-300 prose-p:leading-relaxed prose-p:mb-4
            prose-li:text-gray-300 prose-li:leading-relaxed
            prose-ul:my-4 prose-ol:my-4
            prose-strong:text-white
            prose-a:text-purple-400 prose-a:no-underline hover:prose-a:text-purple-300"
          dangerouslySetInnerHTML={{ __html: post.html_body || "" }}
        />

        {/* CTA */}
        <div className="mt-16 bg-purple-900/20 border border-purple-500/30 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold mb-3">Ready to Try KlipflowAI?</h3>
          <p className="text-gray-400 mb-6">25 free tokens. No credit card. Start generating AI videos today.</p>
          <Link href="/signup" className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-10 rounded-full transition inline-block">
            Sign Up Free →
          </Link>
        </div>
      </article>

      <footer className="border-t border-white/10 px-8 py-10 text-center text-gray-600 text-sm">
        <Link href="/" className="text-white font-bold">KlipflowAI</Link> © 2026 ·{" "}
        <Link href="/privacy-policy" className="hover:text-white transition">Privacy Policy</Link> ·{" "}
        <Link href="/terms-of-service" className="hover:text-white transition">Terms of Service</Link>
      </footer>
    </main>
  );
}