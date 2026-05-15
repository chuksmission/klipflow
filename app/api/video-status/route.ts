import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAdminSetting(key: string): Promise<string> {
  const { data } = await supabase.from("admin_settings").select("value").eq("key", key).single();
  return data?.value ?? "";
}

async function generateKlingToken(): Promise<string> {
  const accessKey = process.env.KLING_ACCESS_KEY ?? await getAdminSetting("kling_access_key");
  const secretKey = process.env.KLING_SECRET_KEY ?? await getAdminSetting("kling_secret_key");
  if (!accessKey || !secretKey) throw new Error("Kling API keys not configured");
  const secret = new TextEncoder().encode(secretKey);
  return new jose.SignJWT({
    iss: accessKey,
    exp: Math.floor(Date.now() / 1000) + 1800,
    nbf: Math.floor(Date.now() / 1000) - 5,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .sign(secret);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const task_id = searchParams.get("task_id");
    const mode = searchParams.get("mode") ?? "text_to_video";
    const provider = searchParams.get("provider") ?? "kling";

    if (!task_id) return NextResponse.json({ error: "task_id is required" }, { status: 400 });

    // Higgsfield status
    if (provider === "higgsfield") {
      const keyId = await getAdminSetting("higgsfield_key_id");
      const keySecret = await getAdminSetting("higgsfield_key_secret");
      if (!keyId || !keySecret) return NextResponse.json({ error: "Higgsfield not configured" }, { status: 503 });

      const credentials = keyId + ":" + keySecret;
      const response = await fetch("https://platform.higgsfield.ai/requests/" + task_id + "/status", {
        headers: { "Authorization": "Key " + credentials },
      });

      const rawText = await response.text();
      console.log("Higgsfield status raw:", rawText);

      let data: any = {};
      try { data = JSON.parse(rawText); } catch { data = {}; }

      // Try all possible video URL locations
      const videoUrl = data?.video?.url
        ?? data?.videos?.[0]?.url
        ?? data?.output?.url
        ?? data?.output?.video_url
        ?? data?.result?.url
        ?? null;

      const isDone = data.status === "completed";
      const isFailed = data.status === "failed" || data.status === "nsfw";

      return NextResponse.json({
        success: true,
        status: data.status,
        video_url: videoUrl,
        completed: isDone,
        failed: isFailed,
        progress: data.status ?? "",
      });
    }

    // Kling status
    const token = await generateKlingToken();
    const endpoint = mode === "image_to_video"
      ? `https://api.klingai.com/v1/videos/image2video/${task_id}`
      : `https://api.klingai.com/v1/videos/text2video/${task_id}`;

    const response = await fetch(endpoint, {
      headers: { Authorization: "Bearer " + token },
    });

    const data = await response.json() as {
      data?: {
        task_status?: string;
        task_status_msg?: string;
        task_result?: { videos?: Array<{ url: string }> };
      };
      message?: string;
    };

    if (!response.ok) {
      return NextResponse.json({ error: data.message ?? "Status check failed" }, { status: response.status });
    }

    const taskData = data.data;
    const status = taskData?.task_status;
    const videoUrl = taskData?.task_result?.videos?.[0]?.url;

    return NextResponse.json({
      success: true,
      status,
      video_url: videoUrl ?? null,
      completed: status === "succeed",
      failed: status === "failed",
      progress: taskData?.task_status_msg ?? "",
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Status check error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}