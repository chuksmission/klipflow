import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";

async function generateKlingToken(): Promise<string> {
  const accessKey = process.env.KLING_ACCESS_KEY;
  const secretKey = process.env.KLING_SECRET_KEY;
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

    // Higgsfield status check
    if (provider === "higgsfield") {
      const keyId = process.env.HIGGSFIELD_KEY_ID;
      const keySecret = process.env.HIGGSFIELD_KEY_SECRET;
      if (!keyId || !keySecret) return NextResponse.json({ error: "Higgsfield not configured" }, { status: 503 });

      const credentials = keyId + ":" + keySecret;
      const response = await fetch("https://cloud.higgsfield.ai/v1/video/" + task_id, {
        headers: { "Authorization": "Key " + credentials },
      });

      const data = await response.json() as {
        status?: string;
        output?: { url?: string } | Array<{ url?: string }>;
        error?: string;
      };

      const videoUrl = Array.isArray(data.output)
        ? data.output[0]?.url
        : data.output?.url;

      return NextResponse.json({
        success: true,
        status: data.status,
        video_url: videoUrl ?? null,
        completed: data.status === "succeeded" || data.status === "completed",
        failed: data.status === "failed" || data.status === "error",
        progress: data.status ?? "",
      });
    }

    // Kling status check
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
