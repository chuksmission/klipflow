"use client";
import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { House, LogOut, Sparkles } from "lucide-react";
import {
  ACCOUNT_LINKS, LEARN_LINKS, LIBRARY_LINKS, STUDIO_MODULES, TOOL_LINKS,
  savePendingGeneration, studioHref, type NavLink, type StudioModuleId,
} from "./catalog";
import { ButtonLink } from "./ui/Button";

const CREATE_GRID: StudioModuleId[] = [
  "text_to_video", "image_to_video", "ugc_ad", "script_to_video",
  "video_translator", "video_remix", "ai_actor_swap", "ai_actor", "text_to_image", "image_ad",
];
const ASSIST_LIST: StudioModuleId[] = ["script", "prompt", "voice"];

interface Props {
  loggedIn: boolean;
  email?: string | null;
  onNavigate?: () => void;
  onSignOut?: () => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-3 pt-5 pb-2 text-xs font-medium text-ink-subtle">{children}</p>;
}

function NavRow({ link, active, href, onClick }: { link: NavLink; active: boolean; href: string; onClick?: () => void }) {
  const Icon = link.icon;
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={
        "flex items-center gap-3 h-9 px-3 rounded-lg text-sm transition-colors " +
        (active ? "bg-white/[0.08] text-ink" : "text-ink-muted hover:text-ink hover:bg-white/[0.04]")
      }
    >
      <Icon size={18} className={active ? "text-accent-text" : ""} aria-hidden />
      {link.label}
    </Link>
  );
}

function ModuleLinks({ loggedIn, onNavigate }: { loggedIn: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeModule = pathname === "/dashboard/studio" ? searchParams.get("module") : null;

  const go = (id: StudioModuleId) => {
    if (!loggedIn) savePendingGeneration({ module: id });
    onNavigate?.();
  };
  const hrefFor = (id: StudioModuleId) => (loggedIn ? studioHref(id) : "/signup");

  return (
    <>
      <SectionLabel>Create</SectionLabel>
      <div className="grid grid-cols-2 gap-1.5 px-1">
        {CREATE_GRID.map((id) => {
          const mod = STUDIO_MODULES.find((m) => m.id === id)!;
          const Icon = mod.icon;
          const active = activeModule === id;
          return (
            <Link
              key={id}
              href={hrefFor(id)}
              onClick={() => go(id)}
              aria-current={active ? "page" : undefined}
              className={
                "relative flex flex-col items-start gap-2 rounded-xl border p-2.5 text-[13px] leading-tight transition-colors " +
                (active
                  ? "border-accent/60 bg-accent/10 text-ink"
                  : "border-line bg-surface text-ink-muted hover:text-ink hover:border-line-strong")
              }
            >
              <Icon size={18} className={active ? "text-accent-text" : "text-ink"} aria-hidden />
              <span className="font-medium">{mod.title}</span>
              {mod.badge === "New" && (
                <span className="absolute top-2 right-2 rounded-full bg-signal/15 px-1.5 text-[10px] font-medium text-signal">New</span>
              )}
            </Link>
          );
        })}
      </div>

      <SectionLabel>Write and voice</SectionLabel>
      {ASSIST_LIST.map((id) => {
        const mod = STUDIO_MODULES.find((m) => m.id === id)!;
        return (
          <NavRow
            key={id}
            link={{ href: hrefFor(id), label: mod.title, icon: mod.icon }}
            href={hrefFor(id)}
            active={activeModule === id}
            onClick={() => go(id)}
          />
        );
      })}
    </>
  );
}

export default function AppSidebar({ loggedIn, email, onNavigate, onSignOut }: Props) {
  const pathname = usePathname();
  const linkHref = (l: NavLink) => (loggedIn || !l.href.startsWith("/dashboard") ? l.href : "/signup");

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Link href={loggedIn ? "/dashboard" : "/"} onClick={onNavigate} className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-white">
            <Sparkles size={16} aria-hidden />
          </span>
          <span className="text-[17px] font-semibold tracking-tight text-ink">KlipflowAI</span>
        </Link>
      </div>

      <nav className="no-scrollbar flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        <NavRow link={{ href: "/", label: "Home", icon: House }} href="/" active={pathname === "/"} onClick={onNavigate} />

        <Suspense fallback={null}>
          <ModuleLinks loggedIn={loggedIn} onNavigate={onNavigate} />
        </Suspense>

        <SectionLabel>Grow</SectionLabel>
        {TOOL_LINKS.map((l) => (
          <NavRow key={l.href} link={l} href={linkHref(l)} active={pathname === l.href} onClick={onNavigate} />
        ))}

        {loggedIn && (
          <>
            <SectionLabel>Library</SectionLabel>
            {LIBRARY_LINKS.map((l) => (
              <NavRow key={l.href} link={l} href={l.href} active={pathname === l.href} onClick={onNavigate} />
            ))}
            <SectionLabel>Account</SectionLabel>
            {ACCOUNT_LINKS.map((l) => (
              <NavRow key={l.href} link={l} href={l.href} active={pathname === l.href} onClick={onNavigate} />
            ))}
          </>
        )}

        <SectionLabel>Learn</SectionLabel>
        {LEARN_LINKS.map((l) => (
          <NavRow key={l.href} link={l} href={l.href} active={pathname.startsWith(l.href)} onClick={onNavigate} />
        ))}
      </nav>

      <div className="border-t border-line p-4">
        {loggedIn ? (
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs text-ink-subtle">{email}</span>
            {onSignOut && (
              <button onClick={onSignOut} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-ink-muted transition-colors hover:bg-white/5 hover:text-ink">
                <LogOut size={14} aria-hidden /> Sign out
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-surface p-3">
            <p className="text-sm font-medium text-ink">25 free tokens</p>
            <p className="mb-3 text-xs text-ink-muted">No credit card required.</p>
            <ButtonLink href="/signup" variant="primary" size="sm" className="w-full" onClick={onNavigate}>Start for free</ButtonLink>
          </div>
        )}
      </div>
    </div>
  );
}
