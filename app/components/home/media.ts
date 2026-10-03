import type { ShowcaseItem } from "../ShowcaseGrid";

/**
 * Picks a featured showcase video whose generation type matches, preferring
 * clips not already used elsewhere on the page. Images are skipped.
 */
export function pickClip(items: ShowcaseItem[], types: string[], used: Set<ShowcaseItem["id"]>, allowReuse = false): ShowcaseItem | null {
  const videos = items.filter((i) => i.output_type !== "image" && i.video_url);
  const match = videos.find((i) => types.includes(i.type ?? "") && !used.has(i.id))
    ?? (allowReuse ? videos.find((i) => types.includes(i.type ?? "")) : undefined);
  if (match) used.add(match.id);
  return match ?? null;
}

/** The hero clip: a cinematic text/image-to-video first, else any featured video. */
export function pickHero(items: ShowcaseItem[]): ShowcaseItem | null {
  const videos = items.filter((i) => i.output_type !== "image" && i.video_url && i.type !== "demo_video");
  return videos.find((i) => i.featured_category === "cinematic")
    ?? videos.find((i) => i.type === "text_to_video" || i.type === "image_to_video")
    ?? videos[0]
    ?? null;
}
