"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Menu, X } from "lucide-react";
import AppSidebar from "../AppSidebar";
import LanguageSwitcher from "../LanguageSwitcher";
import { ButtonLink } from "../ui/Button";
import { BrandWordmark } from "./Brand";

const NAV = [
  { href: "#features", key: "features" },
  { href: "#demo", key: "demo" },
  { href: "#use-cases", key: "useCases" },
  { href: "#pricing", key: "pricing" },
  { href: "#faq", key: "faq" },
] as const;

/** Thin top bar: transparent over the hero, translucent dark once scrolled. Menu opens the app sidebar. */
export default function HomeHeader({ loggedIn }: { loggedIn: boolean }) {
  const t = useTranslations("landing.nav");
  const c = useTranslations("common");
  const [solid, setSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <>
      <header className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${solid ? "border-b border-white/[0.06] bg-black/70 backdrop-blur-md" : "bg-gradient-to-b from-black/60 to-transparent"}`}>
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 md:h-16 md:px-8">
          <button onClick={() => setMenuOpen(true)} aria-label={c("openMenu")} className="-ms-2 grid h-10 w-10 place-items-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white">
            <Menu size={20} aria-hidden />
          </button>
          <Link href="/" aria-label={c("home")}><BrandWordmark size={28} /></Link>
          <nav className="ms-6 hidden items-center gap-1 lg:flex" aria-label={c("pageSections")}>
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="rounded-full px-3 py-1.5 text-sm text-white/65 transition-colors hover:text-white">{t(n.key)}</a>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <LanguageSwitcher className="hidden sm:inline-block" />
            {loggedIn ? (
              <ButtonLink href="/dashboard" variant="secondary" size="sm" className="rounded-full">{c("goToDashboard")} <ArrowRight size={15} className="rtl:-scale-x-100" aria-hidden /></ButtonLink>
            ) : (
              <>
                <Link href="/login" className="hidden rounded-full px-3 py-1.5 text-sm text-white/75 transition-colors hover:text-white sm:inline-block">{c("signIn")}</Link>
                <Link href="/signup" className="inline-flex h-9 items-center rounded-full border border-white/70 px-4 text-sm font-medium text-white transition-colors hover:bg-white hover:text-black">{c("startFree")}</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={c("menu")}>
          <div className="absolute inset-0 bg-black/70" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 start-0 w-72 max-w-[85%] border-e border-line bg-canvas">
            <button onClick={() => setMenuOpen(false)} aria-label={c("closeMenu")} className="absolute end-3 top-4 grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-white/5 hover:text-ink">
              <X size={20} aria-hidden />
            </button>
            <AppSidebar loggedIn={loggedIn} onNavigate={() => setMenuOpen(false)} />
            <div className="absolute inset-x-3 bottom-4"><LanguageSwitcher up block /></div>
          </div>
        </div>
      )}
    </>
  );
}
