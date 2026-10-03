"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import LanguageSwitcher from "../LanguageSwitcher";
import { BrandWordmark } from "./Brand";
import SocialIcon from "./SocialIcon";
import { FOOTER_GROUPS } from "./home-data";
import type { SocialLink } from "../../lib/social-links";

const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) =>
  href.startsWith("/#") || href.startsWith("#")
    ? <a href={href} className="transition-colors hover:text-white">{children}</a>
    : <Link href={href} className="transition-colors hover:text-white">{children}</Link>;

/** Logo, social icons (only those with a URL set in Admin → Site Settings), link groups (accordions on phones, columns on desktop), copyright and language. */
export default function SiteFooter({ socialLinks }: { socialLinks: SocialLink[] }) {
  const t = useTranslations("landing.footer");
  const f = useTranslations("footer");

  return (
    <footer className="border-t border-white/[0.06] px-4 pb-10 pt-14 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <BrandWordmark size={30} />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-subtle">{t("tagline")}</p>
            {socialLinks.length > 0 && (
              <div className="mt-5 flex gap-2">
                {socialLinks.map((s) => (
                  <a key={s.id} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={t(`social.${s.id}`)}
                    className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] text-white/70 transition-colors hover:bg-white/15 hover:text-white">
                    <SocialIcon id={s.id} />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Desktop: columns */}
          <div className="hidden grid-cols-4 gap-x-10 gap-y-8 md:grid lg:grid-cols-7">
            {FOOTER_GROUPS.map((g) => (
              <div key={g.id}>
                <h3 className="mb-3 text-sm font-medium text-white">{t(`groups.${g.id}`)}</h3>
                <ul className="space-y-2 text-sm text-ink-subtle">
                  {g.links.map((l) => <li key={l.id}><NavLink href={l.href}>{t(`links.${l.id}`)}</NavLink></li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Phones: accordions (native details/summary, no JS) */}
        <div className="mt-8 divide-y divide-white/[0.06] border-y border-white/[0.06] md:hidden">
          {FOOTER_GROUPS.map((g) => (
            <details key={g.id} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between py-3.5 text-sm font-semibold text-white [&::-webkit-details-marker]:hidden">
                {t(`groups.${g.id}`)}
                <ChevronDown size={16} className="text-white/50 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <ul className="space-y-2.5 pb-4 text-sm text-ink-subtle">
                {g.links.map((l) => <li key={l.id}><NavLink href={l.href}>{t(`links.${l.id}`)}</NavLink></li>)}
              </ul>
            </details>
          ))}
        </div>

        <div className="mt-10 flex flex-col-reverse items-start gap-4 border-t border-white/[0.06] pt-6 text-sm text-ink-subtle sm:flex-row sm:items-center sm:justify-between md:mt-12">
          <span>{f("rights")}</span>
          <LanguageSwitcher up />
        </div>
      </div>
    </footer>
  );
}
