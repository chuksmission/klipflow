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

async function safeJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const text = await response.text();
    if (!text || text.trim() === "") return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
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
      model = "kling-v1-6-pro",
      with_audio = false,
      user_id,
      tokens_used = 15,
    } = body;

    if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

    // ---- HIGGSFIELD ----
    if (model === "higgsfield-ugc") {
      const keyId = await getAdminSetting("higgsfield_key_id");
      const keySecret = await getAdminSetting("higgsfield_key_secret");

      if (!keyId || !keySecret) {
        if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
        return NextResponse.json({ error: "Higgsfield not configured.", refunded: true }, { status: 503 });
      }

      // Correct model: dop/standard for image-to-video, seedance for text-to-video
      const modelId = image_url ? "higgsfield-ai/dop/standard" : "bytedance/seedance/v1/pro/image-to-video";
      const endpoint = `https://platform.higgsfield.ai/${modelId}`;

      const higgsfieldBody: Record<string, unknown> = { prompt };
      if (image_url) higgsfieldBody.image_url = image_url;
      if (duration) higgsfieldBody.duration = parseInt(duration);

      console.log("Higgsfield POST:", endpoint, JSON.stringify(higgsfieldBody));

      const higgsfieldResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Key ${keyId}:${keySecret}`,
        },
        body: JSON.stringify(higgsfieldBody),
      });

      const higgsfieldData = await safeJson(higgsfieldResponse) as {
        request_id?: string; status?: string;
        error?: string; message?: string; detail?: string;
      };

      console.log("Higgsfield response:", higgsfieldResponse.status, JSON.stringify(higgsfieldData));

      if (!higgsfieldResponse.ok) {
        if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
        const errMsg = higgsfieldData.error ?? higgsfieldData.message ?? higgsfieldData.detail ?? `Higgsfield error (${higgsfieldResponse.status})`;
        return NextResponse.json({ error: errMsg, refunded: true }, { status: higgsfieldResponse.status });
      }

      if (!higgsfieldData.request_id) {
        if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
        return NextResponse.json({ error: "Higgsfield did not return a request_id.", refunded: true }, { status: 500 });
      }

      return NextResponse.json({ success: true, task_id: higgsfieldData.request_id, status: higgsfieldData.status ?? "queued", provider: "higgsfield" });
    }

    // ---- KLING ----
    const klingToken = await generateKlingToken();

    const modelMap: Record<string, { model_name: string; mode: string; sound: boolean }> = {
      "kling-v1-6-std":  { model_name: "kling-v1-6",     mode: "std", sound: false },
      "kling-v1-6-pro":  { model_name: "kling-v1-6",     mode: "pro", sound: false },
      "kling-v2-master": { model_name: "kling-v2-master", mode: "pro", sound: false },
      "kling-v3-std":    { model_name: "kling-v3",        mode: "std", sound: true  },
      "kling-v3-pro":    { model_name: "kling-v3",        mode: "pro", sound: true  },
    };

    const cfg = modelMap[model] ?? { model_name: "kling-v1-6", mode: "std", sound: false };
    const useAudio = with_audio || cfg.sound;

    const requestBody: Record<string, unknown> = {
      model_name: cfg.model_name,
      prompt,
      duration,
      aspect_ratio,
      cfg_scale: 0.5,
      mode: cfg.mode,
    };

    if (useAudio) requestBody.with_audio = true;
    if (mode === "image_to_video" && image_url) requestBody.image_url = image_url;

    const klingEndpoint = mode === "image_to_video"
      ? "https://api.klingai.com/v1/videos/image2video"
      : "https://api.klingai.com/v1/videos/text2video";

    const klingResponse = await fetch(klingEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + klingToken },
      body: JSON.stringify(requestBody),
    });

    const klingData = await safeJson(klingResponse) as {
      data?: { task_id?: string; task_status?: string };
      message?: string;
    };

    if (!klingResponse.ok) {
      if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
      return NextResponse.json({ error: klingData.message ?? "Kling API error", refunded: true }, { status: klingResponse.status });
    }

    return NextResponse.json({
      success: true,
      task_id: klingData.data?.task_id,
      status: klingData.data?.task_status,
      provider: "kling",
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Video generation error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
