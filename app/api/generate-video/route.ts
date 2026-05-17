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
  } catch { return {}; }
}

export async function POST(req: NextRequest) {
  let body: {
    prompt: string;
    mode?: string;
    image_url?: string;
    duration?: string;
    aspect_ratio?: string;
    model?: string;
    with_audio?: boolean;
    user_id?: string;
    tokens_used?: number;
  } = { prompt: "" };

  try {
    body = await req.json() as typeof body;

    const {
      prompt,
      mode = "text_to_video",
      image_url,
      duration = "5",
      aspect_ratio = "16:9",
      model = "kling-v1-6-pro",
      user_id,
      tokens_used = 15,
    } = body;

    if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

    // ---- HIGGSFIELD ----
    if (model === "higgsfield-ugc") {
      const keyId = await getSetting("higgsfield_key_id");
      const keySecret = await getSetting("higgsfield_key_secret");

      if (!keyId || !keySecret) {
        if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
        return NextResponse.json({ error: "Higgsfield not configured.", refunded: true }, { status: 503 });
      }
      if (!image_url) {
        if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
        return NextResponse.json({ error: "Higgsfield requires an image. Please upload one.", refunded: true }, { status: 400 });
      }

      const endpoint = "https://platform.higgsfield.ai/bytedance/seedance/v1/pro/image-to-video";
      const higgsfieldBody = { prompt, image_url, duration: parseInt(duration) };
      console.log("Higgsfield POST:", endpoint, JSON.stringify(higgsfieldBody));

      const higgsfieldRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Key ${keyId}:${keySecret}`,
        },
        body: JSON.stringify(higgsfieldBody),
      });

      const higgsfieldData = await safeJson(higgsfieldRes) as any;
      console.log("Higgsfield response:", higgsfieldRes.status, JSON.stringify(higgsfieldData));

      if (!higgsfieldRes.ok) {
        if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
        const errMsg = higgsfieldData.error ?? higgsfieldData.message ?? higgsfieldData.detail ?? `Higgsfield error (${higgsfieldRes.status})`;
        return NextResponse.json({ error: errMsg, refunded: true }, { status: higgsfieldRes.status });
      }

      const taskId = higgsfieldData.request_id ?? higgsfieldData.id ?? higgsfieldData.job_id;
      if (!taskId) {
        if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
        return NextResponse.json({ error: "Higgsfield did not return a task ID.", refunded: true }, { status: 500 });
      }

      return NextResponse.json({ success: true, task_id: taskId, status: "queued", provider: "higgsfield" });
    }

    // ---- ALL OTHER MODELS via KIE.AI ----
    const kieApiKey = await getSetting("kie_api_key");
    if (!kieApiKey) {
      if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
      return NextResponse.json({ error: "Kie.ai API key not configured in admin settings.", refunded: true }, { status: 503 });
    }

    const isImageMode = mode === "image_to_video" && !!image_url;

    // ---- VEO3 uses a different endpoint ----
    if (model === "veo3-fast" || model === "veo3-quality") {
      const veoModel = model === "veo3-fast" ? "veo3_fast" : "veo3_quality";
      const veoBody: Record<string, unknown> = {
        prompt,
        model: veoModel,
        aspect_ratio,
      };
      if (isImageMode && image_url) {
        veoBody.imageUrls = [image_url];
        veoBody.generationType = "REFERENCE_2_VIDEO";
      }

      const veoRes = await fetch("https://api.kie.ai/api/v1/veo/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${kieApiKey}`,
        },
        body: JSON.stringify(veoBody),
      });

      const veoData = await safeJson(veoRes) as any;
      console.log("Veo3 response:", veoRes.status, JSON.stringify(veoData));

      if (!veoRes.ok || veoData.code !== 200) {
        if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
        const errMsg = veoData.msg ?? veoData.message ?? veoData.error ?? `Veo3 error (${veoRes.status})`;
        return NextResponse.json({ error: errMsg, refunded: true }, { status: 400 });
      }

      const taskId = veoData.data?.taskId ?? veoData.data?.task_id ?? veoData.taskId;
      if (!taskId) {
        if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
        return NextResponse.json({ error: "Veo3 did not return a taskId.", refunded: true }, { status: 500 });
      }

      return NextResponse.json({ success: true, task_id: taskId, status: "queued", provider: "veo3" });
    }

    // ---- VEO3 uses a different endpoint ----
    if (model === "veo3-fast" || model === "veo3-quality") {
      const veoModel = model === "veo3-fast" ? "veo3_fast" : "veo3_quality";
      const veoBody: Record<string, unknown> = {
        prompt,
        model: veoModel,
        aspect_ratio,
      };
      if (isImageMode && image_url) {
        veoBody.imageUrls = [image_url];
        veoBody.generationType = "REFERENCE_2_VIDEO";
      }

      const veoRes = await fetch("https://api.kie.ai/api/v1/veo/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${kieApiKey}`,
        },
        body: JSON.stringify(veoBody),
      });

      const veoData = await safeJson(veoRes) as any;
      console.log("Veo3 response:", veoRes.status, JSON.stringify(veoData));

      if (!veoRes.ok || veoData.code !== 200) {
        if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
        const errMsg = veoData.msg ?? veoData.message ?? veoData.error ?? `Veo3 error (${veoRes.status})`;
        return NextResponse.json({ error: errMsg, refunded: true }, { status: 400 });
      }

      const taskId = veoData.data?.taskId ?? veoData.data?.task_id ?? veoData.taskId;
      if (!taskId) {
        if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
        return NextResponse.json({ error: "Veo3 did not return a taskId.", refunded: true }, { status: 500 });
      }

      return NextResponse.json({ success: true, task_id: taskId, status: "queued", provider: "veo3" });
    }

    // ---- VEO3 uses a different endpoint ----
    if (model === "veo3-fast" || model === "veo3-quality") {
      const veoModel = model === "veo3-fast" ? "veo3_fast" : "veo3_quality";
      const veoBody: Record<string, unknown> = {
        prompt,
        model: veoModel,
        aspect_ratio,
      };
      if (isImageMode && image_url) {
        veoBody.imageUrls = [image_url];
        veoBody.generationType = "REFERENCE_2_VIDEO";
      }

      const veoRes = await fetch("https://api.kie.ai/api/v1/veo/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${kieApiKey}`,
        },
        body: JSON.stringify(veoBody),
      });

      const veoData = await safeJson(veoRes) as any;
      console.log("Veo3 response:", veoRes.status, JSON.stringify(veoData));

      if (!veoRes.ok || veoData.code !== 200) {
        if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
        const errMsg = veoData.msg ?? veoData.message ?? veoData.error ?? `Veo3 error (${veoRes.status})`;
        return NextResponse.json({ error: errMsg, refunded: true }, { status: 400 });
      }

      const taskId = veoData.data?.taskId ?? veoData.data?.task_id ?? veoData.taskId;
      if (!taskId) {
        if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
        return NextResponse.json({ error: "Veo3 did not return a taskId.", refunded: true }, { status: 500 });
      }

      return NextResponse.json({ success: true, task_id: taskId, status: "queued", provider: "veo3" });
    }

    type KieCfg = { model: string; extraInput?: Record<string, unknown> };

    const textModelMap: Record<string, KieCfg> = {
      "kling-v1-6-std":  { model: "kling/v2-1-standard" },
      "kling-v1-6-pro":  { model: "kling/v2-1-pro" },
      "kling-v2-master": { model: "kling/v2-1-master-text-to-video" },
      "kling-v3-std":    { model: "kling-3.0/video", extraInput: { mode: "std", sound: true, multi_shots: false } },
      "kling-v3-pro":    { model: "kling-3.0/video", extraInput: { mode: "pro", sound: true, multi_shots: false } },
      "veo3-fast":       { model: "veo3/fast" },
      "veo3-quality":    { model: "veo3/quality" },
      "seedance-2":      { model: "bytedance/seedance-2", extraInput: { generate_audio: true } },
      "seedance-2-fast": { model: "bytedance/seedance-2-fast" },
      "hailuo-pro":      { model: "hailuo/v2/pro/text-to-video" },
      "sora-2":          { model: "sora2/text-to-video" },
      "wan-2-6":         { model: "wan/v2.6/text-to-video" },
      "luma-ray-3":      { model: "luma/ray-3/text-to-video" },
    };

    const imageModelMap: Record<string, KieCfg> = {
      "kling-v1-6-std":  { model: "kling-2.6/image-to-video", extraInput: { mode: "std" } },
      "kling-v1-6-pro":  { model: "kling-2.6/image-to-video", extraInput: { mode: "pro" } },
      "kling-v2-master": { model: "kling/v2-1-master-image-to-video" },
      "kling-v3-std":    { model: "kling-3.0/video", extraInput: { mode: "std", sound: true, multi_shots: false } },
      "kling-v3-pro":    { model: "kling-3.0/video", extraInput: { mode: "pro", sound: true, multi_shots: false } },
      "seedance-2":      { model: "bytedance/seedance-2", extraInput: { generate_audio: true } },
      "seedance-2-fast": { model: "bytedance/seedance-2-fast" },
      "hailuo-pro":      { model: "hailuo/v2/pro/image-to-video" },
      "wan-2-6":         { model: "wan/v2.6/image-to-video" },
      "luma-ray-3":      { model: "luma/ray-3/image-to-video" },
    };

    const modelMap = isImageMode ? imageModelMap : textModelMap;
    const kieCfg = modelMap[model] ?? textModelMap[model] ?? { model: "kling/v2-1-pro" };

    const kieInput: Record<string, unknown> = {
      prompt,
      duration,
      aspect_ratio,
      ...kieCfg.extraInput,
    };

    if (isImageMode && image_url) kieInput.image_url = image_url;

    const kieBody = { model: kieCfg.model, input: kieInput };
    console.log("Kie.ai POST:", JSON.stringify(kieBody));

    const kieRes = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${kieApiKey}`,
      },
      body: JSON.stringify(kieBody),
    });

    const kieData = await safeJson(kieRes) as any;
    console.log("Kie.ai response:", kieRes.status, JSON.stringify(kieData));

    if (kieData.code !== 200 || !kieData.data) {
      if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
      const errMsg = kieData.msg ?? kieData.message ?? kieData.error ?? `Kie.ai error (${kieRes.status})`;
      return NextResponse.json({ error: errMsg, refunded: true }, { status: 400 });
    }

    const taskId = kieData.data?.taskId ?? kieData.data?.task_id ?? kieData.taskId;
    console.log("Kie.ai taskId:", taskId, "raw:", JSON.stringify(kieData));
    if (!taskId) {
      if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
      return NextResponse.json({ error: "Kie.ai did not return a taskId. Raw: " + JSON.stringify(kieData), refunded: true }, { status: 500 });
    }

    return NextResponse.json({ success: true, task_id: taskId, status: "queued", provider: "kie" });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Video generation error:", error);
    if (body?.user_id && body?.tokens_used && body.tokens_used > 0) {
      await refundTokens(body.user_id, body.tokens_used);
    }
    return NextResponse.json({ error: message, refunded: true }, { status: 500 });
  }
}