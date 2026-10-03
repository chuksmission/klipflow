import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { ButtonLink, buttonClass } from "./ui/Button";
import LanguageSwitcher from "./LanguageSwitcher";

// Header + footer for public marketing pages (landing pages, blog, legal, about...).
export function MarketingHeader() {
  const t = useTranslations("common");
  const f = useTranslations("footer");
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label={t("home")}>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-white"><Sparkles size={16} aria-hidden /></span>
          <span className="text-[17px] font-semibold tracking-tight text-ink">KlipflowAI</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label={t("mainNav")}>
          <Link href="/#templates" className={buttonClass("ghost", "sm")}>{f("templates")}</Link>
          <Link href="/#pricing" className={buttonClass("ghost", "sm")}>{f("pricing")}</Link>
          <Link href="/blog" className={buttonClass("ghost", "sm")}>{f("blog")}</Link>
          <Link href="/#faq" className={buttonClass("ghost", "sm")}>{f("faq")}</Link>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher className="hidden sm:inline-block" />
          <ButtonLink href="/login" variant="secondary" size="md">{t("signIn")}</ButtonLink>
          <span className="hidden sm:inline-flex"><ButtonLink href="/signup" variant="primary" size="md">{t("startFree")}</ButtonLink></span>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  const f = useTranslations("footer");
  const cols = [
    { title: f("product"), links: [{ href: "/#templates", label: f("templates") }, { href: "/#pricing", label: f("pricing") }, { href: "/api-docs", label: f("apiDocs") }] },
    { title: f("resources"), links: [{ href: "/blog", label: f("blog") }, { href: "/academy", label: f("academy") }, { href: "/#faq", label: f("faq") }] },
    { title: f("company"), links: [{ href: "/about", label: f("about") }, { href: "/contact", label: f("contact") }, { href: "/privacy-policy", label: f("privacy") }, { href: "/terms-of-service", label: f("terms") }, { href: "/refund-policy", label: f("refund") }] },
  ];
  return (
    <footer className="border-t border-line px-4 py-14 md:px-8">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-4">
        <div>
          <span className="text-[17px] font-semibold tracking-tight">KlipflowAI</span>
          <p className="mt-3 text-sm leading-relaxed text-ink-subtle">{f("tagline")}</p>
          <LanguageSwitcher up className="mt-5" />
        </div>
        {cols.map((col) => (
          <div key={col.title}>
            <h3 className="mb-4 text-sm font-medium text-ink">{col.title}</h3>
            <ul className="space-y-2.5 text-sm text-ink-subtle">
              {col.links.map((l) => <li key={l.href}><Link href={l.href} className="transition-colors hover:text-ink">{l.label}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-12 max-w-6xl border-t border-line pt-6 text-sm text-ink-subtle">{f("rights")}</div>
    </footer>
  );
}

export default function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}
