import Link from "next/link";
import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { ButtonLink, buttonClass } from "./ui/Button";

// Header + footer for public marketing pages (landing pages, blog, legal, about...).
export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="KlipflowAI home">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-white"><Sparkles size={16} aria-hidden /></span>
          <span className="text-[17px] font-semibold tracking-tight text-ink">KlipflowAI</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          <Link href="/#templates" className={buttonClass("ghost", "sm")}>Templates</Link>
          <Link href="/#pricing" className={buttonClass("ghost", "sm")}>Pricing</Link>
          <Link href="/blog" className={buttonClass("ghost", "sm")}>Blog</Link>
          <Link href="/#faq" className={buttonClass("ghost", "sm")}>FAQ</Link>
        </nav>
        <div className="flex items-center gap-2">
          <ButtonLink href="/login" variant="secondary" size="md">Sign in</ButtonLink>
          <ButtonLink href="/signup" variant="primary" size="md" className="hidden sm:inline-flex">Start for free</ButtonLink>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  const cols = [
    { title: "Product", links: [{ href: "/#templates", label: "Templates" }, { href: "/#pricing", label: "Pricing" }, { href: "/api-docs", label: "API docs" }] },
    { title: "Resources", links: [{ href: "/blog", label: "Blog" }, { href: "/academy", label: "Academy" }, { href: "/#faq", label: "FAQ" }] },
    { title: "Company", links: [{ href: "/about", label: "About" }, { href: "/contact", label: "Contact" }, { href: "/privacy-policy", label: "Privacy policy" }, { href: "/terms-of-service", label: "Terms of service" }, { href: "/refund-policy", label: "Refund policy" }] },
  ];
  return (
    <footer className="border-t border-line px-4 py-14 md:px-8">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-4">
        <div>
          <span className="text-[17px] font-semibold tracking-tight">KlipflowAI</span>
          <p className="mt-3 text-sm leading-relaxed text-ink-subtle">Spy on what works, create better ads, and launch them, all in one place.</p>
        </div>
        {cols.map((col) => (
          <div key={col.title}>
            <h3 className="mb-4 text-sm font-medium text-ink">{col.title}</h3>
            <ul className="space-y-2.5 text-sm text-ink-subtle">
              {col.links.map((l) => <li key={l.label}><Link href={l.href} className="transition-colors hover:text-ink">{l.label}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-12 max-w-6xl border-t border-line pt-6 text-sm text-ink-subtle">© 2026 KlipflowAI. All rights reserved.</div>
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
