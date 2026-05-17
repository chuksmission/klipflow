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

async function refundTokens(userId: string, amount: number) {
  try {
    const { data } = await supabase
      .from("user_tokens")
      .select("balance, total_used")
      .eq("user_id", userId)
      .single();
    if (data) {
      await supabase.from("user_tokens").update({
        balance: data.balance + amount,
        total_used: Math.max(0, data.total_used - amount),
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId);
    }
  } catch (err) {
    console.error("Refund error:", err);
  }
}

async function safeJson(response: Response): Promise<any> {
  try {
    const text = await response.text();
    if (!text || text.trim() === "") return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
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
    body = await req.json();

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

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const isImageMode = mode === "image_to_video" && !!image_url;

    // ================================================================
    // HIGGSFIELD - direct API
    // ================================================================
    if (model === "higgsfield-ugc") {
      const keyId = await getSetting("higgsfield_key_id");
      const keySecret = await getSetting("higgsfield_key_secret");

      if (!keyId || !keySecret) {
        if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
        return NextResponse.json({ error: "Higgsfield is not configured.", refunded: true }, { status: 503 });
      }
      if (!image_url) {
        if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
        return NextResponse.json({ error: "Higgsfield UGC requires an image. Please upload one.", refunded: true }, { status: 400 });
      }

      const higgsfieldRes = await fetch("https://platform.higgsfield.ai/bytedance/seedance/v1/pro/image-to-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Key ${keyId}:${keySecret}`,
        },
        body: JSON.stringify({ prompt, image_url, duration: parseInt(duration) }),
      });

      const higgsfieldData = await safeJson(higgsfieldRes);
      console.log("Higgsfield response:", higgsfieldRes.status, JSON.stringify(higgsfieldData));

      if (!higgsfieldRes.ok) {
        if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
        return NextResponse.json({
          error: higgsfieldData.error ?? higgsfieldData.message ?? higgsfieldData.detail ?? `Higgsfield error (${higgsfieldRes.status})`,
          refunded: true,
        }, { status: higgsfieldRes.status });
      }

      const taskId = higgsfieldData.request_id ?? higgsfieldData.id ?? higgsfieldData.job_id;
      if (!taskId) {
        if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
        return NextResponse.json({ error: "Higgsfield did not return a task ID.", refunded: true }, { status: 500 });
      }

      return NextResponse.json({ success: true, task_id: taskId, status: "queued", provider: "higgsfield" });
    }

    // ================================================================
    // ALL KIE.AI MODELS
    // ================================================================
    const kieApiKey = await getSetting("kie_api_key");
    if (!kieApiKey) {
      if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
      return NextResponse.json({ error: "Kie.ai API key not configured.", refunded: true }, { status: 503 });
    }

    // ----------------------------------------------------------------
    // VEO3 - dedicated endpoint
    // ----------------------------------------------------------------
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

      const veoData = await safeJson(veoRes);
      console.log("Veo3 response:", veoRes.status, JSON.stringify(veoData));

      if (!veoRes.ok || (veoData.code !== undefined && veoData.code !== 200)) {
        if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
        return NextResponse.json({
          error: veoData.msg ?? veoData.message ?? veoData.error ?? `Veo3 error (${veoRes.status})`,
          refunded: true,
        }, { status: 400 });
      }

      const veoTaskId = veoData.data?.taskId ?? veoData.data?.task_id ?? veoData.taskId ?? veoData.task_id;
      if (!veoTaskId) {
        if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
        return NextResponse.json({ error: "Veo3 did not return a task ID. Raw: " + JSON.stringify(veoData), refunded: true }, { status: 500 });
      }

      return NextResponse.json({ success: true, task_id: veoTaskId, status: "queued", provider: "veo3" });
    }

    // ----------------------------------------------------------------
    // KIE.AI MARKET MODELS - /api/v1/jobs/createTask
    // ----------------------------------------------------------------
    let kieModelString = "";
    let kieInput: Record<string, unknown> = {};

    if (model === "kling-v1-6-std") {
      kieModelString = isImageMode ? "kling-2.6/image-to-video" : "kling-2.6/text-to-video";
      if (isImageMode) {
        kieInput = { prompt, duration: String(duration), sound: false };
        if (image_url) kieInput.image_urls = [image_url];
      } else {
        kieInput = { prompt, duration: String(duration), aspect_ratio, sound: false };
      }
    }

    else if (model === "kling-v1-6-pro") {
      kieModelString = isImageMode ? "kling-2.6/image-to-video" : "kling-2.6/text-to-video";
      if (isImageMode) {
        kieInput = { prompt, duration: String(duration), sound: false };
        if (image_url) kieInput.image_urls = [image_url];
      } else {
        kieInput = { prompt, duration: String(duration), aspect_ratio, sound: false };
      }
    }

    else if (model === "kling-v2-master") {
      if (isImageMode) {
        kieModelString = "kling/v2-1-master-image-to-video";
        kieInput = { prompt, duration: String(duration) };
        if (image_url) kieInput.image_url = image_url;
      } else {
        kieModelString = "kling/v2-1-master-text-to-video";
        kieInput = { prompt, duration: String(duration) };
      }
    }

    else if (model === "kling-v3-std") {
      kieModelString = "kling-3.0/video";
      kieInput = {
        prompt,
        duration: String(duration),
        aspect_ratio,
        sound: true,
        mode: "std",
        multi_shots: false,
      };
      if (isImageMode && image_url) kieInput.image_urls = [image_url];
    }

    else if (model === "kling-v3-pro") {
      kieModelString = "kling-3.0/video";
      kieInput = {
        prompt,
        duration: String(duration),
        aspect_ratio,
        sound: true,
        mode: "pro",
        multi_shots: false,
      };
      if (isImageMode && image_url) kieInput.image_urls = [image_url];
    }

    else if (model === "seedance-2") {
      kieModelString = "bytedance/seedance-2";
      kieInput = { prompt, generate_audio: false };
      if (isImageMode && image_url) kieInput.first_frame_url = image_url;
    }

    else if (model === "seedance-2-fast") {
      kieModelString = "bytedance/seedance-2-fast";
      kieInput = { prompt, generate_audio: false };
      if (isImageMode && image_url) kieInput.first_frame_url = image_url;
    }

    else if (model === "hailuo-pro") {
      if (isImageMode) {
        kieModelString = "hailuo/v2/pro/image-to-video";
        kieInput = { prompt, duration: String(duration) };
        if (image_url) kieInput.image_url = image_url;
      } else {
        kieModelString = "hailuo/v2/pro/text-to-video";
        kieInput = { prompt, aspect_ratio, duration: String(duration) };
      }
    }

    else if (model === "sora-2") {
      if (isImageMode) {
        kieModelString = "sora2/image-to-video";
        kieInput = { prompt, duration: String(duration) };
        if (image_url) kieInput.image_url = image_url;
      } else {
        kieModelString = "sora2/text-to-video";
        kieInput = { prompt, aspect_ratio, duration: String(duration) };
      }
    }

    else if (model === "wan-2-6") {
      if (isImageMode) {
        kieModelString = "wan/v2.6/image-to-video";
        kieInput = { prompt, duration: String(duration) };
        if (image_url) kieInput.image_url = image_url;
      } else {
        kieModelString = "wan/v2.6/text-to-video";
        kieInput = { prompt, aspect_ratio, duration: String(duration) };
      }
    }

    else if (model === "luma-ray-3") {
      if (isImageMode) {
        kieModelString = "luma/ray-3/image-to-video";
        kieInput = { prompt, duration: String(duration) };
        if (image_url) kieInput.image_url = image_url;
      } else {
        kieModelString = "luma/ray-3/text-to-video";
        kieInput = { prompt, aspect_ratio, duration: String(duration) };
      }
    }

    else {
      // Fallback to Kling 2.6
      kieModelString = "kling-2.6/text-to-video";
      kieInput = { prompt, duration: String(duration), aspect_ratio, sound: false };
    }

    const kieBody = { model: kieModelString, input: kieInput };
    console.log("Kie.ai POST body:", JSON.stringify(kieBody));

    const kieRes = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${kieApiKey}`,
      },
      body: JSON.stringify(kieBody),
    });

    const kieData = await safeJson(kieRes);
    console.log("Kie.ai response:", kieRes.status, JSON.stringify(kieData));

    if (kieData.code !== 200 || !kieData.data) {
      if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
      return NextResponse.json({
        error: kieData.msg ?? kieData.message ?? kieData.error ?? `Kie.ai error (${kieRes.status}): ${JSON.stringify(kieData)}`,
        refunded: true,
      }, { status: 400 });
    }

    const taskId = kieData.data?.taskId ?? kieData.data?.task_id ?? kieData.taskId;
    console.log("Kie.ai taskId:", taskId);

    if (!taskId) {
      if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
      return NextResponse.json({
        error: "Kie.ai did not return a taskId. Raw: " + JSON.stringify(kieData),
        refunded: true,
      }, { status: 500 });
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