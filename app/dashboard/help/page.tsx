import Link from "next/link";
import { BookOpen, ChevronDown, Mail } from "lucide-react";
import { PageHeader, SectionTitle, cardClass } from "../../components/ui";

export default function Help() {
  const faqs = [
    { q: "How do tokens work?", a: "1 video = 10 tokens, 1 image = 2 tokens, 1 script = 1 token. You start with 25 free tokens. Top up anytime from $5." },
    { q: "When will video generation be live?", a: "We're currently integrating with Kling, Veo 3, and Sora APIs. Video generation will be live very soon. You'll be notified by email." },
    { q: "How do I connect my social accounts?", a: "Go to Settings → Connected Social Accounts. Click Connect next to each platform. We use official APIs so your accounts are always safe." },
    { q: "Can I get a refund?", a: "Token top-ups are non-refundable once purchased. Subscription plans can be cancelled anytime with no future charges." },
    { q: "How do I upgrade my plan?", a: "Go to Billing → Upgrade Plan. Stripe payments will be live soon. You'll be notified when subscriptions open." },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Help and support" description="Get answers and contact our team." />

      {/* CONTACT */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <a href="mailto:support@klipflowai.com" className={`${cardClass} group flex items-start gap-4 p-5 transition-colors hover:border-line-strong hover:bg-raised`}>
          <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-text"><Mail size={19} aria-hidden /></span>
          <div>
            <div className="text-sm font-semibold">Email support</div>
            <div className="mt-0.5 text-sm text-ink-muted">support@klipflowai.com</div>
          </div>
        </a>
        <Link href="/blog" className={`${cardClass} group flex items-start gap-4 p-5 transition-colors hover:border-line-strong hover:bg-raised`}>
          <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-text"><BookOpen size={19} aria-hidden /></span>
          <div>
            <div className="text-sm font-semibold">Guides</div>
            <div className="mt-0.5 text-sm text-ink-muted">Tutorials and tips</div>
          </div>
        </Link>
      </div>

      {/* FAQ */}
      <SectionTitle>Frequently asked questions</SectionTitle>
      <div className={`${cardClass} divide-y divide-line`}>
        {faqs.map((item) => (
          <details key={item.q} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-ink transition-colors hover:bg-white/[0.02] [&::-webkit-details-marker]:hidden">
              {item.q}
              <ChevronDown size={17} className="flex-shrink-0 text-ink-muted transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <p className="px-5 pb-4 text-sm leading-relaxed text-ink-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
