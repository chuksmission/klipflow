import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

async function refundTokens(userId: string, amount: number) {
  try {
    const { data } = await supabase.from("user_tokens").select("balance, total_used").eq("user_id", userId).single();
    if (data) {
      await supabase.from("user_tokens").update({
        balance: data.balance + amount,
        total_used: Math.max(0, data.total_used - amount),
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId);
    }
  } catch (err) { console.error("Refund error:", err); }
}

async function generateKlingVideo(body: Record<string, unknown>, mode: string, token: string) {
  const endpoint = mode === "image_to_video"
    ? "https://api.klingai.com/v1/videos/image2video"
    : "https://api.klingai.com/v1/videos/text2video";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify(body),
  });
  return response;
}

async function generateHiggsfield(prompt: string, imageUrl: string | undefined, aspectRatio: string, duration: string) {
  const keyId = process.env.HIGGSFIELD_KEY_ID;
  const keySecret = process.env.HIGGSFIELD_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Higgsfield API keys not configured");

  const credentials = keyId + ":" + keySecret;

  // Soul mode for UGC — image to video with avatar
  if (imageUrl) {
    const response = await fetch("https://cloud.higgsfield.ai/v1/video/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Key " + credentials,
      },
      body: JSON.stringify({
        model: "higgsfield/ugc",
        input: {
          prompt,
          image_url: imageUrl,
          aspect_ratio: aspectRatio,
          duration: parseInt(duration),
        },
      }),
    });
    return response;
  }

  // Text to video UGC mode
  const response = await fetch("https://cloud.higgsfield.ai/v1/video/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Key " + credentials,
    },
    body: JSON.stringify({
      model: "higgsfield/ugc",
      input: {
        prompt,
        aspect_ratio: aspectRatio,
        duration: parseInt(duration),
      },
    }),
  });
  return response;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      prompt: string;
      mode?: string;
      image_url?: string;
      duration?: string;
      aspect_ratio?: string;
      model?: string;
      with_audio?: boolean;
      user_id?: string;
      tokens_used?: number;
    };

    const {
      prompt,
      mode = "text_to_video",
      image_url,
      duration = "5",
      aspect_ratio = "16:9",
      model = "kling-v1-6-std",
      with_audio = false,
      user_id,
      tokens_used = 10,
    } = body;

    if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

    // Route to Higgsfield for UGC
    if (model === "higgsfield-ugc") {
      const response = await generateHiggsfield(prompt, image_url, aspect_ratio, duration);
      const data = await response.json() as { id?: string; status?: string; error?: string };
      if (!response.ok) {
        if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
        return NextResponse.json({ error: data.error ?? "Higgsfield API error", refunded: true }, { status: response.status });
      }
      return NextResponse.json({ success: true, task_id: data.id, status: data.status, provider: "higgsfield" });
    }

    // Route to Kling
    const klingToken = await generateKlingToken();

    // Correct Kling API model_name values from official docs
    const modelMap: Record<string, { model_name: string; mode: string; sound: boolean }> = {
      "kling-v1-6-std": { model_name: "kling-v1-6", mode: "std", sound: false },
      "kling-v1-6-pro": { model_name: "kling-v1-6", mode: "pro", sound: false },
      "kling-v2-master": { model_name: "kling-v2-master", mode: "pro", sound: false },
      "kling-v2-6": { model_name: "kling-v2-6", mode: "pro", sound: true },
    };

    const modelConfig = modelMap[model] ?? { model_name: "kling-v1-6", mode: "std", sound: false };
    const useAudio = with_audio || modelConfig.sound;

    const requestBody: Record<string, unknown> = {
      model_name: modelConfig.model_name,
      prompt,
      duration,
      aspect_ratio,
      cfg_scale: 0.5,
      mode: modelConfig.mode,
    };

    if (useAudio) requestBody.with_audio = true;
    if (mode === "image_to_video" && image_url) requestBody.image_url = image_url;

    const response = await generateKlingVideo(requestBody, mode, klingToken);
    const data = await response.json() as { data?: { task_id?: string; task_status?: string }; message?: string };

    if (!response.ok) {
      if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
      return NextResponse.json({ error: data.message ?? "Kling API error", refunded: true }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      task_id: data.data?.task_id,
      status: data.data?.task_status,
      provider: "kling",
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Video generation error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
