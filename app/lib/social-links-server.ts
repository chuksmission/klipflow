// Server-only: reads the social profile URLs from admin_settings.
import { createClient } from "@supabase/supabase-js";
import { SOCIAL_PLATFORMS, cleanSocialUrl, type SocialLink } from "./social-links";

/** Configured social links in display order; empty or invalid URLs are left out. Never throws. */
export async function getSocialLinks(): Promise<SocialLink[]> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return [];
    const supabase = createClient(url, key);
    const { data } = await supabase.from("admin_settings").select("key, value").in("key", SOCIAL_PLATFORMS.map((p) => p.key));
    const byKey = new Map((data ?? []).map((r) => [r.key as string, r.value as string]));
    return SOCIAL_PLATFORMS.flatMap((p) => {
      const href = cleanSocialUrl(byKey.get(p.key));
      return href ? [{ id: p.id, href }] : [];
    });
  } catch {
    return [];
  }
}
