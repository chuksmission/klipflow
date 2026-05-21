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

    const isImageToImage = !!image_url;

    if (isImageToImage) {
      // Image-to-image uses dedicated 4o Image API
      const body4o: Record<string, unknown> = {
        prompt,
        imageUrls: [image_url],
        aspectRatio: size === "1024x1792" ? "2:3" : size === "1792x1024" ? "3:2" : "1:1",
        nVariants: 1,
      };
      console.log("4o Image API POST:", JSON.stringify(body4o));

      const res4o = await fetch("https://api.kie.ai/api/v1/4o-image/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${kieApiKey}`,
        },
        body: JSON.stringify(body4o),
      });

      const data4o = await safeJson(res4o);
      console.log("4o Image response:", res4o.status, JSON.stringify(data4o));

      if (!res4o.ok || data4o.code !== 200) {
        if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
        return NextResponse.json({
          error: data4o.msg ?? data4o.message ?? data4o.error ?? `4o Image error (${res4o.status}): ${JSON.stringify(data4o)}`,
          refunded: true,
        }, { status: 400 });
      }

      const taskId4o = data4o.data?.taskId ?? data4o.data?.task_id ?? data4o.taskId;
      if (!taskId4o) {
        if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
        return NextResponse.json({ error: "4o Image did not return a taskId. Raw: " + JSON.stringify(data4o), refunded: true }, { status: 500 });
      }

      return NextResponse.json({ success: true, task_id: taskId4o, status: "queued", provider: "4o-image" });

    } else {
      // Text-to-image uses Market API
      const kieBody = {
        model: "gpt-image/1.5-text-to-image",
        input: { prompt },
      };
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
      if (!taskId) {
        if (user_id && tokens_used > 0) await refundTokens(user_id, tokens_used);
        return NextResponse.json({ error: "Kie.ai did not return a taskId. Raw: " + JSON.stringify(kieData), refunded: true }, { status: 500 });
      }

      return NextResponse.json({ success: true, task_id: taskId, status: "queued", provider: "kie" });
    }

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Image generation error:", error);
    if (body?.user_id && body?.tokens_used && body.tokens_used > 0) {
      await refundTokens(body.user_id, body.tokens_used);
    }
    return NextResponse.json({ error: message, refunded: true }, { status: 500 });
  }
}
