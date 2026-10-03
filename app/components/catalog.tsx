import {
  Activity, AudioLines, BookOpen, Bot, CircleHelp, Clapperboard, CreditCard, FileVideo, GraduationCap,
  Image, ImagePlay, Images, Languages, Layers, Repeat2, LayoutDashboard, Megaphone, Newspaper, PenLine, Radar,
  ScanFace, Settings, UserRound, WandSparkles, type LucideIcon,
} from "lucide-react";

// Single source of truth for Studio modules, shared by the sidebar, the
// homepage Quick Starts and the Studio itself.
export type StudioModuleId =
  | "text_to_video" | "image_to_video" | "ugc_ad" | "ai_actor" | "voice" | "text_to_image"
  | "script_to_video" | "image_ad" | "prompt" | "script" | "video_translator" | "video_remix" | "ai_actor_swap" | "series_cloner";

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
  { id: "video_remix",      title: "Video Remix",         desc: "Restyle, recreate or recast any video",     icon: Repeat2, badge: "New" },
  { id: "ai_actor_swap",    title: "AI Actor Swap",       desc: "New face, language and voice for any video", icon: ScanFace, badge: "New" },
  { id: "series_cloner",    title: "Series Cloner",       desc: "Clone a viral series formula with new characters", icon: Layers, badge: "New" },
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

// Video generation models (shared by the Studio and admin Showcase Studio).
// `enabledKey` maps to a toggle in Admin > AI Providers.
export interface VideoModel {
  id: string;
  name: string;
  desc: string;
  tokens: number;
  badge: string;
  badges?: string[];
  available: boolean;
  provider: string;
  hasSound: boolean;
  enabledKey: string;
}

export const VIDEO_MODELS: VideoModel[] = [
  { id: "kling-v1-6-std",  name: "Kling 1.6 Standard", desc: "Fast, great for drafts",               tokens: 8,   badge: "",                available: true,  provider: "kie", hasSound: false, enabledKey: "kling_v1_6_enabled" },
  { id: "kling-v1-6-pro",  name: "Kling 1.6 Pro",      desc: "High quality, smooth motion",           tokens: 10,  badge: "Recommended",     available: true,  provider: "kie", hasSound: false, enabledKey: "kling_v1_6_enabled" },
  { id: "kling-v2-master", name: "Kling 2.1 Master",   desc: "Best realism and motion",               tokens: 20,  badge: "Best Quality",    available: true,  provider: "kie", hasSound: false, enabledKey: "kling_v2_master_enabled" },
  { id: "kling-v3-std",    name: "Kling 3.0 Standard", desc: "Cinematic quality, audio, up to 15s",   tokens: 15,  badge: "Best Quality",    badges: ["Best Quality", "With Audio"], available: true, provider: "kie", hasSound: true, enabledKey: "kling_v3_enabled" },
  { id: "kling-v3-pro",    name: "Kling 3.0 Pro",      desc: "1080p cinematic, audio, multi-shot",    tokens: 20,  badge: "Ultra Quality",   badges: ["Ultra Quality", "With Audio"], available: true, provider: "kie", hasSound: true, enabledKey: "kling_v3_enabled" },
  { id: "veo3-fast",       name: "Veo 3.1 Fast",       desc: "Google AI, native audio, 720p",         tokens: 15,  badge: "With Audio",      available: true,  provider: "kie", hasSound: true,  enabledKey: "veo3_fast_enabled" },
  { id: "veo3-quality",    name: "Veo 3.1 Quality",    desc: "Google AI, cinematic, 1080p",            tokens: 60,  badge: "Premium",         badges: ["Premium", "With Audio"], available: true, provider: "kie", hasSound: true, enabledKey: "veo3_quality_enabled" },
  { id: "seedance-2",      name: "Seedance 2.0",       desc: "ByteDance, best quality + audio",        tokens: 30,  badge: "Best Quality",    badges: ["Best Quality", "With Audio"], available: true, provider: "kie", hasSound: true, enabledKey: "seedance2_enabled" },
  { id: "seedance-2-fast", name: "Seedance 2.0 Fast",  desc: "ByteDance, fast + audio",                tokens: 15,  badge: "With Audio",      available: true,  provider: "kie", hasSound: true,  enabledKey: "seedance2_fast_enabled" },
  { id: "hailuo-pro",      name: "Hailuo 2.3",         desc: "MiniMax, fast generation",               tokens: 8,   badge: "",                available: true,  provider: "kie", hasSound: false, enabledKey: "hailuo_enabled" },
  { id: "sora-2",          name: "Sora 2",             desc: "OpenAI, premium realism",                tokens: 10,  badge: "Premium",         available: true,  provider: "kie", hasSound: false, enabledKey: "sora2_enabled" },
  { id: "wan-2-6",         name: "Wan 2.6",            desc: "Alibaba, fast and affordable",           tokens: 10,  badge: "Cheapest",        available: true,  provider: "kie", hasSound: false, enabledKey: "wan26_enabled" },
  { id: "grok-imagine",    name: "Grok Imagine",       desc: "xAI, fast and cheap",                    tokens: 5,   badge: "Most Affordable", available: true,  provider: "kie", hasSound: false, enabledKey: "grok_enabled" },
  { id: "luma-ray-3",      name: "Luma Ray 3",         desc: "Cinematic quality",                      tokens: 15,  badge: "",                available: true,  provider: "kie", hasSound: false, enabledKey: "luma_enabled" },
  { id: "higgsfield-ugc",  name: "Higgsfield UGC",     desc: "Realistic UGC ad videos",                tokens: 10,  badge: "Best for Ads",    available: true,  provider: "higgsfield", hasSound: false, enabledKey: "higgsfield_enabled" },
  { id: "runway-gen4",     name: "Runway Gen-4",       desc: "Professional cinematic quality",         tokens: 40,  badge: "Coming Soon",     available: false, provider: "runway", hasSound: false, enabledKey: "" },
];

// Core models are on unless explicitly disabled; others need an explicit enable.
const CORE_MODEL_KEYS = ["kling_v1_6_enabled", "kling_v2_master_enabled", "kling_v3_enabled", "higgsfield_enabled"];

export function isModelVisible(m: VideoModel, enabledKeys: Record<string, boolean>): boolean {
  if (!m.available) return false;
  if (!m.enabledKey) return false;
  if (enabledKeys[m.enabledKey] === false) return false;
  if (enabledKeys[m.enabledKey] === true) return true;
  return CORE_MODEL_KEYS.includes(m.enabledKey);
}
