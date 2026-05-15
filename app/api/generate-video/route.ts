import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";

async function generateKlingToken() {
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
    const { prompt, mode = "text_to_video", image_url, duration = "5", aspect_ratio = "16:9", model = "kling-v1", with_audio = false } = await req.json();

    if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

    const token = await generateKlingToken();

    // Map model IDs to Kling API model names
    const modelMap: Record<string, string> = {
      "kling-v1": "kling-v1",
      "kling-v2": "kling-v2",
      "kling-v3": "kling-v2-master",
    };

    // Sound is supported on v2 and v3 only
    const useAudio = with_audio && (model === "kling-v2" || model === "kling-v3");

    const body: any = {
      model_name: modelMap[model] || "kling-v1",
      prompt,
      duration,
      aspect_ratio,
      cfg_scale: 0.5,
      mode: model === "kling-v3" ? "pro" : "std",
      ...(useAudio && { with_audio: true }),
    };

    if (mode === "image_to_video" && image_url) {
      body.image_url = image_url;
    }

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
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.message || "Kling API error" }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      task_id: data.data?.task_id,
      status: data.data?.task_status,
    });
  } catch (error: any) {
    console.error("Video generation error:", error);
    return NextResponse.json({ error: error.message || "Something went wrong" }, { status: 500 });
  }
}
