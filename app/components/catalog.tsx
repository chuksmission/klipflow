import {
  Activity, AudioLines, BookOpen, Bot, CircleHelp, Clapperboard, CreditCard, FileVideo, GraduationCap,
  Image, ImagePlay, Images, Languages, LayoutDashboard, Megaphone, Newspaper, PenLine, Radar,
  Settings, UserRound, WandSparkles, type LucideIcon,
} from "lucide-react";

// Single source of truth for Studio modules, shared by the sidebar, the
// homepage Quick Starts and the Studio itself.
export type StudioModuleId =
  | "text_to_video" | "image_to_video" | "ugc_ad" | "ai_actor" | "voice" | "text_to_image"
  | "script_to_video" | "image_ad" | "prompt" | "script" | "video_translator";

export interface StudioModule {
  id: StudioModuleId;
  title: string;
  desc: string;
  icon: LucideIcon;
  badge?: string;
}

export const STUDIO_MODULES: StudioModule[] = [
  { id: "text_to_video",    title: "Text to Video",       desc: "Cinematic video from a text prompt",        icon: Clapperboard, badge: "Popular" },
  { id: "image_to_video",   title: "Image to Video",      desc: "Bring any still image to life",             icon: ImagePlay },
  { id: "ugc_ad",           title: "UGC Ads",             desc: "Creator-style testimonial ads",             icon: Megaphone, badge: "For ads" },
  { id: "script_to_video",  title: "Script to Video",     desc: "Multi-scene videos with native audio",      icon: FileVideo },
  { id: "video_translator", title: "Video Translator",    desc: "Translate any video with lip-sync",         icon: Languages, badge: "New" },
  { id: "ai_actor",         title: "AI Actor",            desc: "Photorealistic AI presenters",              icon: UserRound },
  { id: "text_to_image",    title: "Text to Image",       desc: "Images from text or a reference photo",     icon: Image },
  { id: "image_ad",         title: "Image Ads",           desc: "Scroll-stopping static ads",                icon: Newspaper },
  { id: "voice",            title: "Voice",               desc: "Natural AI voiceovers",                     icon: AudioLines },
  { id: "script",           title: "Script Writer",       desc: "Viral scripts with hooks and CTAs",         icon: PenLine, badge: "Free" },
  { id: "prompt",           title: "Prompt Expander",     desc: "Turn a simple idea into a cinematic prompt", icon: WandSparkles, badge: "Free" },
];

export const getStudioModule = (id: string | null | undefined) =>
  STUDIO_MODULES.find((m) => m.id === id);

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  authOnly?: boolean;
}

export const TOOL_LINKS: NavLink[] = [
  { href: "/dashboard/ad-spy",    label: "Ad Spy",    icon: Radar },
  { href: "/dashboard/autopilot", label: "Autopilot", icon: Bot },
];

export const LIBRARY_LINKS: NavLink[] = [
  { href: "/dashboard",          label: "Overview", icon: LayoutDashboard, authOnly: true },
  { href: "/dashboard/gallery",  label: "Gallery",  icon: Images,          authOnly: true },
  { href: "/dashboard/activity", label: "Activity", icon: Activity,        authOnly: true },
];

export const ACCOUNT_LINKS: NavLink[] = [
  { href: "/dashboard/billing",  label: "Billing",  icon: CreditCard, authOnly: true },
  { href: "/dashboard/settings", label: "Settings", icon: Settings,   authOnly: true },
  { href: "/dashboard/help",     label: "Help",     icon: CircleHelp, authOnly: true },
];

export const LEARN_LINKS: NavLink[] = [
  { href: "/academy", label: "Academy", icon: GraduationCap },
  { href: "/blog",    label: "Blog",    icon: BookOpen },
];

// Hand-off from the marketing site / templates into the Studio. Stored in
// localStorage so it survives signup + email verification.
export const PENDING_KEY = "klipflow_pending_generation";

export interface PendingGeneration {
  module: StudioModuleId;
  prompt?: string;
  model?: string;
  aspect_ratio?: string;
  duration?: string;
  savedAt: number;
}

export function savePendingGeneration(p: Omit<PendingGeneration, "savedAt">) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify({ ...p, savedAt: Date.now() })); } catch { /* storage unavailable */ }
}

// Returns and clears a pending hand-off; ignores anything older than a day.
export function takePendingGeneration(): PendingGeneration | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    localStorage.removeItem(PENDING_KEY);
    const p = JSON.parse(raw) as PendingGeneration;
    if (!p.module || Date.now() - p.savedAt > 24 * 60 * 60 * 1000) return null;
    return p;
  } catch {
    return null;
  }
}

export function hasPendingGeneration(): boolean {
  try { return !!localStorage.getItem(PENDING_KEY); } catch { return false; }
}

export const studioHref = (id: StudioModuleId) => `/dashboard/studio?module=${id}`;

// Showcase categories (admin assigns one when featuring a generation)
export const SHOWCASE_CATEGORIES = [
  { id: "ugc",          label: "UGC Ads" },
  { id: "product",      label: "Product Ads" },
  { id: "cinematic",    label: "Cinematic" },
  { id: "faceless",     label: "Faceless Content" },
  { id: "translation",  label: "Translations" },
  { id: "image",        label: "Images" },
] as const;

// Maps a generation's stored `type` back to the Studio module that made it.
export function moduleForGenerationType(type: string | null | undefined): StudioModuleId {
  const found = getStudioModule(type ?? "");
  if (found) return found.id;
  if (type === "video_translation") return "video_translator";
  return "text_to_video";
}
