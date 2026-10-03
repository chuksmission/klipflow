// Kie image tasks shared by server routes. Results are polled with
// getTaskStatus(taskId, "kie") from task-status.ts.

export type NanoAspect = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9" | "auto";

/**
 * Nano Banana Pro: text-to-image, or editing/compositing with up to 8 reference
 * images, at any common aspect ratio (unlike gpt-image's 2:3 / 3:2 / 1:1).
 */
export async function nanoBananaTask(key: string, prompt: string, images: string[], aspect: NanoAspect, resolution: "1K" | "2K" = "1K"): Promise<string> {
  if (!key) throw new Error("Image generation isn't configured.");
  const res = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "nano-banana-pro",
      input: { prompt: prompt.slice(0, 9500), image_input: images.slice(0, 8), aspect_ratio: aspect, resolution, output_format: "png" },
    }),
  });
  let data: { code?: number; msg?: string; data?: { taskId?: string; task_id?: string } } = {};
  try { data = await res.json(); } catch { /* handled below */ }
  const taskId = data.data?.taskId ?? data.data?.task_id;
  if (data.code !== 200 || !taskId) throw new Error(data.msg ?? "Couldn't start image generation.");
  return String(taskId);
}

/** Closest supported aspect for a video of the given size. */
export function aspectForSize(width: number, height: number): NanoAspect {
  const r = width / Math.max(1, height);
  const options: [NanoAspect, number][] = [["9:16", 9 / 16], ["2:3", 2 / 3], ["3:4", 3 / 4], ["4:5", 0.8], ["1:1", 1], ["5:4", 1.25], ["4:3", 4 / 3], ["3:2", 1.5], ["16:9", 16 / 9], ["21:9", 21 / 9]];
  return options.reduce((best, o) => (Math.abs(o[1] - r) < Math.abs(best[1] - r) ? o : best))[0];
}
