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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const task_id = searchParams.get("task_id");
    const provider = searchParams.get("provider") ?? "kie";

    if (!task_id) return NextResponse.json({ error: "task_id is required" }, { status: 400 });

    // ---- HIGGSFIELD status ----
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

      const videoUrl = data?.video?.url ?? data?.videos?.[0]?.url ?? data?.output?.url ?? null;
      const isDone = data.status === "completed";
      const isFailed = data.status === "failed" || data.status === "nsfw";

      return NextResponse.json({
        success: true,
        status: data.status,
        video_url: videoUrl,
        completed: isDone,
        failed: isFailed,
      });
    }

    // ---- KIE.AI status (all other models) ----
    const kieApiKey = await getSetting("kie_api_key");
    if (!kieApiKey) return NextResponse.json({ error: "Kie.ai not configured" }, { status: 503 });

    const res = await fetch(`https://api.kie.ai/api/v1/jobs/${task_id}`, {
      headers: { "Authorization": `Bearer ${kieApiKey}` },
    });

    const rawText = await res.text();
    console.log("Kie.ai status raw:", rawText);
    let data: any = {};
    try { data = JSON.parse(rawText); } catch { data = {}; }

    // Kie.ai status values: pending, processing, completed, failed
    const jobData = data.data ?? data;
    const status = jobData.status ?? jobData.jobStatus ?? "";
    const isDone = status === "completed" || status === "succeed" || status === "success";
    const isFailed = status === "failed" || status === "error";

    // Extract video URL from Kie.ai response
    const videoUrl = jobData.works?.[0]?.video?.resource
      ?? jobData.works?.[0]?.url
      ?? jobData.output?.url
      ?? jobData.video_url
      ?? jobData.result?.url
      ?? null;

    return NextResponse.json({
      success: true,
      status,
      video_url: videoUrl,
      completed: isDone,
      failed: isFailed,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Status check error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
