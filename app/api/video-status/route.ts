import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getSetting(key: string): Promise<string> {
  const { data } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", key)
    .single();
  return data?.value ?? "";
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const task_id = searchParams.get("task_id");
    const provider = searchParams.get("provider") ?? "kie";

    if (!task_id) {
      return NextResponse.json({ error: "task_id is required" }, { status: 400 });
    }

    // ================================================================
    // HIGGSFIELD status
    // ================================================================
    if (provider === "higgsfield") {
      const keyId = await getSetting("higgsfield_key_id");
      const keySecret = await getSetting("higgsfield_key_secret");
      if (!keyId || !keySecret) {
        return NextResponse.json({ error: "Higgsfield not configured" }, { status: 503 });
      }

      // Correct status endpoint from docs
      const res = await fetch(`https://platform.higgsfield.ai/requests/${task_id}/status`, {
        headers: { 
          "Authorization": `Key ${keyId}:${keySecret}`,
          "Accept": "application/json",
        },
      });

      const rawText = await res.text();
      console.log("Higgsfield status raw:", rawText);
      let data: any = {};
      try { data = JSON.parse(rawText); } catch { data = {}; }

      // Status values: queued, in_progress, completed, failed, nsfw
      const isDone = data.status === "completed";
      const isFailed = data.status === "failed" || data.status === "nsfw";

      // Completed response has video.url directly
      const videoUrl = data?.video?.url ?? null;

      console.log("Higgsfield status:", data.status, "videoUrl:", videoUrl);
      return NextResponse.json({
        success: true,
        status: data.status,
        video_url: videoUrl,
        completed: isDone,
        failed: isFailed,
      });
    }

    // ================================================================
    // VEO3 status — dedicated endpoint /api/v1/veo/record-info
    // Response: data.successFlag === 1 means done
    // URL: data.response.resultUrls[0]
    // ================================================================
    if (provider === "veo3") {
      const kieApiKey = await getSetting("kie_api_key");
      if (!kieApiKey) {
        return NextResponse.json({ error: "Kie.ai not configured" }, { status: 503 });
      }

      const res = await fetch(`https://api.kie.ai/api/v1/veo/record-info?taskId=${task_id}`, {
        headers: { "Authorization": `Bearer ${kieApiKey}` },
      });

      const rawText = await res.text();
      console.log("Veo3 status raw:", rawText);
      let data: any = {};
      try { data = JSON.parse(rawText); } catch { data = {}; }

      const jobData = data.data ?? {};

      // Veo3 uses successFlag: 1 = done, errorCode != null = failed
      const isDone = jobData.successFlag === 1;
      const isFailed = !!jobData.errorCode && jobData.errorCode !== null;

      // Veo3 URL is at data.response.resultUrls[0]
      let videoUrl: string | null = null;
      if (isDone && jobData.response) {
        videoUrl = jobData.response?.resultUrls?.[0]
          ?? jobData.response?.originUrls?.[0]
          ?? null;
      }

      // Fallback state string for display
      const state = isDone ? "success" : isFailed ? "fail" : "processing";

      console.log("Veo3 status:", state, "isDone:", isDone, "videoUrl:", videoUrl);
      return NextResponse.json({
        success: true,
        status: state,
        video_url: videoUrl,
        completed: isDone,
        failed: isFailed,
      });
    }

    // ================================================================
    // KIE.AI Market API — all other models
    // Endpoint: /api/v1/jobs/recordInfo
    // Response: data.state = "success" | "fail" | "queuing" | "generating"
    // URL: parse data.resultJson → resultUrls[0]
    // ================================================================
    const kieApiKey = await getSetting("kie_api_key");
    if (!kieApiKey) {
      return NextResponse.json({ error: "Kie.ai not configured" }, { status: 503 });
    }

    const res = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${task_id}`, {
      headers: { "Authorization": `Bearer ${kieApiKey}` },
    });

    const rawText = await res.text();
    console.log("Kie.ai status raw:", rawText);
    let data: any = {};
    try { data = JSON.parse(rawText); } catch { data = {}; }

    const jobData = data.data ?? {};
    const state = jobData.state ?? "";

    // State values from docs: queuing, generating, success, fail
    const isDone = state === "success" || state === "succeed" || state === "completed";
    const isFailed = state === "fail" || state === "failed" || state === "error";

    let videoUrl: string | null = null;

    if (isDone) {
      // Primary: parse resultJson string → resultUrls[0]
      if (jobData.resultJson) {
        try {
          const result = JSON.parse(jobData.resultJson);
          console.log("Kie.ai resultJson parsed:", JSON.stringify(result));
          videoUrl = result.resultUrls?.[0]
            ?? result.url
            ?? result.video_url
            ?? result.videoUrl
            ?? null;
        } catch {
          console.log("Failed to parse resultJson:", jobData.resultJson);
        }
      }

      // Fallback: check direct fields on jobData
      if (!videoUrl) {
        videoUrl = jobData.videoInfo?.videoUrl
          ?? jobData.videoInfo?.video_url
          ?? jobData.video_url
          ?? jobData.url
          ?? null;
      }
    }

    console.log("Kie.ai status:", state, "isDone:", isDone, "videoUrl:", videoUrl, "failMsg:", jobData.failMsg ?? "");

    return NextResponse.json({
      success: true,
      status: state,
      video_url: videoUrl,
      completed: isDone,
      failed: isFailed,
      fail_reason: isFailed ? (jobData.failMsg ?? "Generation failed") : undefined,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Status check error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
