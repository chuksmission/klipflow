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
      user_id,
      tokens_used = 15,
    } = body;

    if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

    // ---- HIGGSFIELD (keep until credits used up) ----
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

    // Map our model IDs to Kie.ai model strings + mode
    type KieModelCfg = { model: string; mode?: string; sound: boolean };
    const kieModelMap: Record<string, KieModelCfg> = {
      "kling-v1-6-std":  { model: "kling-v1.6/video",           mode: "std", sound: false },
      "kling-v1-6-pro":  { model: "kling-v1.6/video",           mode: "pro", sound: false },
      "kling-v2-master": { model: "kling-v2.1/video",           mode: "pro", sound: false },
      "kling-v3-std":    { model: "kling-3.0/video",            mode: "std", sound: true  },
      "kling-v3-pro":    { model: "kling-3.0/video",            mode: "pro", sound: true  },
      "veo3-fast":       { model: "veo3/video",                  mode: "fast",    sound: true  },
      "veo3-quality":    { model: "veo3/video",                  mode: "quality", sound: true  },
      "seedance-2":      { model: "bytedance/seedance-2/video",  sound: true  },
      "seedance-2-fast": { model: "bytedance/seedance-2-fast/video", sound: true },
      "hailuo-pro":      { model: "hailuo-video/v2.3/video",    mode: "pro", sound: false },
      "sora-2":          { model: "sora-2/video",               sound: false },
      "wan-2-6":         { model: "wan/v2.6/video",             sound: false },
      "luma-ray-3":      { model: "luma/ray-3/video",           sound: false },
    };

    const kieCfg = kieModelMap[model] ?? { model: "kling-v1.6/video", mode: "std", sound: false };

    const kieInput: Record<string, unknown> = {
      prompt,
      duration,
      aspect_ratio,
      sound: kieCfg.sound,
    };

    if (kieCfg.mode) kieInput.mode = kieCfg.mode;
    if (image_url) kieInput.image_urls = [image_url];

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

    if (!kieRes.ok) {
      if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
      const errMsg = kieData.message ?? kieData.error ?? `Kie.ai error (${kieRes.status})`;
      return NextResponse.json({ error: errMsg, refunded: true }, { status: kieRes.status });
    }

    const jobId = kieData.data?.jobId ?? kieData.jobId ?? kieData.data?.job_id ?? kieData.data?.taskId;
    if (!jobId) {
      if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
      return NextResponse.json({ error: "Kie.ai did not return a job ID. Raw: " + JSON.stringify(kieData), refunded: true }, { status: 500 });
    }

    return NextResponse.json({ success: true, task_id: jobId, status: "queued", provider: "kie" });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Video generation error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
