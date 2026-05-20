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
    image_url?: string;
    size?: string;
    user_id?: string;
    tokens_used?: number;
  } = { prompt: "" };

  try {
    body = await req.json();

    const {
      prompt,
      image_url,
      size = "1024x1024",
      user_id,
      tokens_used = 2,
    } = body;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const kieApiKey = await getSetting("kie_api_key");
    if (!kieApiKey) {
      if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
      return NextResponse.json({ error: "Kie.ai API key not configured.", refunded: true }, { status: 503 });
    }

    // Use GPT Image via Kie.ai
    // Text to Image: gpt-image-1/text-to-image
    // Image to Image: gpt-image-1/image-to-image
    const isImageToImage = !!image_url;
    const model = isImageToImage ? "gpt-image-1/image-to-image" : "gpt-image-1/text-to-image";

    const input: Record<string, unknown> = {
      prompt,
      size,
    };
    if (isImageToImage && image_url) input.image_url = image_url;

    const kieBody = { model, input };
    console.log("Kie.ai image POST:", JSON.stringify(kieBody));

    const kieRes = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${kieApiKey}`,
      },
      body: JSON.stringify(kieBody),
    });

    const kieData = await safeJson(kieRes);
    console.log("Kie.ai image response:", kieRes.status, JSON.stringify(kieData));

    if (kieData.code !== 200 || !kieData.data) {
      if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
      return NextResponse.json({
        error: kieData.msg ?? kieData.message ?? kieData.error ?? `Kie.ai error (${kieRes.status}): ${JSON.stringify(kieData)}`,
        refunded: true,
      }, { status: 400 });
    }

    const taskId = kieData.data?.taskId ?? kieData.data?.task_id ?? kieData.taskId;
    console.log("Kie.ai image taskId:", taskId);

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
    console.error("Image generation error:", error);
    if (body?.user_id && body?.tokens_used && body.tokens_used > 0) {
      await refundTokens(body.user_id, body.tokens_used);
    }
    return NextResponse.json({ error: message, refunded: true }, { status: 500 });
  }
}
