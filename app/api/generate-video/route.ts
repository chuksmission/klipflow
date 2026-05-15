import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";

async function generateKlingToken(): Promise<string> {
  const accessKey = process.env.KLING_ACCESS_KEY;
  const secretKey = process.env.KLING_SECRET_KEY;
  if (!accessKey || !secretKey) throw new Error("Kling API keys not configured");
  const secret = new TextEncoder().encode(secretKey);
  const token = await new jose.SignJWT({
    iss: accessKey,
    exp: Math.floor(Date.now() / 1000) + 1800,
    nbf: Math.floor(Date.now() / 1000) - 5,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .sign(secret);
  return token;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      prompt,
      mode = "text_to_video",
      image_url,
      duration = "5",
      aspect_ratio = "16:9",
      model = "kling-v1",
      with_audio = false,
    } = body as {
      prompt: string;
      mode?: string;
      image_url?: string;
      duration?: string;
      aspect_ratio?: string;
      model?: string;
      with_audio?: boolean;
    };

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const token = await generateKlingToken();

    const modelMap: Record<string, string> = {
      "kling-v1": "kling-v1",
      "kling-v2": "kling-v2",
      "kling-v3": "kling-v2-master",
    };

    const useAudio = with_audio && (model === "kling-v2" || model === "kling-v3");

    const requestBody: Record<string, unknown> = {
      model_name: modelMap[model] ?? "kling-v1",
      prompt,
      duration,
      aspect_ratio,
      cfg_scale: 0.5,
      mode: model === "kling-v3" ? "pro" : "std",
    };

    if (useAudio) requestBody.with_audio = true;
    if (mode === "image_to_video" && image_url) requestBody.image_url = image_url;

    const endpoint =
      mode === "image_to_video"
        ? "https://api.klingai.com/v1/videos/image2video"
        : "https://api.klingai.com/v1/videos/text2video";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json() as { data?: { task_id?: string; task_status?: string }; message?: string };

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message ?? "Kling API error" },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      task_id: data.data?.task_id,
      status: data.data?.task_status,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Video generation error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
