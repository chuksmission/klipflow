// Social profiles shown in the homepage footer. URLs live in admin_settings
// (Admin → Site Settings); a platform's icon only shows when its URL is set.

export const SOCIAL_PLATFORMS = [
  { id: "tiktok", key: "social_tiktok", label: "TikTok", placeholder: "https://tiktok.com/@yourhandle" },
  { id: "instagram", key: "social_instagram", label: "Instagram", placeholder: "https://instagram.com/yourhandle" },
  { id: "youtube", key: "social_youtube", label: "YouTube", placeholder: "https://youtube.com/@yourhandle" },
  { id: "discord", key: "social_discord", label: "Discord", placeholder: "https://discord.gg/yourinvite" },
  { id: "x", key: "social_x", label: "Twitter / X", placeholder: "https://x.com/yourhandle" },
  { id: "facebook", key: "social_facebook", label: "Facebook", placeholder: "https://facebook.com/yourpage", optional: true },
  { id: "linkedin", key: "social_linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/company/yourcompany", optional: true },
] as const;

export type SocialId = (typeof SOCIAL_PLATFORMS)[number]["id"];
export interface SocialLink { id: SocialId; href: string }

/** Only absolute http(s) links are used, so a typo can't become a broken or unsafe link. */
export function cleanSocialUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}
