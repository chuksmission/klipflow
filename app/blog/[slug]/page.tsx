import Link from "next/link";
import { ArrowRight, ChevronLeft } from "lucide-react";
import MarketingShell from "../../components/MarketingShell";
import { ButtonLink } from "../../components/ui/Button";
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
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-4 py-14 md:px-8 md:py-20">
        <Link href="/blog" className="mb-8 inline-flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-ink">
          <ChevronLeft size={16} aria-hidden /> All posts
        </Link>

        {/* Category and date */}
        <div className="mb-5 flex items-center gap-3">
          {post.meta_keywords && (
            <span className="rounded-full border border-line bg-white/[0.04] px-2.5 py-0.5 text-xs text-ink-muted">
              {post.meta_keywords.split(",")[0].trim()}
            </span>
          )}
          <span className="text-xs text-ink-subtle">{formatDate(post.published_at)}</span>
        </div>

        <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-5xl">{post.title}</h1>

        {post.excerpt && (
          <p className="mt-6 text-lg leading-relaxed text-ink-muted md:text-xl">{post.excerpt}</p>
        )}

        {post.featured_image && (
          <div className="mt-10 aspect-[16/9] w-full overflow-hidden rounded-2xl border border-line bg-raised">
            <img src={post.featured_image} alt={post.title} className="h-full w-full object-cover" />
          </div>
        )}

        <div className="kf-prose mt-10" dangerouslySetInnerHTML={{ __html: post.html_body || "" }} />

        {/* CTA */}
        <div className="relative mt-16 overflow-hidden rounded-2xl border border-line bg-surface p-8 text-center">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ background: "radial-gradient(60% 80% at 50% 0%, rgba(109,74,255,0.3), transparent 70%)" }} />
          <div className="relative">
            <h3 className="text-2xl font-semibold tracking-tight">Ready to try KlipflowAI?</h3>
            <p className="mt-2 text-ink-muted">25 free tokens. No credit card. Start generating AI videos today.</p>
            <ButtonLink href="/signup" variant="primary" size="lg" className="mt-6">Sign up free <ArrowRight size={17} aria-hidden /></ButtonLink>
          </div>
        </div>
      </article>
    </MarketingShell>
  );
}