import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { attachTask, claimCharge, isAdminRequest, releaseClaim, videoModelPrice } from "../../lib/charges";
import { parseOutputLanguage, speechInstruction } from "../../lib/output-language";
import { VIDEO_MODELS } from "../../components/catalog";

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
  let chargeId: string | null = null;
  const release = async () => { if (chargeId) await releaseClaim(chargeId); };
  let body: {
    prompt: string;
    mode?: string;
    image_url?: string;
    duration?: string;
    aspect_ratio?: string;
    model?: string;
    with_audio?: boolean;
    charge_id?: string;
    language?: string;
    accent?: string;
  } = { prompt: "" };

  try {
    body = await req.json();

    const {
      prompt: rawPrompt,
      mode = "text_to_video",
      image_url,
      duration = "5",
      aspect_ratio = "16:9",
      model = "kling-v1-6-pro",
      charge_id,
    } = body;

    if (!rawPrompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Output language: models that generate their own audio are told what the
    // speech should sound like; for silent models it is only saved as metadata
    const outputLanguage = parseOutputLanguage(body.language, body.accent);
    const speaks = VIDEO_MODELS.find((m) => m.id === model)?.hasSound === true;
    const prompt = outputLanguage && speaks ? `${rawPrompt}\n\n${speechInstruction(outputLanguage)}` : rawPrompt;

    // Payment: a paid, unused charge that covers this generation, or an admin
    // (admin tools spend the separate showcase balance)
    if (charge_id) {
      const claim = await claimCharge(charge_id, await videoModelPrice(model));
      if (claim.error) return NextResponse.json({ error: claim.error }, { status: 402 });
      chargeId = charge_id;
    } else if (!(await isAdminRequest(req.headers.get("authorization")))) {
      return NextResponse.json({ error: "Payment required" }, { status: 402 });
    }

    const isImageMode = mode === "image_to_video" && !!image_url;

    // ================================================================
    // HIGGSFIELD - direct API
    // ================================================================
    if (model === "higgsfield-ugc") {
      const keyId = await getSetting("higgsfield_key_id");
      const keySecret = await getSetting("higgsfield_key_secret");

      if (!keyId || !keySecret) {
        await release();
        return NextResponse.json({ error: "Higgsfield is not configured." }, { status: 503 });
      }
      if (!image_url) {
        await release();
        return NextResponse.json({ error: "Higgsfield UGC requires an image. Please upload one." }, { status: 400 });
      }

      const higgsfieldRes = await fetch("https://platform.higgsfield.ai/higgsfield-ai/dop/standard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Key ${keyId}:${keySecret}`,
        },
        body: JSON.stringify({ 
          prompt, 
          image_url, 
          duration: parseInt(duration),
        }),
      });

      const higgsfieldData = await safeJson(higgsfieldRes);
      console.log("Higgsfield response:", higgsfieldRes.status, JSON.stringify(higgsfieldData));

      if (!higgsfieldRes.ok) {
        await release();
        return NextResponse.json({
          error: higgsfieldData.error ?? higgsfieldData.message ?? higgsfieldData.detail ?? `Higgsfield error (${higgsfieldRes.status})`,
        }, { status: higgsfieldRes.status });
      }

      const taskId = higgsfieldData.request_id ?? higgsfieldData.id ?? higgsfieldData.job_id;
      console.log("Higgsfield taskId:", taskId, "raw:", JSON.stringify(higgsfieldData));
      if (!taskId) {
        await release();
        return NextResponse.json({ error: "Higgsfield did not return a task ID." }, { status: 500 });
      }

      if (chargeId) await attachTask(chargeId, String(taskId), "higgsfield");
      return NextResponse.json({ success: true, task_id: taskId, status: "queued", provider: "higgsfield" });
    }

    // ================================================================
    // ALL KIE.AI MODELS
    // ================================================================
    const kieApiKey = await getSetting("kie_api_key");
    if (!kieApiKey) {
      await release();
      return NextResponse.json({ error: "Kie.ai API key not configured." }, { status: 503 });
    }

    // ----------------------------------------------------------------
    // VEO3 - dedicated endpoint
    // ----------------------------------------------------------------
    if (model === "veo3-fast" || model === "veo3-quality") {
      const veoModel = model === "veo3-fast" ? "veo3.1_fast" : "veo3.1_quality";
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
        await release();
        return NextResponse.json({
          error: veoData.msg ?? veoData.message ?? veoData.error ?? `Veo3 error (${veoRes.status})`,
        }, { status: 400 });
      }

      const veoTaskId = veoData.data?.taskId ?? veoData.data?.task_id ?? veoData.taskId ?? veoData.task_id;
      if (!veoTaskId) {
        await release();
        return NextResponse.json({ error: "Veo3 did not return a task ID. Raw: " + JSON.stringify(veoData) }, { status: 500 });
      }

      if (chargeId) await attachTask(chargeId, String(veoTaskId), "veo3");
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

    else if (model === "grok-imagine") {
      if (isImageMode) {
        kieModelString = "grok-imagine/image-to-video";
        kieInput = { prompt, duration: String(duration) };
        if (image_url) kieInput.image_url = image_url;
      } else {
        kieModelString = "grok-imagine/text-to-video";
        kieInput = { prompt, aspect_ratio, duration: String(duration) };
      }
    }

    else if (model === "grok-imagine") {
      if (isImageMode) {
        kieModelString = "grok-imagine/image-to-video";
        kieInput = { prompt, duration: String(duration) };
        if (image_url) kieInput.image_url = image_url;
      } else {
        kieModelString = "grok-imagine/text-to-video";
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
      await release();
      return NextResponse.json({
        error: kieData.msg ?? kieData.message ?? kieData.error ?? `Kie.ai error (${kieRes.status}): ${JSON.stringify(kieData)}`,
      }, { status: 400 });
    }

    const taskId = kieData.data?.taskId ?? kieData.data?.task_id ?? kieData.taskId;
    console.log("Kie.ai taskId:", taskId);

    if (!taskId) {
      await release();
      return NextResponse.json({
        error: "Kie.ai did not return a taskId. Raw: " + JSON.stringify(kieData),
      }, { status: 500 });
    }

    if (chargeId) await attachTask(chargeId, String(taskId), "kie");
      return NextResponse.json({ success: true, task_id: taskId, status: "queued", provider: "kie" });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Video generation error:", error);
    await release();
    return NextResponse.json({ error: message }, { status: 500 });
  }
}