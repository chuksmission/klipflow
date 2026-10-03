import Link from "next/link";
import { BookOpen, ChevronDown, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader, SectionTitle, cardClass } from "../../components/ui";

export default function Help() {
  const t = useTranslations("help");
  const faqs = t.raw("faq") as { q: string; a: string }[];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("title")} description={t("description")} />

      {/* CONTACT */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <a href="mailto:support@klipflowai.com" className={`${cardClass} group flex items-start gap-4 p-5 transition-colors hover:border-line-strong hover:bg-raised`}>
          <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-text"><Mail size={19} aria-hidden /></span>
          <div>
            <div className="text-sm font-semibold">{t("emailSupport")}</div>
            <div className="mt-0.5 text-sm text-ink-muted">support@klipflowai.com</div>
          </div>
        </a>
        <Link href="/blog" className={`${cardClass} group flex items-start gap-4 p-5 transition-colors hover:border-line-strong hover:bg-raised`}>
          <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-text"><BookOpen size={19} aria-hidden /></span>
          <div>
            <div className="text-sm font-semibold">{t("guides")}</div>
            <div className="mt-0.5 text-sm text-ink-muted">{t("guidesDesc")}</div>
          </div>
        </Link>
      </div>

      {/* FAQ */}
      <SectionTitle>{t("faqTitle")}</SectionTitle>
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
