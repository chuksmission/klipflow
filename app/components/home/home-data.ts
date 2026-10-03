// Homepage content structure. Copy lives in messages/*.json under "landing";
// this file holds what's not translated: ids, links, which Studio module each
// item opens, and which showcase videos can illustrate it.
import type { StudioModuleId } from "../catalog";

/** Feature cards (vertical stack). `types` are generations.type values whose showcase clips can illustrate the card. */
export const FEATURES: { id: string; module: StudioModuleId | null; types: string[] }[] = [
  { id: "textToVideo", module: "text_to_video", types: ["text_to_video", "image_to_video"] },
  { id: "translator", module: "video_translator", types: ["video_translation", "video_translator"] },
  { id: "actorSwap", module: "ai_actor_swap", types: ["ai_actor_swap"] },
  { id: "facelessReels", module: "faceless_reels", types: ["faceless_reels"] },
  { id: "seriesCloner", module: "series_cloner", types: ["series_cloner"] },
  { id: "videoRemix", module: "video_remix", types: ["video_remix"] },
  // Not built yet: always a placeholder, "Coming soon"
  { id: "musicStudio", module: null, types: ["ai_music_studio"] },
];

/** "See it in action" slides, each filled by a featured Demo Studio recording of that tool. */
export const DEMO_SLIDES: { id: string; module: StudioModuleId }[] = [
  { id: "generate", module: "text_to_video" },
  { id: "translate", module: "video_translator" },
  { id: "series", module: "faceless_reels" },
];
export const DEMO_SLIDE_MS = 20_000;

/** The same clip shown in three output languages (captions are translated in messages). */
export const LANGUAGE_DEMO = ["en", "fr", "es"] as const;

/** Use-case tabs; each card opens a Studio module (or a page) with an optional starter prompt. */
export interface UseCase { id: string; module?: StudioModuleId; href?: string; prompt?: string; aspect_ratio?: string; types: string[] }
export const USE_CASES: { id: string; cards: UseCase[] }[] = [
  { id: "creators", cards: [
    { id: "facelessChannel", module: "faceless_reels", types: ["faceless_reels"] },
    { id: "seriesFormula", module: "series_cloner", types: ["series_cloner"] },
    { id: "autopilot", href: "/dashboard/autopilot", types: ["text_to_video"] },
    { id: "shorts", module: "text_to_video", prompt: "Slow drone shot over misty mountains at sunrise, epic cinematic lighting", aspect_ratio: "9:16", types: ["text_to_video"] },
  ] },
  { id: "brands", cards: [
    { id: "competitorAds", module: "video_remix", types: ["video_remix"] },
    { id: "adSpy", href: "/dashboard/ad-spy", types: ["ugc_ad"] },
    { id: "ugcAds", module: "ugc_ad", prompt: "Woman in her kitchen holding the product, talking to camera, authentic testimonial style", aspect_ratio: "9:16", types: ["ugc_ad"] },
    { id: "imageAds", module: "image_ad", types: ["image_ad"] },
  ] },
  { id: "musicians", cards: [
    { id: "musicVideo", module: "text_to_video", prompt: "Neon-lit rooftop performance at night, singer under rain, slow motion, music video style", aspect_ratio: "16:9", types: ["text_to_video"] },
    { id: "visualizer", module: "image_to_video", types: ["image_to_video"] },
    { id: "lyricReels", module: "faceless_reels", types: ["faceless_reels"] },
  ] },
  { id: "ecommerce", cards: [
    { id: "productDemo", module: "text_to_video", prompt: "Product rotating slowly on a marble pedestal, soft studio lighting, cinematic 4K", aspect_ratio: "16:9", types: ["text_to_video"] },
    { id: "productUgc", module: "ugc_ad", types: ["ugc_ad"] },
    { id: "productAds", module: "image_ad", types: ["image_ad"] },
    { id: "productLocal", module: "video_translator", types: ["video_translation", "video_translator"] },
  ] },
  { id: "educators", cards: [
    { id: "courseLanguages", module: "video_translator", types: ["video_translation", "video_translator"] },
    { id: "presenter", module: "ai_actor", types: ["ai_actor"] },
    { id: "explainers", module: "script_to_video", types: ["script_to_video", "text_to_video"] },
  ] },
  { id: "developers", cards: [
    { id: "api", href: "/api-docs", types: [] },
    { id: "batch", href: "/api-docs", types: [] },
    { id: "webhooks", href: "/api-docs", types: [] },
  ] },
];

/**
 * "Powered by" marquee. Only providers KlipflowAI actually calls are shown
 * (`live: true`); flip the others on when they're integrated.
 */
export const PROVIDERS: { name: string; row: 1 | 2; live: boolean }[] = [
  { name: "Kling", row: 1, live: true },
  { name: "Seedance", row: 1, live: true },
  { name: "HeyGen", row: 1, live: true },
  { name: "Runway", row: 1, live: true },
  { name: "ElevenLabs", row: 1, live: true },
  { name: "Sync Labs", row: 1, live: false }, // lip sync moved to HeyGen
  { name: "Replicate", row: 1, live: true },
  { name: "Veo", row: 1, live: true },
  { name: "OpenAI", row: 2, live: true },
  { name: "Anthropic", row: 2, live: true },
  { name: "Suno", row: 2, live: false }, // AI Music Studio isn't built yet
  { name: "Udio", row: 2, live: false },
  { name: "Higgsfield", row: 2, live: true },
  { name: "Browserless", row: 2, live: true },
  { name: "Luma", row: 2, live: true },
  { name: "MiniMax", row: 2, live: true },
];

/** Footer link groups (labels come from messages "landing.footer"). */
export const FOOTER_GROUPS: { id: string; links: { id: string; href: string }[] }[] = [
  { id: "product", links: [{ id: "studio", href: "/dashboard/studio" }, { id: "templates", href: "/#templates" }, { id: "gallery", href: "/#showcase" }] },
  { id: "features", links: [{ id: "textToVideo", href: "/ai-video-generator" }, { id: "translator", href: "/dashboard/studio?module=video_translator" }, { id: "facelessReels", href: "/faceless-reels-generator" }, { id: "adSpy", href: "/facebook-ad-spy-tool" }] },
  { id: "pricing", links: [{ id: "plans", href: "/#pricing" }, { id: "freeTrial", href: "/signup" }] },
  { id: "api", links: [{ id: "apiDocs", href: "/api-docs" }] },
  { id: "resources", links: [{ id: "blog", href: "/blog" }, { id: "academy", href: "/academy" }, { id: "faq", href: "/#faq" }] },
  { id: "company", links: [{ id: "about", href: "/about" }, { id: "contact", href: "/contact" }] },
  { id: "legal", links: [{ id: "privacy", href: "/privacy-policy" }, { id: "terms", href: "/terms-of-service" }, { id: "refund", href: "/refund-policy" }] },
];
