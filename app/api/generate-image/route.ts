import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { attachTask, claimCharge, getTokenPrice, isAdminRequest, releaseClaim } from "../../lib/charges";
import { imageTextInstruction, parseOutputLanguage } from "../../lib/output-language";

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
    image_url?: string;
    aspect_ratio?: string;
    charge_id?: string;
    language?: string;
    accent?: string;
  } = { prompt: "" };

  try {
    body = await req.json();

    const {
      prompt: rawPrompt,
      image_url,
      aspect_ratio = "1:1",
      charge_id,
    } = body;

    if (!rawPrompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }
    // Text drawn into the image follows the output language (English needs no note)
    const outputLanguage = parseOutputLanguage(body.language, body.accent);
    const prompt = outputLanguage && outputLanguage.code !== "en" ? `${rawPrompt}\n\n${imageTextInstruction(outputLanguage)}` : rawPrompt;

    // Payment: a paid, unused charge that covers this generation, or an admin
    // (admin tools spend the separate showcase balance)
    if (charge_id) {
      const claim = await claimCharge(charge_id, await getTokenPrice("text_to_image", 2));
      if (claim.error) return NextResponse.json({ error: claim.error }, { status: 402 });
      chargeId = charge_id;
    } else if (!(await isAdminRequest(req.headers.get("authorization")))) {
      return NextResponse.json({ error: "Payment required" }, { status: 402 });
    }

    const kieApiKey = await getSetting("kie_api_key");
    if (!kieApiKey) {
      await release();
      return NextResponse.json({ error: "Kie.ai API key not configured." }, { status: 503 });
    }

    const isImageToImage = !!image_url;

    if (isImageToImage) {
      const kieBody = {
        model: "gpt-image/1.5-image-to-image",
        input: {
          prompt,
          input_urls: [image_url],
          aspect_ratio,
          quality: "medium",
        },
      };
      console.log("Kie.ai image-to-image POST:", JSON.stringify(kieBody));

      const kieRes = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${kieApiKey}`,
        },
        body: JSON.stringify(kieBody),
      });

      const kieData = await safeJson(kieRes);
      console.log("Kie.ai image-to-image response:", kieRes.status, JSON.stringify(kieData));

      if (kieData.code !== 200 || !kieData.data) {
        await release();
        return NextResponse.json({
          error: kieData.msg ?? kieData.message ?? kieData.error ?? `Kie.ai error (${kieRes.status}): ${JSON.stringify(kieData)}`,
        }, { status: 400 });
      }

      const taskId = kieData.data?.taskId ?? kieData.data?.task_id ?? kieData.taskId;
      if (!taskId) {
        await release();
        return NextResponse.json({ error: "Kie.ai did not return a taskId. Raw: " + JSON.stringify(kieData) }, { status: 500 });
      }

      if (chargeId) await attachTask(chargeId, String(taskId), "kie");
      return NextResponse.json({ success: true, task_id: taskId, status: "queued", provider: "kie" });

    } else {
      const kieBody = {
        model: "gpt-image/1.5-text-to-image",
        input: { prompt, aspect_ratio },
      };
      console.log("Kie.ai text-to-image POST:", JSON.stringify(kieBody));

      const kieRes = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${kieApiKey}`,
        },
        body: JSON.stringify(kieBody),
      });

      const kieData = await safeJson(kieRes);
      console.log("Kie.ai text-to-image response:", kieRes.status, JSON.stringify(kieData));

      if (kieData.code !== 200 || !kieData.data) {
        await release();
        return NextResponse.json({
          error: kieData.msg ?? kieData.message ?? kieData.error ?? `Kie.ai error (${kieRes.status}): ${JSON.stringify(kieData)}`,
        }, { status: 400 });
      }

      const taskId = kieData.data?.taskId ?? kieData.data?.task_id ?? kieData.taskId;
      if (!taskId) {
        await release();
        return NextResponse.json({ error: "Kie.ai did not return a taskId. Raw: " + JSON.stringify(kieData) }, { status: 500 });
      }

      if (chargeId) await attachTask(chargeId, String(taskId), "kie");
      return NextResponse.json({ success: true, task_id: taskId, status: "queued", provider: "kie" });
    }

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Image generation error:", error);
    await release();
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
