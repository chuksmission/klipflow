import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getSetting(key: string): Promise<string> {
  const { data } = await supabase.from("admin_settings").select("value").eq("key", key).single();
  return data?.value ?? "";
}

// Try every known URL field across all providers
function extractVideoUrl(obj: any): string | null {
  if (!obj || typeof obj !== "object") return null;
  return (
    obj.videoInfo?.videoUrl ??
    obj.videoInfo?.video_url ??
    obj.resultUrls?.[0] ??
    obj.url ??
    obj.video_url ??
    obj.videoUrl ??
    obj.works?.[0]?.resource?.resource ??
    obj.works?.[0]?.url ??
    obj.works?.[0]?.video_url ??
    obj.videos?.[0]?.url ??
    obj.output?.url ??
    obj.output?.video_url ??
    obj.result?.url ??
    obj.result?.video_url ??
    obj.urls?.[0] ??
    null
  );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const task_id = searchParams.get("task_id");
    const provider = searchParams.get("provider") ?? "kie";

    if (!task_id) return NextResponse.json({ error: "task_id is required" }, { status: 400 });

    // ================================================================
    // HIGGSFIELD status
    // ================================================================
    if (provider === "higgsfield") {
      const keyId = await getSetting("higgsfield_key_id");
      const keySecret = await getSetting("higgsfield_key_secret");
      if (!keyId || !keySecret) return NextResponse.json({ error: "Higgsfield not configured" }, { status: 503 });

      const res = await fetch(`https://platform.higgsfield.ai/requests/${task_id}/status`, {
        headers: { "Authorization": `Key ${keyId}:${keySecret}` },
      });

      const rawText = await res.text();
      console.log("Higgsfield status raw:", rawText);
      let data: any = {};
      try { data = JSON.parse(rawText); } catch { data = {}; }

      const isDone = data.status === "completed";
      const isFailed = data.status === "failed" || data.status === "nsfw";
      const videoUrl = data?.video?.url ?? data?.videos?.[0]?.url ?? data?.output?.url ?? extractVideoUrl(data) ?? null;

      console.log("Higgsfield status:", data.status, "videoUrl:", videoUrl);
      return NextResponse.json({ success: true, status: data.status, video_url: videoUrl, completed: isDone, failed: isFailed });
    }

    // ================================================================
    // VEO3 status — dedicated endpoint
    // ================================================================
    if (provider === "veo3") {
      const kieApiKey = await getSetting("kie_api_key");
      if (!kieApiKey) return NextResponse.json({ error: "Kie.ai not configured" }, { status: 503 });

      const res = await fetch(`https://api.kie.ai/api/v1/veo/record-info?taskId=${task_id}`, {
        headers: { "Authorization": `Bearer ${kieApiKey}` },
      });

      const rawText = await res.text();
      console.log("Veo3 status raw:", rawText);
      let data: any = {};
      try { data = JSON.parse(rawText); } catch { data = {}; }

      const jobData = data.data ?? {};
      const state = jobData.state ?? jobData.status ?? data.status ?? "";
      const isDone = state === "success" || state === "succeed" || state === "completed";
      const isFailed = state === "fail" || state === "failed" || state === "error";
      let videoUrl: string | null = null;

      if (isDone) {
        // Try resultJson first
        if (jobData.resultJson) {
          try {
            const parsed = JSON.parse(jobData.resultJson);
            console.log("Veo3 resultJson:", JSON.stringify(parsed));
            videoUrl = extractVideoUrl(parsed);
          } catch { /* ignore */ }
        }
        // Fallback to direct fields on jobData or data
        if (!videoUrl) videoUrl = extractVideoUrl(jobData) ?? extractVideoUrl(data);
      }

      console.log("Veo3 status:", state, "isDone:", isDone, "videoUrl:", videoUrl);
      return NextResponse.json({ success: true, status: state, video_url: videoUrl, completed: isDone, failed: isFailed });
    }

    // ================================================================
    // KIE.AI status — all other models
    // ================================================================
    const kieApiKey = await getSetting("kie_api_key");
    if (!kieApiKey) return NextResponse.json({ error: "Kie.ai not configured" }, { status: 503 });

    const res = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${task_id}`, {
      headers: { "Authorization": `Bearer ${kieApiKey}` },
    });

    const rawText = await res.text();
    console.log("Kie.ai status raw:", rawText);
    let data: any = {};
    try { data = JSON.parse(rawText); } catch { data = {}; }

    const jobData = data.data ?? {};
    const state = jobData.state ?? "";
    // Kie.ai can return: pending, processing, success, succeed, completed, fail, failed
    const isDone = state === "success" || state === "succeed" || state === "completed";
    const isFailed = state === "fail" || state === "failed" || state === "error";
    let videoUrl: string | null = null;

    if (isDone) {
      // Try videoInfo directly first (confirmed format from docs)
      videoUrl = jobData.videoInfo?.videoUrl ?? jobData.videoInfo?.video_url ?? null;
      // Then try resultJson
      if (!videoUrl && jobData.resultJson) {
        try {
          const result = JSON.parse(jobData.resultJson);
          console.log("Kie.ai resultJson:", JSON.stringify(result));
          videoUrl = extractVideoUrl(result);
        } catch { /* ignore */ }
      }
      // Final fallback
      if (!videoUrl) videoUrl = extractVideoUrl(jobData) ?? extractVideoUrl(data);
    }

    console.log("Kie.ai status:", state, "isDone:", isDone, "videoUrl:", videoUrl, "jobData keys:", Object.keys(jobData));
    return NextResponse.json({ success: true, status: state, video_url: videoUrl, completed: isDone, failed: isFailed });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Status check error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
